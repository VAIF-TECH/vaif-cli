import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface DeployOptions {
  config?: string;
  projectId?: string;
  envId?: string;
  name?: string;
  runtime?: string;
  entrypoint?: string;
  dryRun?: boolean;
}

interface ListOptions {
  config?: string;
  projectId?: string;
  envId?: string;
}

interface FunctionInfo {
  id: string;
  name: string;
  runtime: string;
  deployStatus: string;
  deployedAt?: string;
  memoryMb?: number;
  timeoutMs?: number;
  enabled: boolean;
  invocationCount: number;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

async function findExistingFunction(
  token: string,
  projectId: string,
  name: string,
  envId?: string
): Promise<{ id: string; name: string } | null> {
  const url = new URL(`${VAIF_API_URL}/functions/project/${projectId}`);
  if (envId) url.searchParams.set("envId", envId);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const result = await response.json();
  const fns = result.functions || result;
  if (!Array.isArray(fns)) return null;

  return fns.find((f: any) => f.name === name) || null;
}

async function createFunction(
  token: string,
  projectId: string,
  options: { name: string; runtime: string; entrypoint: string; envId?: string }
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${VAIF_API_URL}/functions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      name: options.name,
      runtime: options.runtime,
      entrypoint: options.entrypoint,
      envId: options.envId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create function: ${error}`);
  }

  return response.json();
}

async function deploySource(
  token: string,
  functionId: string,
  sourceCode: string
): Promise<void> {
  const response = await fetch(
    `${VAIF_API_URL}/functions/${functionId}/source`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sourceCode }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to deploy source: ${error}`);
  }
}

