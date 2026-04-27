import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface StatusOptions {
  config?: string;
  projectId?: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

export async function status(options: StatusOptions): Promise<void> {
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

  spinner.start("Fetching project status...");

  try {
    const response = await fetch(
      `${VAIF_API_URL}/projects/${projectId}?include=tables,functions,storage,connections`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch project status: ${error}`);
    }

    const project = await response.json();
    spinner.stop();

    console.log("");
    console.log(chalk.bold("VAIF Project Status"));
    console.log("");

    const labelWidth = 22;
    const row = (label: string, value: string) => {
      console.log(`  ${chalk.gray(label.padEnd(labelWidth))} ${value}`);
    };

    row("Project:", chalk.white(project.name || projectId));
    row("Plan:", chalk.white(project.plan || project.tier || "free"));

    console.log("");
    console.log(chalk.gray("  --- Resources ---"));
    console.log("");

    const tableCount = project.tableCount ?? project.tables?.length ?? "N/A";
    const functionCount = project.functionCount ?? project.functions?.length ?? "N/A";
    const bucketCount = project.bucketCount ?? project.storage?.buckets?.length ?? "N/A";
    const connections = project.activeConnections ?? project.connections ?? "N/A";

    row("Tables:", chalk.white(String(tableCount)));
    row("Functions:", chalk.white(String(functionCount)));
    row("Storage Buckets:", chalk.white(String(bucketCount)));
    row("Active Connections:", chalk.white(String(connections)));

    if (project.usage) {
      console.log("");
      console.log(chalk.gray("  --- Usage ---"));
      console.log("");

      if (project.usage.dbSize) {
        row("Database Size:", chalk.white(project.usage.dbSize));
      }
      if (project.usage.storageSize) {
        row("Storage Size:", chalk.white(project.usage.storageSize));
      }
      if (project.usage.bandwidth) {
        row("Bandwidth:", chalk.white(project.usage.bandwidth));
      }
      if (project.usage.functionInvocations != null) {
        row("Function Invocations:", chalk.white(String(project.usage.functionInvocations)));
      }
    }

    console.log("");
  } catch (error) {
    spinner.fail("Failed to fetch project status");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
