import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import ora from "ora";
import chalk from "chalk";
import readline from "readline";

interface LoginOptions {
  email?: boolean;
  token?: string;
  projectId?: string;
}

interface AuthConfig {
  token: string;
  email?: string;
  projectId?: string;
  expiresAt?: string;
}

const VAIF_CONFIG_DIR = path.join(os.homedir(), ".vaif");
const VAIF_AUTH_FILE = path.join(VAIF_CONFIG_DIR, "auth.json");
const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

function ensureConfigDir(): void {
  if (!fs.existsSync(VAIF_CONFIG_DIR)) {
    fs.mkdirSync(VAIF_CONFIG_DIR, { recursive: true });
  }
}

function saveAuthConfig(config: AuthConfig): void {
  ensureConfigDir();
  fs.writeFileSync(VAIF_AUTH_FILE, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(VAIF_AUTH_FILE, 0o600); // Only owner can read/write
}

export function loadAuthConfig(): AuthConfig | null {
  if (!fs.existsSync(VAIF_AUTH_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(VAIF_AUTH_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

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

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Mute output for password entry
    const stdin = process.stdin;
    const originalWrite = process.stdout.write.bind(process.stdout);
    let muted = false;

    process.stdout.write = ((...args: any[]) => {
      if (muted) {
        // Only suppress the echoed characters, not the prompt itself
        return true;
      }
      return originalWrite(...args);
    }) as typeof process.stdout.write;

    rl.question(question, (answer) => {
      muted = false;
      process.stdout.write = originalWrite;
      console.log(""); // New line after password
      rl.close();
      resolve(answer);
    });

    muted = true;
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;

  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (error) => {
    if (error) {
      // Silently fail - we already show the URL for manual copy
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validateToken(token: string): Promise<{ valid: boolean; email?: string }> {
  try {
    const response = await fetch(`${VAIF_API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, email: data.user?.email || data.email };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

async function browserLogin(projectId?: string): Promise<void> {
  const spinner = ora();

  // Step 1: Request a CLI auth session
  spinner.start("Setting up authentication...");

  let code: string;
  let authUrl: string;

  try {
    const response = await fetch(`${VAIF_API_URL}/auth/cli/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      spinner.fail("Failed to initiate authentication");
      console.log(chalk.red("\nCould not connect to VAIF API. Please try again later."));
      process.exit(1);
    }

    const data = await response.json();
    code = data.code;
    authUrl = data.url;
  } catch {
    spinner.fail("Failed to connect to VAIF API");
    console.log(chalk.red("\nCould not connect to VAIF API."));
    console.log(chalk.gray("Check your internet connection or try: vaif login --email"));
    process.exit(1);
  }

  spinner.stop();

  // Step 2: Open browser
  console.log(chalk.cyan("  Opening browser for authentication..."));
  console.log("");
  console.log(chalk.gray("  If the browser doesn't open, visit this URL:"));
  console.log(chalk.white(`  ${authUrl}`));
  console.log("");

  openBrowser(authUrl);

  // Step 3: Poll for completion
  spinner.start("Waiting for browser authentication...");

  const maxWaitMs = 120_000; // 2 minutes
  const pollIntervalMs = 2_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollIntervalMs);

    try {
      const response = await fetch(`${VAIF_API_URL}/auth/cli/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === "ExpiredCode" || data.error === "InvalidCode") {
          spinner.fail("Authentication expired");
          console.log(chalk.red("\nThe authentication session expired. Please try again."));
          process.exit(1);
        }
        continue;
      }

      const data = await response.json();

      if (data.ok && data.accessToken) {
        // Success!
        const authConfig: AuthConfig = {
          token: data.accessToken,
          email: data.user?.email,
          projectId,
          expiresAt: new Date(Date.now() + data.expiresIn * 1000).toISOString(),
        };

        saveAuthConfig(authConfig);

        spinner.succeed("Logged in successfully");
        console.log("");
        if (data.user?.email) {
          console.log(chalk.green(`  Authenticated as: ${data.user.email}`));
        }
        console.log(chalk.gray(`  Config saved to: ${VAIF_AUTH_FILE}`));
        console.log("");
        return;
      }

      // Still pending, continue polling
    } catch {
      // Network error, continue polling
    }
  }

  spinner.fail("Authentication timed out");
  console.log(chalk.red("\nTimed out waiting for browser authentication."));
  console.log(chalk.gray("Try again or use: vaif login --email"));
  process.exit(1);
}

async function emailLogin(projectId?: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("VAIF CLI Login"));
  console.log(chalk.gray("Enter your VAIF account credentials"));
  console.log("");

  const email = await prompt(chalk.cyan("  Email: "));
  if (!email || email.trim() === "") {
    console.log(chalk.red("\nNo email provided. Login cancelled."));
    process.exit(1);
  }

  const password = await promptPassword(chalk.cyan("  Password: "));
  if (!password || password.trim() === "") {
    console.log(chalk.red("\nNo password provided. Login cancelled."));
    process.exit(1);
  }

  const spinner = ora("Authenticating...").start();

  try {
    const response = await fetch(`${VAIF_API_URL}/auth/cli/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      spinner.fail("Login failed");
      console.log(chalk.red(`\n${data.message || "Invalid email or password."}`));
      process.exit(1);
    }

    const authConfig: AuthConfig = {
      token: data.accessToken,
      email: data.user?.email,
      projectId,
      expiresAt: new Date(Date.now() + data.expiresIn * 1000).toISOString(),
    };

    saveAuthConfig(authConfig);

    spinner.succeed("Logged in successfully");
    console.log("");
    if (data.user?.email) {
      console.log(chalk.green(`  Authenticated as: ${data.user.email}`));
    }
    console.log(chalk.gray(`  Config saved to: ${VAIF_AUTH_FILE}`));
    console.log("");
  } catch {
    spinner.fail("Failed to connect to VAIF API");
    console.log(chalk.red("\nCould not connect to VAIF API. Please try again later."));
    process.exit(1);
  }
}

export async function login(options: LoginOptions): Promise<void> {
  console.log("");
  console.log(chalk.bold("Welcome to VAIF CLI"));
  console.log(chalk.gray("Authenticate to access your VAIF projects"));
  console.log("");

  if (options.email) {
    // Email/password fallback
    await emailLogin(options.projectId);
  } else {
    // Default: browser-based OAuth flow
    await browserLogin(options.projectId);
  }

  console.log(chalk.gray("You can now use VAIF CLI commands like:"));
  console.log(chalk.gray("  vaif pull    - Pull remote schema"));
  console.log(chalk.gray("  vaif push    - Push schema changes"));
  console.log(chalk.gray("  vaif generate - Generate TypeScript types"));
  console.log("");
}

export async function logout(): Promise<void> {
  if (fs.existsSync(VAIF_AUTH_FILE)) {
    fs.unlinkSync(VAIF_AUTH_FILE);
    console.log(chalk.green("Logged out successfully"));
  } else {
    console.log(chalk.yellow("Not currently logged in"));
  }
}

export async function whoami(): Promise<void> {
  const auth = loadAuthConfig();

  if (!auth || !auth.token) {
    console.log(chalk.yellow("Not logged in"));
    console.log(chalk.gray("Run `vaif login` to authenticate"));
    process.exit(1);
  }

  const spinner = ora("Checking authentication...").start();

  const { valid, email } = await validateToken(auth.token);

  if (!valid) {
    spinner.fail("Session expired");
    console.log(chalk.yellow("\nYour session has expired. Please login again."));
    process.exit(1);
  }

  spinner.succeed("Authenticated");
  console.log("");
  console.log(chalk.green(`  Email: ${email || auth.email || "Unknown"}`));
  if (auth.projectId) {
    console.log(chalk.green(`  Project: ${auth.projectId}`));
  }
  console.log("");
}