async function listFunctionsApi(
  token: string,
  projectId: string,
  envId?: string
): Promise<FunctionInfo[]> {
  const url = new URL(`${VAIF_API_URL}/functions/project/${projectId}`);
  if (envId) {
    url.searchParams.set("envId", envId);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list functions: ${error}`);
  }

  const result = await response.json();
  return result.functions || result;
}

function detectRuntime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".ts":
      return "typescript";
    case ".js":
    case ".mjs":
      return "nodejs";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    default:
      return "nodejs";
  }
}

function findFunctionFiles(dir: string): string[] {
  const files: string[] = [];
  const validExtensions = [".ts", ".js", ".mjs", ".py", ".go", ".rs"];
  const ignoreFiles = ["drizzle.config.ts", "tsconfig.json", "package.json"];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Each subdirectory is a function — look for index/entrypoint file inside
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
        const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.isFile()) {
            const ext = path.extname(sub.name).toLowerCase();
            if (validExtensions.includes(ext)) {
              files.push(path.join(fullPath, sub.name));
              break; // One entrypoint per subdirectory
            }
          }
        }
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      // Every code file in the functions directory is a function
      if (validExtensions.includes(ext) && !ignoreFiles.includes(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export async function deploy(options: DeployOptions): Promise<void> {
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
    // Config is optional for deploy
  }

  const projectId = options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId;
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(chalk.yellow("Set projectId in vaif.config.json or use --project-id flag."));
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold("VAIF Functions Deploy"));
  console.log("");

  // Find function files
  spinner.start("Scanning for function files...");

  const functionsDir = path.resolve("functions");
  const srcDir = path.resolve("src/functions");

  let functionFiles: string[] = [];

  if (options.entrypoint) {
    // Specific entrypoint provided
    const entryPath = path.resolve(options.entrypoint);
    if (!fs.existsSync(entryPath)) {
      spinner.fail(`File not found: ${options.entrypoint}`);
      process.exit(1);
    }
    functionFiles = [entryPath];
  } else {
    // Scan for functions
    functionFiles = [
      ...findFunctionFiles(functionsDir),
      ...findFunctionFiles(srcDir),
    ];
  }

  if (functionFiles.length === 0) {
    spinner.fail("No function files found");
    console.log(chalk.yellow("\nPlace your functions in:"));
    console.log(chalk.gray("  - ./functions/"));
    console.log(chalk.gray("  - ./src/functions/"));
    console.log(chalk.gray("\nOr specify an entrypoint with --entrypoint"));
    process.exit(1);
  }

  spinner.succeed(`Found ${functionFiles.length} function(s)`);

  // Filter by name if specified
  if (options.name) {
    functionFiles = functionFiles.filter((f) =>
      path.basename(f, path.extname(f)).includes(options.name!)
    );

    if (functionFiles.length === 0) {
      console.log(chalk.yellow(`\nNo functions matching "${options.name}" found`));
      process.exit(1);
    }
  }

  // Display functions to deploy
  console.log("");
  console.log(chalk.gray("Functions to deploy:"));
  for (const file of functionFiles) {
    const parentDir = path.basename(path.dirname(file));
    const name = (parentDir === "functions" || parentDir === "src") ? path.basename(file, path.extname(file)) : parentDir;
    const runtime = options.runtime || detectRuntime(file);
    console.log(chalk.gray(`  - ${name} (${runtime})`));
  }
  console.log("");

  if (options.dryRun) {
    console.log(chalk.yellow("Dry run mode - no functions deployed."));
    return;
  }

  // Deploy each function (create if not exists, then push source)
  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const file of functionFiles) {
    const parentDir = path.basename(path.dirname(file));
    const name = (parentDir === "functions" || parentDir === "src") ? path.basename(file, path.extname(file)) : parentDir;
    const runtime = options.runtime || detectRuntime(file);

    spinner.start(`Deploying ${name}...`);

    try {
      const sourceCode = fs.readFileSync(file, "utf-8");

      // Step 1: Find existing function or create a new one
      let fn = await findExistingFunction(auth.token, projectId, name, options.envId);

      if (!fn) {
        spinner.text = `Creating ${name}...`;
        fn = await createFunction(auth.token, projectId, {
          name,
          runtime,
          entrypoint: path.basename(file),
          envId: options.envId,
        });
      }

      // Step 2: Deploy the source code
      spinner.text = `Deploying ${name}...`;
      await deploySource(auth.token, fn.id, sourceCode);

      spinner.succeed(`Deployed ${name}`);
      results.push({ name, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      spinner.fail(`Failed to deploy ${name}`);
      results.push({ name, success: false, error: message });
    }
  }

  // Summary
  console.log("");
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (failed === 0) {
    console.log(chalk.green(`✓ Successfully deployed ${successful} function(s)`));
  } else {
    console.log(chalk.yellow(`Deployed ${successful}/${results.length} function(s)`));
    console.log("");
    console.log(chalk.red("Failed deployments:"));
    for (const result of results.filter((r) => !r.success)) {
      console.log(chalk.red(`  - ${result.name}: ${result.error}`));
    }
  }
  console.log("");
}

export async function list(options: ListOptions): Promise<void> {
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

  spinner.start("Fetching functions...");

  try {
    const functions = await listFunctionsApi(auth.token, projectId, options.envId);

    spinner.stop();

    if (functions.length === 0) {
      console.log(chalk.yellow("\nNo functions found"));
      console.log(chalk.gray("Deploy your first function with: vaif functions deploy"));
      return;
    }

    console.log("");
    console.log(chalk.bold(`Functions (${functions.length}):`));
    console.log("");

    // Table header
    console.log(
      chalk.gray(
        "  " +
          "NAME".padEnd(25) +
          "RUNTIME".padEnd(15) +
          "STATUS".padEnd(12) +
          "INVOCATIONS".padEnd(14) +
          "LAST DEPLOYED"
      )
    );
    console.log(chalk.gray("  " + "-".repeat(80)));

    for (const fn of functions) {
      const statusColor =
        fn.deployStatus === "deployed"
          ? chalk.green
          : fn.deployStatus === "deploying"
          ? chalk.yellow
          : fn.deployStatus === "failed"
          ? chalk.red
          : chalk.gray;

      console.log(
        "  " +
          fn.name.padEnd(25) +
          fn.runtime.padEnd(15) +
          statusColor(fn.deployStatus.padEnd(12)) +
          String(fn.invocationCount ?? 0).padEnd(14) +
          (fn.deployedAt
            ? new Date(fn.deployedAt).toLocaleDateString()
            : "-")
      );
    }

    console.log("");
  } catch (error) {
    spinner.fail("Failed to fetch functions");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
