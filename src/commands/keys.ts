import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface GenerateKeyOptions {
  config?: string;
  projectId?: string;
  name?: string;
}

interface ListKeysOptions {
  config?: string;
  projectId?: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

function resolveProjectId(
  options: { projectId?: string },
  config: VaifConfig | null,
  auth: { projectId?: string }
): string | null {
  return options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId || null;
}

export async function generateKey(options: GenerateKeyOptions): Promise<void> {
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

  const projectId = resolveProjectId(options, config, auth);
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(chalk.yellow("Set projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  const keyName = options.name || `cli-key-${Date.now()}`;

  console.log("");
  console.log(chalk.bold("VAIF Generate API Key"));
  console.log("");

  spinner.start("Generating API key...");

  try {
    const response = await fetch(
      `${VAIF_API_URL}/projects/${projectId}/api-keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: keyName }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate key: ${error}`);
    }

    const data = await response.json();
    spinner.succeed("API key generated");

    console.log("");
    console.log(chalk.green(`  Name: ${data.name}`));
    console.log(chalk.green(`  Key:  ${data.key}`));
    console.log("");
    console.log(chalk.yellow.bold("  Save this key now - it will not be shown again!"));
    console.log("");
  } catch (error) {
    spinner.fail("Failed to generate API key");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

export async function listKeys(options: ListKeysOptions): Promise<void> {
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

  const projectId = resolveProjectId(options, config, auth);
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(chalk.yellow("Set projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold("VAIF API Keys"));
  console.log("");

  spinner.start("Fetching API keys...");

  try {
    const response = await fetch(
      `${VAIF_API_URL}/projects/${projectId}/api-keys`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list keys: ${error}`);
    }

    const data = await response.json();
    const keys = data.keys || data;
    spinner.stop();

    if (!Array.isArray(keys) || keys.length === 0) {
      console.log(chalk.yellow("No API keys found"));
      console.log(chalk.gray("\nGenerate one with: vaif keys generate"));
      return;
    }

    // Display table
    const nameWidth = Math.max(8, ...keys.map((k: any) => (k.name || "").length));
    const header = `  ${"Name".padEnd(nameWidth)}  ${"Key".padEnd(24)}  ${"Created"}`;
    console.log(chalk.gray(header));
    console.log(chalk.gray("  " + "-".repeat(header.length - 2)));

    for (const key of keys) {
      const name = (key.name || "unnamed").padEnd(nameWidth);
      const maskedKey = key.maskedKey || key.prefix || `${(key.key || "").slice(0, 12)}...`;
      const created = key.createdAt
        ? new Date(key.createdAt).toLocaleDateString()
        : "N/A";
      console.log(`  ${name}  ${maskedKey.padEnd(24)}  ${created}`);
    }

    console.log("");
    console.log(chalk.gray(`  ${keys.length} key(s) total`));
    console.log("");
  } catch (error) {
    spinner.fail("Failed to list API keys");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
