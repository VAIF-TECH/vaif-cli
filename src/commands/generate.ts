import fs from "fs";
import path from "path";
import pg from "pg";
import ora from "ora";
import chalk from "chalk";
import prettier from "prettier";
import { loadConfig } from "../utils/config.js";
import { loadAuthConfig } from "./login.js";

// ============ TYPES ============

interface GenerateOptions {
  connection?: string;
  output: string;
  schema: string;
  config: string;
  dryRun?: boolean;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  udt_name: string;
  is_identity: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface TableInfo {
  table_name: string;
  table_type: string;
}

interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface EnumInfo {
  enum_name: string;
  enum_value: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

// ============ API INTROSPECTION ============

interface ApiColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  primaryKey: boolean;
  unique: boolean;
}

interface ApiTable {
  name: string;
  columns: ApiColumn[];
  indexes: string[];
  foreignKeys: Array<{
    constraintName: string;
    columnName: string;
    refTable: string;
    refColumn: string;
  }>;
}

interface ApiIntrospectResponse {
  ok: boolean;
  schemaExists: boolean;
  schemaName: string;
  tables: ApiTable[];
}

async function introspectViaApi(
  token: string,
  projectId: string
): Promise<{
  tables: Map<string, ColumnInfo[]>;
  enums: Map<string, string[]>;
  foreignKeys: ForeignKeyInfo[];
}> {
  const response = await fetch(
    `${VAIF_API_URL}/schema-engine/introspect/${projectId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API introspection failed: ${error}`);
  }

  const result: ApiIntrospectResponse = await response.json();

  if (!result.ok || !result.schemaExists) {
    throw new Error("Project schema does not exist yet. Push a migration first with `vaif db push`.");
  }

  // Convert API response to internal format
  const tables = new Map<string, ColumnInfo[]>();
  const foreignKeys: ForeignKeyInfo[] = [];

  for (const apiTable of result.tables) {
    const columns: ColumnInfo[] = apiTable.columns.map((col) => ({
      column_name: col.name,
      data_type: col.type,
      is_nullable: col.nullable ? "YES" : "NO",
      column_default: col.default,
      udt_name: col.type,
      is_identity: col.primaryKey && col.default?.includes("gen_random_uuid") ? "YES" : "NO",
      character_maximum_length: null,
      numeric_precision: null,
      numeric_scale: null,
    }));

    tables.set(apiTable.name, columns);

    for (const fk of apiTable.foreignKeys) {
      foreignKeys.push({
        constraint_name: fk.constraintName,
        table_name: apiTable.name,
        column_name: fk.columnName,
        foreign_table_name: fk.refTable,
        foreign_column_name: fk.refColumn,
      });
    }
  }

  // Enums are not returned by the introspect endpoint yet
  const enums = new Map<string, string[]>();

  return { tables, enums, foreignKeys };
}

// ============ DIRECT DB INTROSPECTION ============

