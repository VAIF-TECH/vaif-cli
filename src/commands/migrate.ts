import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig } from "../utils/config.js";

// ============================================================================
// Types
// ============================================================================

export interface MigrateOptions {
  from: "supabase" | "firebase";
  dryRun?: boolean;
  config?: string;
  projectId?: string;
  outputDir?: string;
}

export interface MigrationTable {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    isPrimaryKey?: boolean;
    isUnique?: boolean;
    references?: { table: string; column: string; onDelete?: string };
  }[];
  indexes?: { name: string; columns: string[]; unique?: boolean }[];
  rlsPolicies?: { name: string; command: string; definition: string }[];
}

export interface MigrationBucket {
  name: string;
  public: boolean;
  fileSizeLimit?: number;
  allowedMimeTypes?: string[];
}

export interface MigrationFunction {
  name: string;
  runtime: string;
  entrypoint: string;
  sourceHint?: string;
}

export interface MigrationPlan {
  source: "supabase" | "firebase";
  tables: MigrationTable[];
  buckets: MigrationBucket[];
  functions: MigrationFunction[];
  authProviders: string[];
  warnings: string[];
}

// ============================================================================
// Supabase Reader
// ============================================================================

interface SupabaseConfig {
  projectId?: string;
  db?: { host?: string; port?: number; name?: string };
  api?: { url?: string; anonKey?: string; serviceKey?: string };
}

function readSupabaseConfig(projectDir: string): SupabaseConfig | null {
  // Try .env or .env.local first
  const envPaths = [
    path.join(projectDir, ".env.local"),
    path.join(projectDir, ".env"),
  ];

  const config: SupabaseConfig = {};

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (!match) continue;
        const [, key, value] = match;
        const k = key.trim();
        const v = value.trim().replace(/^["']|["']$/g, "");

        if (k === "SUPABASE_URL" || k === "NEXT_PUBLIC_SUPABASE_URL") {
          config.api = { ...config.api, url: v };
          // Extract project ID from URL: https://xyzcompany.supabase.co
          const urlMatch = v.match(/https:\/\/([^.]+)\.supabase\./);
          if (urlMatch) config.projectId = urlMatch[1];
        }
        if (k === "SUPABASE_ANON_KEY" || k === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
          config.api = { ...config.api, anonKey: v };
        }
        if (k === "SUPABASE_SERVICE_ROLE_KEY") {
          config.api = { ...config.api, serviceKey: v };
        }
      }
      break; // Use first env file found
    }
  }

  // Try supabase/config.toml
  const configToml = path.join(projectDir, "supabase", "config.toml");
  if (fs.existsSync(configToml)) {
    const content = fs.readFileSync(configToml, "utf-8");
    // Basic TOML parsing for project_id
    const pidMatch = content.match(/project_id\s*=\s*"([^"]+)"/);
    if (pidMatch) config.projectId = pidMatch[1];
  }

  return config.projectId || config.api?.url ? config : null;
}

function readSupabaseMigrations(projectDir: string): MigrationTable[] {
  const migrationsDir = path.join(projectDir, "supabase", "migrations");
  const tables: Map<string, MigrationTable> = new Map();

  if (!fs.existsSync(migrationsDir)) return [];

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    parseCreateTables(sql, tables);
    parseRlsPolicies(sql, tables);
  }

  return Array.from(tables.values());
}

