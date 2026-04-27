/**
 * @vaiftech/cli - VAIF CLI and Type Generation
 *
 * CLI tool for generating TypeScript types from database schemas.
 *
 * @example CLI Usage
 * ```bash
 * # Initialize VAIF config
 * npx vaif init --typescript
 *
 * # Generate types from database
 * npx vaif generate --connection postgres://... --output ./src/types/db.ts
 *
 * # Generate types using config file
 * npx vaif generate
 *
 * # Preview generated types without writing
 * npx vaif generate --dry-run
 * ```
 *
 * @example Programmatic Usage
 * ```typescript
 * import { generateTypesFromConnection } from '@vaiftech/cli';
 *
 * const types = await generateTypesFromConnection({
 *   connectionString: process.env.DATABASE_URL,
 *   schema: 'public',
 * });
 *
 * fs.writeFileSync('./src/types/db.ts', types);
 * ```
 *
 * @packageDocumentation
 */

export { loadConfig, type VaifConfig } from "./utils/config.js";
export { generateTypes } from "./commands/generate.js";
export { initConfig } from "./commands/init.js";

// Re-export for programmatic use
import pg from "pg";
import prettier from "prettier";

export interface GenerateTypesOptions {
  connectionString: string;
  schema?: string;
}

export interface ColumnInfo {
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

/**
 * Generate TypeScript types from a database connection
 *
 * @example
 * ```typescript
 * import { generateTypesFromConnection } from '@vaiftech/cli';
 *
 * const types = await generateTypesFromConnection({
 *   connectionString: 'postgres://user:pass@localhost:5432/mydb',
 *   schema: 'public',
 * });
 *
 * console.log(types);
 * ```
 */
export async function generateTypesFromConnection(
  options: GenerateTypesOptions
): Promise<string> {
  const { connectionString, schema = "public" } = options;

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Get all tables
    const tablesResult = await client.query(`
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

    // Get enums
    const enumsResult = await client.query<{ enum_name: string; enum_value: string }>(`
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

    // Group enum values
    const enums = new Map<string, string[]>();
    for (const enumRow of enumsResult.rows) {
      const values = enums.get(enumRow.enum_name) || [];
      values.push(enumRow.enum_value);
      enums.set(enumRow.enum_name, values);
    }

    // Generate code
    const code = generateTypeFileContent(tables, enums);

    // Format with prettier
    return prettier.format(code, {
      parser: "typescript",
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
      printWidth: 100,
    });

  } finally {
    await client.end();
  }
}

// Type mapping
const pgToTsTypeMap: Record<string, string> = {
  smallint: "number",
  integer: "number",
  bigint: "string",
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
  boolean: "boolean",
  bool: "boolean",
  text: "string",
  varchar: "string",
  char: "string",
  character: "string",
  "character varying": "string",
  name: "string",
  citext: "string",
  date: "string",
  time: "string",
  timetz: "string",
  timestamp: "string",
  timestamptz: "string",
  "timestamp without time zone": "string",
  "timestamp with time zone": "string",
  interval: "string",
  bytea: "Buffer",
  uuid: "string",
  json: "unknown",
  jsonb: "unknown",
  inet: "string",
  cidr: "string",
  macaddr: "string",
  point: "{ x: number; y: number }",
  ARRAY: "unknown[]",
};

function pgTypeToTs(column: ColumnInfo, enums: Map<string, string[]>): string {
  const { data_type, udt_name, is_nullable } = column;

  if (enums.has(udt_name)) {
    const enumValues = enums.get(udt_name)!;
    const tsType = enumValues.map((v) => `"${v}"`).join(" | ");
    return is_nullable === "YES" ? `(${tsType}) | null` : tsType;
  }

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

  let tsType = pgToTsTypeMap[data_type] || pgToTsTypeMap[udt_name] || "unknown";
  if (is_nullable === "YES") {
    tsType = `${tsType} | null`;
  }
  return tsType;
}

function toPascalCase(str: string): string {
  return str
    .split(/[_\-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function generateTypeFileContent(
  tables: Map<string, ColumnInfo[]>,
  enums: Map<string, string[]>
): string {
  const lines: string[] = [
    "/**",
    " * Auto-generated TypeScript types from database schema",
    " * Generated by @vaiftech/cli",
    ` * Generated at: ${new Date().toISOString()}`,
    " * ",
    " * DO NOT EDIT MANUALLY - changes will be overwritten",
    " */",
    "",
  ];

  // Enums
  if (enums.size > 0) {
    lines.push("// ============ ENUMS ============");
    lines.push("");
    for (const [name, values] of enums) {
      const typeName = toPascalCase(name);
      const typeValues = values.map((v) => `  | "${v}"`).join("\n");
      lines.push(`export type ${typeName} =\n${typeValues};`);
      lines.push("");
    }
  }

  // Tables
  lines.push("// ============ TABLES ============");
  lines.push("");

  const tableNames: string[] = [];
  for (const [tableName, columns] of tables) {
    tableNames.push(tableName);
    const interfaceName = toPascalCase(tableName);

    const baseFields: string[] = [];
    const insertFields: string[] = [];
    const updateFields: string[] = [];

    for (const column of columns) {
      const tsType = pgTypeToTs(column, enums);
      const fieldName = column.column_name;
      const hasDefault = column.column_default !== null || column.is_identity === "YES";
      const isNullable = column.is_nullable === "YES";

      baseFields.push(`  ${fieldName}: ${tsType};`);

      if (hasDefault || column.column_name === "id") {
        insertFields.push(`  ${fieldName}?: ${tsType.replace(" | null", "")} | null;`);
      } else if (isNullable) {
        insertFields.push(`  ${fieldName}?: ${tsType};`);
      } else {
        insertFields.push(`  ${fieldName}: ${tsType.replace(" | null", "")};`);
      }

      updateFields.push(`  ${fieldName}?: ${tsType.replace(" | null", "")} | null;`);
    }

    lines.push(`export interface ${interfaceName} {\n${baseFields.join("\n")}\n}`);
    lines.push("");
    lines.push(`export interface ${interfaceName}Insert {\n${insertFields.join("\n")}\n}`);
    lines.push("");
    lines.push(`export interface ${interfaceName}Update {\n${updateFields.join("\n")}\n}`);
    lines.push("");
  }

  // Database schema
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
  lines.push("export type TableName = keyof Database;");
  lines.push("");
  lines.push("// ============ HELPER TYPES ============");
  lines.push("");
  lines.push("export type Row<T extends TableName> = Database[T][\"Row\"];");
  lines.push("export type Insert<T extends TableName> = Database[T][\"Insert\"];");
  lines.push("export type Update<T extends TableName> = Database[T][\"Update\"];");
  lines.push("");

  return lines.join("\n");
}
