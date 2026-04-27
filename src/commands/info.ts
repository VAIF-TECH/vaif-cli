import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface InfoOptions {
  config?: string;
  projectId?: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:[^@/]+@/, ":****@");
  }
}

export async function info(options: InfoOptions): Promise<void> {
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

  spinner.start("Fetching project info...");

  try {
    const response = await fetch(
      `${VAIF_API_URL}/projects/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch project: ${error}`);
    }

    const project = await response.json();
    spinner.stop();

    console.log("");
    console.log(chalk.bold("VAIF Project Info"));
    console.log("");

    const labelWidth = 16;
    const row = (label: string, value: string) => {
      console.log(`  ${chalk.gray(label.padEnd(labelWidth))} ${value}`);
    };

    row("Name:", chalk.white(project.name || "N/A"));
    row("Project ID:", chalk.white(projectId));
    row("Region:", chalk.white(project.region || "us-east-1"));
    row("Plan:", chalk.white(project.plan || project.tier || "free"));
    row("Created:", chalk.white(
      project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "N/A"
    ));

    console.log("");

    row("API URL:", chalk.cyan(project.apiUrl || `${VAIF_API_URL}/v1`));
    row("WS URL:", chalk.cyan(project.wsUrl || project.realtimeUrl || "N/A"));
    row("DB URL:", chalk.cyan(
      project.databaseUrl ? maskUrl(project.databaseUrl) : "N/A"
    ));
    row("Storage URL:", chalk.cyan(project.storageUrl || "N/A"));

    console.log("");
  } catch (error) {
    spinner.fail("Failed to fetch project info");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