function parseCreateTables(sql: string, tables: Map<string, MigrationTable>): void {
  // Match CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];

    if (["schema_migrations", "_prisma_migrations", "supabase_migrations"].includes(tableName)) continue;

    const columns: MigrationTable["columns"] = [];
    const lines = body.split(",\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip constraints
      if (/^\s*(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) continue;

      const colMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]*\))?(?:\[\])?)\s*(.*)/i);
      if (!colMatch) continue;

      const [, name, type, rest] = colMatch;
      const isPk = /PRIMARY\s+KEY/i.test(rest);
      const isUnique = /UNIQUE/i.test(rest);
      const nullable = !/NOT\s+NULL/i.test(rest) && !isPk;
      const defaultMatch = rest.match(/DEFAULT\s+(.+?)(?:\s+|$)/i);

      const refMatch = rest.match(/REFERENCES\s+(?:public\.)?(\w+)\s*\((\w+)\)(?:\s+ON\s+DELETE\s+(\w+))?/i);

      columns.push({
        name,
        type: mapSupabaseType(type),
        nullable,
        isPrimaryKey: isPk,
        isUnique,
        defaultValue: defaultMatch?.[1],
        references: refMatch ? {
          table: refMatch[1],
          column: refMatch[2],
          onDelete: refMatch[3]?.toUpperCase(),
        } : undefined,
      });
    }

    if (columns.length > 0) {
      tables.set(tableName, {
        name: tableName,
        columns,
        indexes: [],
        rlsPolicies: [],
      });
    }
  }

  // Parse CREATE INDEX
  const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(?:public\.)?(\w+)\s*\(([^)]+)\)/gi;
  while ((match = indexRegex.exec(sql)) !== null) {
    const [, indexName, tableName, cols] = match;
    const table = tables.get(tableName);
    if (table) {
      table.indexes = table.indexes || [];
      table.indexes.push({
        name: indexName,
        columns: cols.split(",").map(c => c.trim()),
        unique: /UNIQUE/i.test(match[0]),
      });
    }
  }
}

function parseRlsPolicies(sql: string, tables: Map<string, MigrationTable>): void {
  const policyRegex = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?(\w+)\s+(?:FOR\s+(\w+)\s+)?(?:USING\s+\((.+?)\)|WITH\s+CHECK\s+\((.+?)\))/gi;
  let match;
  while ((match = policyRegex.exec(sql)) !== null) {
    const [, policyName, tableName, command, using, check] = match;
    const table = tables.get(tableName);
    if (table) {
      table.rlsPolicies = table.rlsPolicies || [];
      table.rlsPolicies.push({
        name: policyName,
        command: command || "ALL",
        definition: (using || check || "").replace(/auth\.uid\(\)/g, "vaif.auth_uid()"),
      });
    }
  }
}

function mapSupabaseType(type: string): string {
  const t = type.toLowerCase();
  // Supabase types are PostgreSQL types — mostly pass through
  if (t.includes("serial")) return "integer";
  if (t.includes("bigserial")) return "bigint";
  return type;
}

