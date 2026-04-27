import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import readline from "readline";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface PushOptions {
  config?: string;
  schema?: string;
  projectId?: string;
  dryRun?: boolean;
  force?: boolean;
}

interface SchemaDiff {
  added: { type: string; name: string }[];
  modified: { type: string; name: string; changes: string[] }[];
  removed: { type: string; name: string }[];
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function previewSchemaChanges(
  token: string,
  projectId: string,
  localSchema: unknown
): Promise<{ diff: SchemaDiff; sql: string[] }> {
  const response = await fetch(
    `${VAIF_API_URL}/projects/${projectId}/schema/preview`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ schema: localSchema }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to preview changes: ${error}`);
  }

  return response.json();
}

async function applySchemaChanges(
  token: string,
  projectId: string,
  localSchema: unknown
): Promise<{ success: boolean; migrations: string[] }> {
  const response = await fetch(
    `${VAIF_API_URL}/projects/${projectId}/schema/apply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ schema: localSchema }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to apply changes: ${error}`);
  }

  return response.json();
}

function displayDiff(diff: SchemaDiff): void {
  console.log("");
  console.log(chalk.bold("Schema Changes:"));
  console.log("");

  if (diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0) {
    console.log(chalk.gray("  No changes detected. Schema is up to date."));
    return;
  }

  // Added
  if (diff.added.length > 0) {
    console.log(chalk.green.bold("  + Added:"));
    for (const item of diff.added) {
      console.log(chalk.green(`    + ${item.type}: ${item.name}`));
    }
    console.log("");
  }

  // Modified
  if (diff.modified.length > 0) {
    console.log(chalk.yellow.bold("  ~ Modified:"));
    for (const item of diff.modified) {
      console.log(chalk.yellow(`    ~ ${item.type}: ${item.name}`));
      for (const change of item.changes) {
        console.log(chalk.gray(`        ${change}`));
      }
    }
    console.log("");
  }

  // Removed
  if (diff.removed.length > 0) {
    console.log(chalk.red.bold("  - Removed:"));
    for (const item of diff.removed) {
      console.log(chalk.red(`    - ${item.type}: ${item.name}`));
    }
    console.log("");
  }
}

export async function push(options: PushOptions): Promise<void> {
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

  spinner.start("Loading configuration...");

  try {
    config = await loadConfig(configPath);
  } catch (error) {
    spinner.fail("Failed to load config");
    console.log(chalk.red(`\nError: ${error}`));
    process.exit(1);
  }

  if (!config) {
    spinner.fail("No configuration found");
    console.log(chalk.yellow("\nRun `vaif init` to create a configuration file."));
    process.exit(1);
  }

  const projectId = options.projectId || config.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
  if (!projectId) {
    spinner.fail("No project ID specified");
    console.log(chalk.yellow("\nSet projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  // Load local schema file
  const schemaPath = options.schema || path.resolve("vaif.schema.json");
  if (!fs.existsSync(schemaPath)) {
    spinner.fail("No local schema found");
    console.log(chalk.yellow(`\nExpected schema file at: ${schemaPath}`));
    console.log(chalk.gray("Run `vaif pull` first to fetch the current schema."));
    process.exit(1);
  }

  let localSchema: unknown;
  try {
    const content = fs.readFileSync(schemaPath, "utf-8");
    localSchema = JSON.parse(content);
  } catch (error) {
    spinner.fail("Failed to parse schema file");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }

  spinner.text = "Calculating schema changes...";

  try {
    // Preview changes first
    const { diff, sql } = await previewSchemaChanges(auth.token, projectId, localSchema);

    spinner.stop();

    displayDiff(diff);

    // Check if there are any changes
    if (diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0) {
      console.log("");
      return;
    }

    // Show SQL preview
    if (sql.length > 0) {
      console.log(chalk.bold("SQL Migrations:"));
      console.log("");
      for (const statement of sql) {
        console.log(chalk.gray(`  ${statement}`));
      }
      console.log("");
    }

    // Dry run mode - don't apply
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run mode - no changes applied."));
      console.log(chalk.gray("Remove --dry-run to apply these changes."));
      return;
    }

    // Confirm before applying (unless --force)
    if (!options.force) {
      const hasDestructive = diff.removed.length > 0;

      if (hasDestructive) {
        console.log(chalk.red.bold("⚠️  Warning: This will remove tables/columns from your database."));
        console.log(chalk.red("    This action cannot be undone!"));
        console.log("");
      }

      const answer = await prompt(chalk.cyan("Apply these changes? [y/N] "));

      if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
        console.log(chalk.yellow("\nCancelled. No changes applied."));
        return;
      }
    }

    // Apply changes
    spinner.start("Applying schema changes...");

    const result = await applySchemaChanges(auth.token, projectId, localSchema);

    if (result.success) {
      spinner.succeed("Schema changes applied successfully");
      console.log("");

      if (result.migrations.length > 0) {
        console.log(chalk.gray("Migrations applied:"));
        for (const migration of result.migrations) {
          console.log(chalk.gray(`  - ${migration}`));
        }
        console.log("");
      }

      console.log(chalk.green("Your database schema is now up to date."));
      console.log(chalk.gray("Run `vaif generate` to update your TypeScript types."));
      console.log("");
    } else {
      spinner.fail("Failed to apply some changes");
    }
  } catch (error) {
    spinner.fail("Failed to push schema changes");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
