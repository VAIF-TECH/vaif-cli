import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface SeedOptions {
  config?: string;
  projectId?: string;
  file?: string;
  table?: string;
  dryRun?: boolean;
  truncate?: boolean;
}

interface ResetOptions {
  config?: string;
  projectId?: string;
  force?: boolean;
}

interface DbPushOptions {
  config?: string;
  projectId?: string;
  dir?: string;
  dryRun?: boolean;
}

interface DbPullOptions {
  config?: string;
  projectId?: string;
  output?: string;
}

interface SeedFile {
  table: string;
  data: Record<string, unknown>[];
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

async function insertRecords(
  token: string,
  projectId: string,
  table: string,
  records: Record<string, unknown>[],
  options?: { truncate?: boolean }
): Promise<{ inserted: number }> {
  const response = await fetch(
    `${VAIF_API_URL}/projects/${projectId}/db/seed`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        table,
        records,
        truncate: options?.truncate ?? false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to seed ${table}: ${error}`);
  }

  return response.json();
}

async function resetDatabase(
  token: string,
  projectId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${VAIF_API_URL}/projects/${projectId}/db/reset`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to reset database: ${error}`);
  }

  return response.json();
}

function findSeedFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".json" || ext === ".ts" || ext === ".js") {
        files.push(path.join(dir, entry.name));
      }
    }
  }

  return files.sort();
}

async function loadSeedFile(filePath: string): Promise<SeedFile[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Support both single table and multi-table formats
    if (Array.isArray(data)) {
      // Array of records - infer table name from filename
      const tableName = path.basename(filePath, ext);
      return [{ table: tableName, data }];
    } else if (data.table && data.data) {
      // Single table format
      return [data];
    } else {
      // Object with table names as keys
      return Object.entries(data).map(([table, records]) => ({
        table,
        data: records as Record<string, unknown>[],
      }));
    }
  } else if (ext === ".ts" || ext === ".js") {
    // Dynamic import for JS/TS files
    const module = await import(filePath);
    const exported = module.default || module;

    if (typeof exported === "function") {
      return exported();
    }
    return exported;
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

export async function seed(options: SeedOptions): Promise<void> {
  const spinner = ora();

  // Load auth
  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray("Run `vaif login` first to authenticate"));
    process.exit(1);
  }

  // Load config
  const configPath = options.config || "vaif.config.json";
  let config: VaifConfig | null = null;

  try {
    config = await loadConfig(configPath);
  } catch {
    // Config is optional
  }

  const projectId = options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(chalk.yellow("Set projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold("VAIF Database Seed"));
  console.log("");

  // Find seed files
  let seedFiles: string[] = [];

  if (options.file) {
    // Specific file provided
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`File not found: ${options.file}`));
      process.exit(1);
    }
    seedFiles = [filePath];
  } else {
    // Scan default directories
    const seedDir = path.resolve("seeds");
    const prismaDir = path.resolve("prisma/seed");
    const dbDir = path.resolve("db/seeds");

    seedFiles = [
      ...findSeedFiles(seedDir),
      ...findSeedFiles(prismaDir),
      ...findSeedFiles(dbDir),
    ];
  }

  if (seedFiles.length === 0) {
    console.log(chalk.yellow("No seed files found"));
    console.log(chalk.gray("\nPlace your seed files in one of these directories:"));
    console.log(chalk.gray("  - ./seeds/"));
    console.log(chalk.gray("  - ./prisma/seed/"));
    console.log(chalk.gray("  - ./db/seeds/"));
    console.log(chalk.gray("\nOr specify a file with --file"));
    console.log(chalk.gray("\nExample seed file (seeds/users.json):"));
    console.log(chalk.gray('  ['));
    console.log(chalk.gray('    { "name": "John Doe", "email": "john@example.com" },'));
    console.log(chalk.gray('    { "name": "Jane Doe", "email": "jane@example.com" }'));
    console.log(chalk.gray('  ]'));
    process.exit(1);
  }

  // Display files to process
  console.log(chalk.gray("Seed files found:"));
  for (const file of seedFiles) {
    console.log(chalk.gray(`  - ${path.relative(process.cwd(), file)}`));
  }
  console.log("");

  if (options.truncate) {
    console.log(chalk.yellow("⚠️  Tables will be truncated before seeding"));
    console.log("");
  }

  if (options.dryRun) {
    console.log(chalk.yellow("Dry run mode - no data will be inserted."));
    console.log("");

    // Show preview
    for (const file of seedFiles) {
      spinner.start(`Loading ${path.basename(file)}...`);
      try {
        const seeds = await loadSeedFile(file);
        spinner.stop();

        for (const seed of seeds) {
          // Filter by table if specified
          if (options.table && seed.table !== options.table) {
            continue;
          }

          console.log(chalk.cyan(`Table: ${seed.table}`));
          console.log(chalk.gray(`  Records: ${seed.data.length}`));

          if (seed.data.length > 0) {
            console.log(chalk.gray(`  Sample: ${JSON.stringify(seed.data[0], null, 2).slice(0, 100)}...`));
          }
          console.log("");
        }
      } catch (error) {
        spinner.fail(`Failed to load ${path.basename(file)}`);
        if (error instanceof Error) {
          console.log(chalk.red(`  Error: ${error.message}`));
        }
      }
    }
    return;
  }

  // Process seed files
  const results: { table: string; inserted: number; error?: string }[] = [];

  for (const file of seedFiles) {
    spinner.start(`Processing ${path.basename(file)}...`);

    try {
      const seeds = await loadSeedFile(file);
      spinner.stop();

      for (const seed of seeds) {
        // Filter by table if specified
        if (options.table && seed.table !== options.table) {
          continue;
        }

        if (seed.data.length === 0) {
          console.log(chalk.gray(`  Skipping ${seed.table} (no records)`));
          continue;
        }

        spinner.start(`Seeding ${seed.table} (${seed.data.length} records)...`);

        try {
          const result = await insertRecords(
            auth.token,
            projectId,
            seed.table,
            seed.data,
            { truncate: options.truncate }
          );

          spinner.succeed(`Seeded ${seed.table}: ${result.inserted} records`);
          results.push({ table: seed.table, inserted: result.inserted });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          spinner.fail(`Failed to seed ${seed.table}`);
          results.push({ table: seed.table, inserted: 0, error: message });
        }
      }
    } catch (error) {
      spinner.fail(`Failed to load ${path.basename(file)}`);
      if (error instanceof Error) {
        console.log(chalk.red(`  Error: ${error.message}`));
      }
    }
  }

  // Summary
  console.log("");
  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const failed = results.filter((r) => r.error).length;

  if (failed === 0) {
    console.log(chalk.green(`✓ Successfully seeded ${totalInserted} records across ${results.length} table(s)`));
  } else {
    console.log(chalk.yellow(`Seeded ${totalInserted} records with ${failed} error(s)`));
    console.log("");
    console.log(chalk.red("Errors:"));
    for (const result of results.filter((r) => r.error)) {
      console.log(chalk.red(`  - ${result.table}: ${result.error}`));
    }
  }
  console.log("");
}

export async function dbPush(options: DbPushOptions): Promise<void> {
  const spinner = ora();

  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray("Run `vaif login` first to authenticate"));
    process.exit(1);
  }

  const configPath = options.config || "vaif.config.json";
  let config: VaifConfig | null = null;
  try {
    config = await loadConfig(configPath);
  } catch {
    // Config is optional
  }

  const projectId = options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(chalk.yellow("Set projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  const migrationsDir = path.resolve(options.dir || "./drizzle");

  console.log("");
  console.log(chalk.bold("VAIF Database Push"));
  console.log("");

  if (!fs.existsSync(migrationsDir)) {
    // Try fallback directories
    const fallback = path.resolve("./migrations");
    if (fs.existsSync(fallback)) {
      console.log(chalk.gray(`Using migrations from: ${fallback}`));
    } else {
      console.log(chalk.red(`Migrations directory not found: ${migrationsDir}`));
      console.log(chalk.gray("\nExpected one of:"));
      console.log(chalk.gray("  - ./drizzle/"));
      console.log(chalk.gray("  - ./migrations/"));
      console.log(chalk.gray("\nOr specify with: vaif db push --dir <path>"));
      process.exit(1);
    }
  }

  // Find all .sql files in the migrations directory
  const sqlFiles: string[] = [];
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      sqlFiles.push(path.join(migrationsDir, entry.name));
    } else if (entry.isDirectory()) {
      // Check subdirectories (Drizzle puts migrations in numbered folders)
      const subEntries = fs.readdirSync(path.join(migrationsDir, entry.name), { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith(".sql")) {
          sqlFiles.push(path.join(migrationsDir, entry.name, subEntry.name));
        }
      }
    }
  }

  sqlFiles.sort();

  if (sqlFiles.length === 0) {
    console.log(chalk.yellow("No SQL migration files found"));
    process.exit(1);
  }

  console.log(chalk.gray(`Found ${sqlFiles.length} migration(s):`));
  for (const file of sqlFiles) {
    console.log(chalk.gray(`  - ${path.relative(process.cwd(), file)}`));
  }
  console.log("");

  if (options.dryRun) {
    console.log(chalk.yellow("Dry run mode - no migrations will be applied."));
    console.log("");
    for (const file of sqlFiles) {
      const sql = fs.readFileSync(file, "utf-8");
      console.log(chalk.cyan(`--- ${path.basename(file)} ---`));
      console.log(chalk.gray(sql.slice(0, 500)));
      if (sql.length > 500) console.log(chalk.gray("..."));
      console.log("");
    }
    return;
  }

  // Apply migrations
  let applied = 0;
  let failed = 0;

  for (const file of sqlFiles) {
    const sql = fs.readFileSync(file, "utf-8");
    const fileName = path.relative(process.cwd(), file);

    spinner.start(`Applying ${fileName}...`);

    try {
      const response = await fetch(
        `${VAIF_API_URL}/schema-engine/query/${projectId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      spinner.succeed(`Applied ${fileName}`);
      applied++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      spinner.fail(`Failed ${fileName}: ${message}`);
      failed++;
    }
  }

  console.log("");
  if (failed === 0) {
    console.log(chalk.green(`Successfully applied ${applied} migration(s)`));
  } else {
    console.log(chalk.yellow(`Applied ${applied}, failed ${failed} migration(s)`));
  }
  console.log("");
}

export async function dbPull(options: DbPullOptions): Promise<void> {
  const spinner = ora();

  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray("Run `vaif login` first to authenticate"));
    process.exit(1);
  }

  const configPath = options.config || "vaif.config.json";
  let config: VaifConfig | null = null;
  try {
    config = await loadConfig(configPath);
  } catch {
    // Config is optional
  }

  const projectId = options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(chalk.yellow("Set projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  const outputPath = path.resolve(options.output || "vaif.schema.json");

  console.log("");
  console.log(chalk.bold("VAIF Database Pull"));
  console.log("");

  spinner.start("Pulling schema from remote...");

  try {
    const response = await fetch(
      `${VAIF_API_URL}/schema-engine/introspect/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to pull schema: ${error}`);
    }

    const schema = await response.json();
    fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), "utf-8");

    spinner.succeed(`Schema written to ${path.relative(process.cwd(), outputPath)}`);

    const tableCount = schema.tables?.length ?? Object.keys(schema).length;
    console.log(chalk.gray(`  ${tableCount} table(s) pulled`));
    console.log("");
  } catch (error) {
    spinner.fail("Failed to pull schema");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

export async function reset(options: ResetOptions): Promise<void> {
  const spinner = ora();

  // Load auth
  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray("Run `vaif login` first to authenticate"));
    process.exit(1);
  }

  // Load config
  const configPath = options.config || "vaif.config.json";
  let config: VaifConfig | null = null;

  try {
    config = await loadConfig(configPath);
  } catch {
    // Config is optional
  }

  const projectId = options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    process.exit(1);
  }

  console.log("");
  console.log(chalk.red.bold("⚠️  DATABASE RESET"));
  console.log("");
  console.log(chalk.red("This will:"));
  console.log(chalk.red("  - Drop all tables"));
  console.log(chalk.red("  - Delete all data"));
  console.log(chalk.red("  - Reset migrations"));
  console.log("");
  console.log(chalk.red.bold("This action cannot be undone!"));
  console.log("");

  if (!options.force) {
    // Require --force flag
    console.log(chalk.yellow("Use --force to confirm this action."));
    process.exit(1);
  }

  spinner.start("Resetting database...");

  try {
    await resetDatabase(auth.token, projectId);
    spinner.succeed("Database reset complete");
    console.log("");
    console.log(chalk.gray("Your database is now empty."));
    console.log(chalk.gray("Run `vaif push` to apply your schema, then `vaif db seed` to seed data."));
    console.log("");
  } catch (error) {
    spinner.fail("Failed to reset database");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