function readSupabaseStorage(projectDir: string): MigrationBucket[] {
  // Check for storage configuration in supabase/config.toml
  const configToml = path.join(projectDir, "supabase", "config.toml");
  const buckets: MigrationBucket[] = [];

  if (fs.existsSync(configToml)) {
    const content = fs.readFileSync(configToml, "utf-8");
    // Parse [storage.buckets.NAME] sections
    const bucketRegex = /\[storage\.buckets\.(\w+)\]/g;
    let match;
    while ((match = bucketRegex.exec(content)) !== null) {
      const name = match[1];
      const section = content.slice(match.index);
      const isPublic = /public\s*=\s*true/i.test(section.split(/\[/)[0]);
      buckets.push({ name, public: isPublic });
    }
  }

  return buckets;
}

function readSupabaseFunctions(projectDir: string): MigrationFunction[] {
  const functionsDir = path.join(projectDir, "supabase", "functions");
  const functions: MigrationFunction[] = [];

  if (!fs.existsSync(functionsDir)) return [];

  const entries = fs.readdirSync(functionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const indexPath = path.join(functionsDir, entry.name, "index.ts");
    const hasSource = fs.existsSync(indexPath);

    functions.push({
      name: entry.name.replace(/-/g, "_"), // VAIF requires underscores
      runtime: "nodejs20",
      entrypoint: "index.ts",
      sourceHint: hasSource
        ? `Source found at supabase/functions/${entry.name}/index.ts — convert Deno imports to Node.js`
        : undefined,
    });
  }

  return functions;
}

function buildSupabasePlan(projectDir: string): MigrationPlan {
  const warnings: string[] = [];

  const tables = readSupabaseMigrations(projectDir);
  if (tables.length === 0) {
    warnings.push("No migration files found in supabase/migrations/. Add your schema SQL files or export with: supabase db dump --schema public > supabase/migrations/schema.sql");
  }

  const buckets = readSupabaseStorage(projectDir);
  const functions = readSupabaseFunctions(projectDir);

  if (functions.length > 0) {
    warnings.push("Supabase Edge Functions use Deno runtime. VAIF functions use Node.js by default. You will need to convert Deno-specific imports (e.g., std/http/server) to Node.js equivalents.");
  }

  // Check for auth config
  const authProviders: string[] = [];
  const configToml = path.join(projectDir, "supabase", "config.toml");
  if (fs.existsSync(configToml)) {
    const content = fs.readFileSync(configToml, "utf-8");
    if (content.includes("[auth.external.google]")) authProviders.push("google");
    if (content.includes("[auth.external.github]")) authProviders.push("github");
    if (content.includes("[auth.external.apple]")) authProviders.push("apple");
    if (content.includes("[auth.external.azure]")) authProviders.push("microsoft");
    if (content.includes("[auth.sms]") || content.includes("[auth.external.phone]")) authProviders.push("phone");
  }

  return {
    source: "supabase",
    tables,
    buckets,
    functions,
    authProviders,
    warnings,
  };
}

// ============================================================================
// Firebase Reader
// ============================================================================

interface FirebaseConfig {
  projectId?: string;
  storageBucket?: string;
}

function readFirebaseConfig(projectDir: string): FirebaseConfig | null {
  // Try firebase.json
  const firebaseJson = path.join(projectDir, "firebase.json");
  const config: FirebaseConfig = {};

  if (fs.existsSync(firebaseJson)) {
    try {
      const content = JSON.parse(fs.readFileSync(firebaseJson, "utf-8"));
      // firebase.json doesn't always have projectId — check .firebaserc
      if (content.projectId) config.projectId = content.projectId;
    } catch {
      // Ignore parse errors
    }
  }

  // Try .firebaserc
  const firebaserc = path.join(projectDir, ".firebaserc");
  if (fs.existsSync(firebaserc)) {
    try {
      const content = JSON.parse(fs.readFileSync(firebaserc, "utf-8"));
      const defaultProject = content.projects?.default;
      if (defaultProject) config.projectId = defaultProject;
    } catch {
      // Ignore parse errors
    }
  }

  // Try .env for storage bucket
  const envPath = path.join(projectDir, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (key.trim().includes("STORAGE_BUCKET")) {
        config.storageBucket = value.trim().replace(/^["']|["']$/g, "");
      }
    }
  }

  return config.projectId ? config : null;
}

function readFirestoreRules(projectDir: string): MigrationTable[] {
  // Parse firestore.rules to extract collection names and basic structure
  const rulesPath = path.join(projectDir, "firestore.rules");
  const tables: MigrationTable[] = [];

  if (!fs.existsSync(rulesPath)) return [];

  const content = fs.readFileSync(rulesPath, "utf-8");

  // Extract collection names from match patterns
  const matchRegex = /match\s+\/([a-zA-Z_]\w*)\s*\/\{(\w+)\}/g;
  let match;
  const seen = new Set<string>();

  while ((match = matchRegex.exec(content)) !== null) {
    const collectionName = match[1];
    if (seen.has(collectionName)) continue;
    seen.add(collectionName);

    // Skip Firestore internal collections
    if (collectionName.startsWith("_")) continue;

    // Create a basic table structure — user will need to customize columns
    tables.push({
      name: collectionName,
      columns: [
        { name: "id", type: "uuid", nullable: false, isPrimaryKey: true, defaultValue: "gen_random_uuid()" },
        { name: "created_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
        { name: "updated_at", type: "timestamptz", nullable: false, defaultValue: "now()" },
        { name: "data", type: "jsonb", nullable: true, defaultValue: "'{}'" },
      ],
      indexes: [],
      rlsPolicies: [],
    });
  }

  return tables;
}

function readFirebaseFunctions(projectDir: string): MigrationFunction[] {
  const functionsDir = path.join(projectDir, "functions");
  const functions: MigrationFunction[] = [];

  if (!fs.existsSync(functionsDir)) return [];

  // Check for src/index.ts or index.js
  const possibleEntries = [
    path.join(functionsDir, "src", "index.ts"),
    path.join(functionsDir, "index.ts"),
    path.join(functionsDir, "src", "index.js"),
    path.join(functionsDir, "index.js"),
  ];

  const entryFile = possibleEntries.find(p => fs.existsSync(p));
  if (!entryFile) return [];

  const content = fs.readFileSync(entryFile, "utf-8");

  // Extract exported function names
  // matches: exports.functionName = functions.https.onRequest(...)
  // matches: export const functionName = ...
  const exportRegex = /(?:exports\.(\w+)\s*=|export\s+(?:const|function)\s+(\w+))/g;
  let match;

  while ((match = exportRegex.exec(content)) !== null) {
    const name = (match[1] || match[2]).replace(/-/g, "_");
    functions.push({
      name,
      runtime: "nodejs20",
      entrypoint: "index.ts",
      sourceHint: `Exported from ${path.relative(projectDir, entryFile)} — needs manual conversion from Firebase Functions SDK to VAIF handler format`,
    });
  }

  return functions;
}

function readFirebaseStorage(projectDir: string, config: FirebaseConfig): MigrationBucket[] {
  const buckets: MigrationBucket[] = [];

  // Firebase typically has a single default bucket
  if (config.storageBucket) {
    buckets.push({
      name: "default",
      public: false,
    });
  }

  // Check storage.rules for additional context
  const rulesPath = path.join(projectDir, "storage.rules");
  if (fs.existsSync(rulesPath)) {
    const content = fs.readFileSync(rulesPath, "utf-8");
    // Look for path-based rules that suggest bucket organization
    const pathRegex = /match\s+\/([a-zA-Z]\w*)\s*\/\{/g;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
      const bucketName = match[1];
      if (bucketName !== "b" && !buckets.find(b => b.name === bucketName)) {
        buckets.push({ name: bucketName, public: false });
      }
    }
  }

  return buckets;
}

function buildFirebasePlan(projectDir: string): MigrationPlan {
  const warnings: string[] = [];
  const config = readFirebaseConfig(projectDir) || {};

  const tables = readFirestoreRules(projectDir);
  if (tables.length === 0) {
    warnings.push("No firestore.rules found. Add your Firestore rules file or manually specify your collection structure.");
  } else {
    warnings.push(
      "Firestore collections were detected from firestore.rules. Each collection is mapped to a table with a JSONB 'data' column. " +
      "You should replace the 'data' column with specific typed columns matching your document structure. " +
      "See docs/migration/from-firebase.md for schema design patterns."
    );
  }

  const functions = readFirebaseFunctions(projectDir);
  if (functions.length > 0) {
    warnings.push(
      "Firebase Cloud Functions use the Firebase Admin SDK and trigger patterns (auth.user().onCreate, firestore.document().onWrite). " +
      "VAIF functions use a simpler handler(req, ctx) pattern. Each function needs manual conversion."
    );
  }

  const buckets = readFirebaseStorage(projectDir, config);

  // Check for auth providers in firebase.json
  const authProviders: string[] = ["email"]; // Firebase always has email
  const firebaseJson = path.join(projectDir, "firebase.json");
  if (fs.existsSync(firebaseJson)) {
    try {
      const content = JSON.parse(fs.readFileSync(firebaseJson, "utf-8"));
      if (content.auth?.providers) {
        authProviders.push(...content.auth.providers.filter((p: string) => p !== "email"));
      }
    } catch {
      // Ignore
    }
  }

  return {
    source: "firebase",
    tables,
    buckets,
    functions,
    authProviders,
    warnings,
  };
}

// ============================================================================
// Plan Display
// ============================================================================

function displayPlan(plan: MigrationPlan): void {
  console.log("");
  console.log(chalk.bold.cyan(`  Migration Plan (from ${plan.source})`));
  console.log(chalk.gray("  ─".repeat(30)));
  console.log("");

  // Tables
  if (plan.tables.length > 0) {
    console.log(chalk.bold(`  📦 Tables (${plan.tables.length})`));
    for (const table of plan.tables) {
      const colCount = table.columns.length;
      const fks = table.columns.filter(c => c.references).length;
      const policies = table.rlsPolicies?.length || 0;
      const parts = [`${colCount} columns`];
      if (fks > 0) parts.push(`${fks} foreign keys`);
      if (policies > 0) parts.push(`${policies} RLS policies`);
      console.log(chalk.white(`    ${table.name}`) + chalk.gray(` — ${parts.join(", ")}`));
    }
    console.log("");
  }

  // Buckets
  if (plan.buckets.length > 0) {
    console.log(chalk.bold(`  🗄️  Storage Buckets (${plan.buckets.length})`));
    for (const bucket of plan.buckets) {
      console.log(chalk.white(`    ${bucket.name}`) + chalk.gray(` — ${bucket.public ? "public" : "private"}`));
    }
    console.log("");
  }

  // Functions
  if (plan.functions.length > 0) {
    console.log(chalk.bold(`  ⚡ Functions (${plan.functions.length})`));
    for (const fn of plan.functions) {
      console.log(chalk.white(`    ${fn.name}`) + chalk.gray(` — ${fn.runtime}`));
      if (fn.sourceHint) {
        console.log(chalk.yellow(`      ⚠ ${fn.sourceHint}`));
      }
    }
    console.log("");
  }

  // Auth
  if (plan.authProviders.length > 0) {
    console.log(chalk.bold(`  🔐 Auth Providers (${plan.authProviders.length})`));
    console.log(chalk.white(`    ${plan.authProviders.join(", ")}`));
    console.log("");
  }

  // Warnings
  if (plan.warnings.length > 0) {
    console.log(chalk.bold.yellow("  ⚠ Warnings"));
    for (const warning of plan.warnings) {
      console.log(chalk.yellow(`    • ${warning}`));
    }
    console.log("");
  }
}

function writePlanToFile(plan: MigrationPlan, outputDir: string): string {
  let md = `# VAIF Migration Plan\n\n`;
  md += `**Source:** ${plan.source}\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;

  if (plan.tables.length > 0) {
    md += `## Tables (${plan.tables.length})\n\n`;
    for (const table of plan.tables) {
      md += `### ${table.name}\n\n`;
      md += `| Column | Type | Nullable | Default | Constraints |\n`;
      md += `|--------|------|----------|---------|-------------|\n`;
      for (const col of table.columns) {
        const constraints: string[] = [];
        if (col.isPrimaryKey) constraints.push("PK");
        if (col.isUnique) constraints.push("UNIQUE");
        if (col.references) constraints.push(`FK → ${col.references.table}.${col.references.column}`);
        md += `| ${col.name} | ${col.type} | ${col.nullable ? "yes" : "no"} | ${col.defaultValue || "-"} | ${constraints.join(", ") || "-"} |\n`;
      }
      md += "\n";

      if (table.rlsPolicies && table.rlsPolicies.length > 0) {
        md += `**RLS Policies:**\n`;
        for (const policy of table.rlsPolicies) {
          md += `- \`${policy.name}\` (${policy.command}): \`${policy.definition}\`\n`;
        }
        md += "\n";
      }
    }
  }

  if (plan.buckets.length > 0) {
    md += `## Storage Buckets (${plan.buckets.length})\n\n`;
    for (const bucket of plan.buckets) {
      md += `- **${bucket.name}** — ${bucket.public ? "public" : "private"}\n`;
    }
    md += "\n";
  }

  if (plan.functions.length > 0) {
    md += `## Functions (${plan.functions.length})\n\n`;
    for (const fn of plan.functions) {
      md += `- **${fn.name}** — ${fn.runtime}\n`;
      if (fn.sourceHint) md += `  - ⚠ ${fn.sourceHint}\n`;
    }
    md += "\n";
  }

  if (plan.authProviders.length > 0) {
    md += `## Auth Providers\n\n`;
    md += plan.authProviders.map(p => `- ${p}`).join("\n") + "\n\n";
  }

  if (plan.warnings.length > 0) {
    md += `## Warnings\n\n`;
    for (const warning of plan.warnings) {
      md += `- ⚠ ${warning}\n`;
    }
    md += "\n";
  }

  md += `## Next Steps\n\n`;
  md += `1. Review the tables above and adjust column types as needed\n`;
  md += `2. Run \`vaif migrate --from ${plan.source}\` without \`--dry-run\` to execute\n`;
  md += `3. Verify tables were created in the VAIF dashboard\n`;
  md += `4. Migrate your data using the export/import scripts in docs/migration/from-${plan.source}.md\n`;
  md += `5. Update your application code to use \`@vaif/client\`\n`;

  const filePath = path.join(outputDir, "vaif-migration-plan.md");
  fs.writeFileSync(filePath, md, "utf-8");
  return filePath;
}

// ============================================================================
// Execution (non-dry-run)
// ============================================================================

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

async function executePlan(
  plan: MigrationPlan,
  projectId: string,
  token: string
): Promise<void> {
  // Create tables via schema API
  if (plan.tables.length > 0) {
    const spinner = ora(`Creating ${plan.tables.length} tables...`).start();
    try {
      const schemaTables = plan.tables.map(t => ({
        name: t.name,
        columns: t.columns.map(c => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          primaryKey: c.isPrimaryKey || false,
          unique: c.isUnique || false,
          default: c.defaultValue,
          references: c.references ? {
            table: c.references.table,
            column: c.references.column,
            onDelete: c.references.onDelete || "SET NULL",
          } : undefined,
        })),
        indexes: t.indexes,
      }));

      const response = await fetch(
        `${VAIF_API_URL}/schema-engine/${projectId}/tables`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tables: schemaTables }),
        }
      );

      if (response.ok) {
        spinner.succeed(`Created ${plan.tables.length} tables`);
      } else {
        const err = await response.text();
        spinner.fail(`Failed to create tables: ${err}`);
      }
    } catch (error) {
      spinner.fail(`Failed to create tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Create storage buckets
  for (const bucket of plan.buckets) {
    const spinner = ora(`Creating bucket: ${bucket.name}...`).start();
    try {
      const response = await fetch(
        `${VAIF_API_URL}/storage/buckets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-project-id": projectId,
          },
          body: JSON.stringify({
            name: bucket.name,
            public: bucket.public,
            fileSizeLimit: bucket.fileSizeLimit,
            allowedMimeTypes: bucket.allowedMimeTypes,
          }),
        }
      );

      if (response.ok) {
        spinner.succeed(`Created bucket: ${bucket.name}`);
      } else {
        const err = await response.text();
        spinner.warn(`Bucket ${bucket.name}: ${err}`);
      }
    } catch (error) {
      spinner.warn(`Bucket ${bucket.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Create function stubs
  for (const fn of plan.functions) {
    const spinner = ora(`Creating function: ${fn.name}...`).start();
    try {
      const response = await fetch(
        `${VAIF_API_URL}/functions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId,
            name: fn.name,
            runtime: fn.runtime,
            entrypoint: fn.entrypoint,
          }),
        }
      );

      if (response.ok) {
        spinner.succeed(`Created function stub: ${fn.name}`);
      } else {
        const err = await response.text();
        spinner.warn(`Function ${fn.name}: ${err}`);
      }
    } catch (error) {
      spinner.warn(`Function ${fn.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ============================================================================
// Main Command
// ============================================================================

export async function migrate(options: MigrateOptions): Promise<void> {
  const projectDir = options.outputDir ? path.resolve(options.outputDir) : process.cwd();
  const source = options.from;

  console.log("");
  console.log(chalk.bold(`  Analyzing ${source} project...`));

  // Build migration plan
  let plan: MigrationPlan;

  if (source === "supabase") {
    const config = readSupabaseConfig(projectDir);
    if (!config) {
      console.log(chalk.yellow("\n  No Supabase configuration found."));
      console.log(chalk.gray("  Expected: .env with SUPABASE_URL, or supabase/config.toml"));
      console.log(chalk.gray("  Make sure you're in a Supabase project directory.\n"));
      process.exit(1);
    }
    plan = buildSupabasePlan(projectDir);
  } else if (source === "firebase") {
    const config = readFirebaseConfig(projectDir);
    if (!config) {
      console.log(chalk.yellow("\n  No Firebase configuration found."));
      console.log(chalk.gray("  Expected: firebase.json or .firebaserc in project root"));
      console.log(chalk.gray("  Make sure you're in a Firebase project directory.\n"));
      process.exit(1);
    }
    plan = buildFirebasePlan(projectDir);
  } else {
    console.log(chalk.red(`\n  Unknown source: "${source}"`));
    console.log(chalk.gray("  Supported: supabase, firebase\n"));
    process.exit(1);
  }

  // Display the plan
  displayPlan(plan);

  // Dry run — just show the plan and write to file
  if (options.dryRun) {
    const planFile = writePlanToFile(plan, projectDir);
    console.log(chalk.green(`  ✓ Migration plan written to ${chalk.cyan(path.relative(process.cwd(), planFile))}`));
    console.log(chalk.gray(`  Review the plan, then run without --dry-run to execute.\n`));
    return;
  }

  // Execute — need auth and project ID
  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("  Not logged in. Run `vaif login` first."));
    process.exit(1);
  }

  let vaifProjectId = options.projectId;
  if (!vaifProjectId) {
    try {
      const config = await loadConfig(options.config || "vaif.config.json");
      vaifProjectId = config.projectId;
    } catch {
      // Config not found
    }
  }
  if (!vaifProjectId) {
    vaifProjectId = process.env.VAIF_PROJECT_ID;
  }
  if (!vaifProjectId) {
    console.log(chalk.red("  No VAIF project ID specified."));
    console.log(chalk.gray("  Pass --project-id <id>, set in vaif.config.json, or set VAIF_PROJECT_ID env var.\n"));
    process.exit(1);
  }

  console.log(chalk.bold(`  Executing migration to VAIF project: ${vaifProjectId}\n`));

  await executePlan(plan, vaifProjectId, auth.token);

  // Write the plan file regardless
  const planFile = writePlanToFile(plan, projectDir);

  console.log("");
  console.log(chalk.green.bold("  ✓ Migration complete!"));
  console.log(chalk.gray(`  Plan saved to ${path.relative(process.cwd(), planFile)}`));
  console.log("");
  console.log(chalk.bold("  Next steps:"));
  console.log(chalk.gray("  1. Verify tables in the VAIF dashboard"));
  console.log(chalk.gray("  2. Migrate data using scripts in docs/migration/from-" + source + ".md"));
  console.log(chalk.gray("  3. Update your app code to use @vaif/client"));
  console.log(chalk.gray("  4. Run `vaif claude-setup` to configure AI tools for your project\n"));
}