async function introspectDatabase(
  client: pg.Client,
  schema: string
): Promise<{
  tables: Map<string, ColumnInfo[]>;
  enums: Map<string, string[]>;
  foreignKeys: ForeignKeyInfo[];
}> {
  // Get all tables
  const tablesResult = await client.query<TableInfo>(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schema]);

  // Get all columns
  const columnsResult = await client.query<ColumnInfo & { table_name: string }>(`
    SELECT
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default,
      udt_name,
      is_identity,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = $1
    ORDER BY table_name, ordinal_position
  `, [schema]);

  // Get foreign keys
  const fkResult = await client.query<ForeignKeyInfo>(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
  `, [schema]);

  // Get enums
  const enumsResult = await client.query<EnumInfo>(`
    SELECT
      t.typname as enum_name,
      e.enumlabel as enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = $1
    ORDER BY t.typname, e.enumsortorder
  `, [schema]);

  // Group columns by table
  const tables = new Map<string, ColumnInfo[]>();
  for (const table of tablesResult.rows) {
    tables.set(table.table_name, []);
  }
  for (const column of columnsResult.rows) {
    const tableColumns = tables.get(column.table_name);
    if (tableColumns) {
      tableColumns.push(column);
    }
  }

  // Group enum values by name
  const enums = new Map<string, string[]>();
  for (const enumRow of enumsResult.rows) {
    const values = enums.get(enumRow.enum_name) || [];
    values.push(enumRow.enum_value);
    enums.set(enumRow.enum_name, values);
  }

  return {
    tables,
    enums,
    foreignKeys: fkResult.rows,
  };
}

// ============ TYPE MAPPING ============

const pgToTsTypeMap: Record<string, string> = {
  // Numeric
  smallint: "number",
  integer: "number",
  bigint: "string", // Use string for bigint to avoid precision loss
  int2: "number",
  int4: "number",
  int8: "string",
  decimal: "string",
  numeric: "string",
  real: "number",
  float4: "number",
  float8: "number",
  "double precision": "number",
  money: "string",

  // Boolean
  boolean: "boolean",
  bool: "boolean",

  // String
  text: "string",
  varchar: "string",
  char: "string",
  character: "string",
  "character varying": "string",
  name: "string",
  citext: "string",

  // Date/Time
  date: "string",
  time: "string",
  timetz: "string",
  "time without time zone": "string",
  "time with time zone": "string",
  timestamp: "string",
  timestamptz: "string",
  "timestamp without time zone": "string",
  "timestamp with time zone": "string",
  interval: "string",

  // Binary
  bytea: "Buffer",

  // UUID
  uuid: "string",

  // JSON
  json: "unknown",
  jsonb: "unknown",

  // Network
  inet: "string",
  cidr: "string",
  macaddr: "string",
  macaddr8: "string",

  // Geometric
  point: "{ x: number; y: number }",
  line: "string",
  lseg: "string",
  box: "string",
  path: "string",
  polygon: "string",
  circle: "string",

  // Arrays (handled separately)
  ARRAY: "unknown[]",
};

function pgTypeToTs(
  column: ColumnInfo,
  enums: Map<string, string[]>
): string {
  const { data_type, udt_name, is_nullable } = column;

  // Check if it's an enum
  if (enums.has(udt_name)) {
    const enumValues = enums.get(udt_name)!;
    const tsType = enumValues.map((v) => `"${v}"`).join(" | ");
    return is_nullable === "YES" ? `(${tsType}) | null` : tsType;
  }

  // Handle arrays
  if (data_type === "ARRAY") {
    const baseType = udt_name.replace(/^_/, "");
    if (enums.has(baseType)) {
      const enumValues = enums.get(baseType)!;
      const tsType = enumValues.map((v) => `"${v}"`).join(" | ");
      return is_nullable === "YES" ? `(${tsType})[] | null` : `(${tsType})[]`;
    }
    const baseTs = pgToTsTypeMap[baseType] || "unknown";
    return is_nullable === "YES" ? `${baseTs}[] | null` : `${baseTs}[]`;
  }

  // Look up standard types
  let tsType = pgToTsTypeMap[data_type] || pgToTsTypeMap[udt_name] || "unknown";

  // Handle nullability
  if (is_nullable === "YES") {
    tsType = `${tsType} | null`;
  }

  return tsType;
}

// ============ CODE GENERATION ============

function toPascalCase(str: string): string {
  return str
    .split(/[_\-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function generateEnumType(name: string, values: string[]): string {
  const typeName = toPascalCase(name);
  const typeValues = values.map((v) => `  | "${v}"`).join("\n");
  return `export type ${typeName} =\n${typeValues};`;
}

function generateTableInterface(
  tableName: string,
  columns: ColumnInfo[],
  enums: Map<string, string[]>
): { base: string; insert: string; update: string } {
  const interfaceName = toPascalCase(tableName);

  const baseFields: string[] = [];
  const insertFields: string[] = [];
  const updateFields: string[] = [];

  for (const column of columns) {
    const tsType = pgTypeToTs(column, enums);
    const fieldName = column.column_name;

    // Determine if field has a default value or is auto-generated
    const hasDefault = column.column_default !== null || column.is_identity === "YES";
    const isNullable = column.is_nullable === "YES";

    // Base type - all fields as-is
    baseFields.push(`  ${fieldName}: ${tsType};`);

    // Insert type - fields with defaults or auto-generated are optional
    if (hasDefault || column.column_name === "id") {
      insertFields.push(`  ${fieldName}?: ${tsType.replace(" | null", "")} | null;`);
    } else if (isNullable) {
      insertFields.push(`  ${fieldName}?: ${tsType};`);
    } else {
      insertFields.push(`  ${fieldName}: ${tsType.replace(" | null", "")};`);
    }

    // Update type - all fields optional
    updateFields.push(`  ${fieldName}?: ${tsType.replace(" | null", "")} | null;`);
  }

  const base = `export interface ${interfaceName} {\n${baseFields.join("\n")}\n}`;
  const insert = `export interface ${interfaceName}Insert {\n${insertFields.join("\n")}\n}`;
  const update = `export interface ${interfaceName}Update {\n${updateFields.join("\n")}\n}`;

  return { base, insert, update };
}

function generateTypeFile(
  tables: Map<string, ColumnInfo[]>,
  enums: Map<string, string[]>,
  foreignKeys: ForeignKeyInfo[]
): string {
  const lines: string[] = [
    "/**",
    " * Auto-generated TypeScript types from database schema",
    " * Generated by @vaif/cli",
    ` * Generated at: ${new Date().toISOString()}`,
    " * ",
    " * DO NOT EDIT MANUALLY - changes will be overwritten",
    " */",
    "",
  ];

  // Generate enums
  if (enums.size > 0) {
    lines.push("// ============ ENUMS ============");
    lines.push("");
    for (const [name, values] of enums) {
      lines.push(generateEnumType(name, values));
      lines.push("");
    }
  }

  // Generate table interfaces
  lines.push("// ============ TABLES ============");
  lines.push("");

  const tableNames: string[] = [];
  for (const [tableName, columns] of tables) {
    const { base, insert, update } = generateTableInterface(tableName, columns, enums);
    tableNames.push(tableName);
    lines.push(base);
    lines.push("");
    lines.push(insert);
    lines.push("");
    lines.push(update);
    lines.push("");
  }

  // Generate database types object
  lines.push("// ============ DATABASE SCHEMA ============");
  lines.push("");
  lines.push("export interface Database {");
  for (const tableName of tableNames) {
    const interfaceName = toPascalCase(tableName);
    lines.push(`  ${tableName}: {`);
    lines.push(`    Row: ${interfaceName};`);
    lines.push(`    Insert: ${interfaceName}Insert;`);
    lines.push(`    Update: ${interfaceName}Update;`);
    lines.push(`  };`);
  }
  lines.push("}");
  lines.push("");

  // Generate table names type
  lines.push("export type TableName = keyof Database;");
  lines.push("");

  // Generate helper types
  lines.push("// ============ HELPER TYPES ============");
  lines.push("");
  lines.push("export type Row<T extends TableName> = Database[T][\"Row\"];");
  lines.push("export type Insert<T extends TableName> = Database[T][\"Insert\"];");
  lines.push("export type Update<T extends TableName> = Database[T][\"Update\"];");
  lines.push("");

  return lines.join("\n");
}

// ============ MAIN COMMAND ============

export async function generateTypes(options: GenerateOptions): Promise<void> {
  const spinner = ora("Loading configuration...").start();

  try {
    // Load config
    const config = await loadConfig(options.config);
    const connectionString = options.connection || config?.database?.url || process.env.DATABASE_URL;

    // Determine if we have a usable direct connection string
    const hasDirectConnection = connectionString && !connectionString.includes("${");

    let tables: Map<string, ColumnInfo[]>;
    let enums: Map<string, string[]>;
    let foreignKeys: ForeignKeyInfo[];

    if (hasDirectConnection) {
      // ── Mode 1: Direct database connection ──
      spinner.text = "Connecting to database...";

      const client = new pg.Client({ connectionString });
      await client.connect();

      spinner.text = "Introspecting schema...";
      ({ tables, enums, foreignKeys } = await introspectDatabase(client, options.schema));
      await client.end();
    } else {
      // ── Mode 2: API introspection (no DATABASE_URL needed) ──
      const auth = loadAuthConfig();
      if (!auth || !auth.token) {
        spinner.fail("No database connection and not logged in");
        console.log(chalk.yellow("\nEither:"));
        console.log(chalk.gray("  1. Run `vaif login` to authenticate (no DATABASE_URL needed)"));
        console.log(chalk.gray("  2. Set DATABASE_URL in your .env file"));
        console.log(chalk.gray("  3. Pass --connection postgresql://user:pass@host:5432/db"));
        process.exit(1);
      }

      const projectId = config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
      if (!projectId) {
        spinner.fail("No project ID specified");
        console.log(chalk.yellow("\nSet projectId in vaif.config.json or use VAIF_PROJECT_ID env var."));
        process.exit(1);
      }

      spinner.text = "Introspecting schema via API...";
      ({ tables, enums, foreignKeys } = await introspectViaApi(auth.token, projectId));
    }

    if (tables.size === 0) {
      spinner.warn("No tables found");
      console.log(chalk.yellow("\nPush a migration first: vaif db push"));
      return;
    }

    spinner.text = `Generating types for ${tables.size} tables...`;

    // Generate code
    const code = generateTypeFile(tables, enums, foreignKeys);

    // Format with prettier
    const formatted = await prettier.format(code, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
      printWidth: 100,
    });

    if (options.dryRun) {
      spinner.succeed("Generated types (dry run):");
      console.log("");
      console.log(chalk.gray("─".repeat(60)));
      console.log(formatted);
      console.log(chalk.gray("─".repeat(60)));
      return;
    }

    // Ensure output directory exists
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(outputPath, formatted, "utf-8");

    spinner.succeed(
      `Generated types for ${tables.size} tables → ${chalk.cyan(options.output)}`
    );

    // Summary
    console.log("");
    console.log(chalk.green("Generated:"));
    console.log(chalk.gray(`  Tables: ${tables.size}`));
    console.log(chalk.gray(`  Enums: ${enums.size}`));
    console.log("");
    console.log(chalk.gray(`Import in your code:`));
    console.log(chalk.cyan(`  import type { Database, Row, Insert, Update } from "${options.output.replace(/\.ts$/, "")}";`));

  } catch (error) {
    spinner.fail("Failed to generate types");
    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      if (error.message.includes("ECONNREFUSED")) {
        console.log(chalk.yellow("\nMake sure your database is running and accessible."));
      }
    }
    process.exit(1);
  }
}
