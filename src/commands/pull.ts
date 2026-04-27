import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface PullOptions {
  config?: string;
  output?: string;
  schema?: string;
  projectId?: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

async function fetchRemoteSchema(
  token: string,
  projectId: string,
  schemaName: string = "public"
): Promise<{ tables: unknown[]; enums: unknown[]; functions: unknown[] }> {
  const response = await fetch(
    `${VAIF_API_URL}/projects/${projectId}/schema?schema=${schemaName}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch schema: ${error}`);
  }

  return response.json();
}

export async function pull(options: PullOptions): Promise<void> {
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

  spinner.text = "Fetching remote schema...";

  try {
    const schemaName = options.schema || config.database?.schema || "public";
    const schema = await fetchRemoteSchema(auth.token, projectId, schemaName);

    spinner.succeed("Schema fetched successfully");

    // Determine output path
    const outputPath = options.output || path.resolve("vaif.schema.json");

    // Save schema locally
    const schemaContent = {
      $schema: "https://vaif.studio/schemas/schema.json",
      projectId,
      schema: schemaName,
      pulledAt: new Date().toISOString(),
      ...schema,
    };

    fs.writeFileSync(outputPath, JSON.stringify(schemaContent, null, 2), "utf-8");

    console.log("");
    console.log(chalk.green(`Schema saved to: ${outputPath}`));
    console.log("");
    console.log(chalk.gray("Schema summary:"));
    console.log(chalk.gray(`  Tables: ${(schema.tables || []).length}`));
    console.log(chalk.gray(`  Enums: ${(schema.enums || []).length}`));
    console.log(chalk.gray(`  Functions: ${(schema.functions || []).length}`));
    console.log("");
    console.log(chalk.gray("Next steps:"));
    console.log(chalk.gray("  - Run `vaif generate` to generate TypeScript types"));
    console.log(chalk.gray("  - Edit the schema and run `vaif push` to deploy changes"));
    console.log("");
  } catch (error) {
    spinner.fail("Failed to fetch schema");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
