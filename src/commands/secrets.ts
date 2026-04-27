import fs from "fs";
import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface SecretsOptions {
  config?: string;
  projectId?: string;
  envId?: string;
}

interface SetSecretOptions extends SecretsOptions {
  fromFile?: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

function resolveProjectId(
  options: { projectId?: string },
  config: VaifConfig | null,
  auth: { projectId?: string }
): string | null {
  return options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId || null;
}

function ensureAuth(): { token: string; projectId?: string } {
  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray("Run `vaif login` first to authenticate"));
    process.exit(1);
  }
  return auth;
}

async function loadProjectConfig(configPath?: string): Promise<VaifConfig | null> {
  try {
    return await loadConfig(configPath || "vaif.config.json");
  } catch {
    return null;
  }
}

function ensureProjectId(
  options: SecretsOptions,
  config: VaifConfig | null,
  auth: { projectId?: string }
): string {
  const projectId = resolveProjectId(options, config, auth);
  if (!projectId) {
    console.log(chalk.red("No project ID specified"));
    console.log(
      chalk.yellow("Set projectId in vaif.config.json or use --project-id flag.")
    );
    process.exit(1);
  }
  return projectId;
}

export async function setSecret(
  name: string,
  value: string | undefined,
  options: SetSecretOptions
): Promise<void> {
  const spinner = ora();
  const auth = ensureAuth();
  const config = await loadProjectConfig(options.config);
  const projectId = ensureProjectId(options, config, auth);

  // Resolve value from --from-file if provided
  let secretValue = value;
  if (options.fromFile) {
    try {
      secretValue = fs.readFileSync(options.fromFile, "utf-8");
    } catch (error) {
      console.log(chalk.red(`Failed to read file: ${options.fromFile}`));
      if (error instanceof Error) {
        console.log(chalk.gray(error.message));
      }
      process.exit(1);
    }
  }

  if (!secretValue) {
    console.log(chalk.red("No value provided"));
    console.log(
      chalk.gray("Provide a value as argument or use --from-file <path>")
    );
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold("VAIF Set Secret"));
  console.log("");

  // First check if a secret with this name already exists
  spinner.start("Checking for existing secret...");

  try {
    const listUrl = new URL(
      `${VAIF_API_URL}/functions/secrets/project/${projectId}`
    );
    if (options.envId) {
      listUrl.searchParams.set("envId", options.envId);
    }

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to check existing secrets: ${await listResponse.text()}`);
    }

    const existingSecrets: Array<{ id: string; key: string }> =
      await listResponse.json();
    const existing = existingSecrets.find((s) => s.key === name);

    if (existing) {
      // Update existing secret
      spinner.text = `Updating secret "${name}"...`;

      const updateResponse = await fetch(
        `${VAIF_API_URL}/functions/secrets/${existing.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: secretValue }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(
          `Failed to update secret: ${await updateResponse.text()}`
        );
      }

      spinner.succeed(`Updated secret "${name}"`);
    } else {
      // Create new secret
      spinner.text = `Creating secret "${name}"...`;

      const createResponse = await fetch(`${VAIF_API_URL}/functions/secrets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          envId: options.envId,
          key: name,
          value: secretValue,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(
          `Failed to create secret: ${await createResponse.text()}`
        );
      }

      spinner.succeed(`Created secret "${name}"`);
    }

    console.log("");
  } catch (error) {
    spinner.fail("Failed to set secret");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

export async function listSecrets(options: SecretsOptions): Promise<void> {
  const spinner = ora();
  const auth = ensureAuth();
  const config = await loadProjectConfig(options.config);
  const projectId = ensureProjectId(options, config, auth);

  console.log("");
  console.log(chalk.bold("VAIF Secrets"));
  console.log("");

  spinner.start("Fetching secrets...");

  try {
    const url = new URL(
      `${VAIF_API_URL}/functions/secrets/project/${projectId}`
    );
    if (options.envId) {
      url.searchParams.set("envId", options.envId);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list secrets: ${await response.text()}`);
    }

    const secrets: Array<{
      id: string;
      key: string;
      envId: string | null;
      createdAt: string;
    }> = await response.json();
    spinner.stop();

    if (secrets.length === 0) {
      console.log(chalk.yellow("No secrets found"));
      console.log(chalk.gray("\nCreate one with: vaif secrets set <name> <value>"));
      return;
    }

    // Display table
    const nameWidth = Math.max(8, ...secrets.map((s) => s.key.length));
    const header = `  ${"Name".padEnd(nameWidth)}  ${"Created"}`;
    console.log(chalk.gray(header));
    console.log(chalk.gray("  " + "-".repeat(header.length - 2)));

    for (const secret of secrets) {
      const name = secret.key.padEnd(nameWidth);
      const created = secret.createdAt
        ? new Date(secret.createdAt).toLocaleDateString()
        : "N/A";
      console.log(`  ${name}  ${created}`);
    }

    console.log("");
    console.log(chalk.gray(`  ${secrets.length} secret(s) total`));
    console.log(
      chalk.gray("  Values are hidden. Use `vaif secrets get <name>` to reveal.")
    );
    console.log("");
  } catch (error) {
    spinner.fail("Failed to list secrets");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

export async function getSecret(
  name: string,
  options: SecretsOptions
): Promise<void> {
  const spinner = ora();
  const auth = ensureAuth();
  const config = await loadProjectConfig(options.config);
  const projectId = ensureProjectId(options, config, auth);

  console.log("");

  spinner.start("Fetching secret...");

  try {
    // First find the secret by name
    const listUrl = new URL(
      `${VAIF_API_URL}/functions/secrets/project/${projectId}`
    );
    if (options.envId) {
      listUrl.searchParams.set("envId", options.envId);
    }

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch secrets: ${await listResponse.text()}`);
    }

    const secrets: Array<{ id: string; key: string }> =
      await listResponse.json();
    const secret = secrets.find((s) => s.key === name);

    if (!secret) {
      spinner.fail(`Secret "${name}" not found`);
      process.exit(1);
    }

    // Reveal the value
    const valueResponse = await fetch(
      `${VAIF_API_URL}/functions/secrets/${secret.id}/value`,
      {
        headers: { Authorization: `Bearer ${auth.token}` },
      }
    );

    if (!valueResponse.ok) {
      throw new Error(
        `Failed to get secret value: ${await valueResponse.text()}`
      );
    }

    const data: { value: string } = await valueResponse.json();
    spinner.stop();

    console.log(data.value);
  } catch (error) {
    spinner.fail("Failed to get secret");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

export async function deleteSecret(
  name: string,
  options: SecretsOptions
): Promise<void> {
  const spinner = ora();
  const auth = ensureAuth();
  const config = await loadProjectConfig(options.config);
  const projectId = ensureProjectId(options, config, auth);

  console.log("");
  console.log(chalk.bold("VAIF Delete Secret"));
  console.log("");

  spinner.start("Finding secret...");

  try {
    // Find the secret by name
    const listUrl = new URL(
      `${VAIF_API_URL}/functions/secrets/project/${projectId}`
    );
    if (options.envId) {
      listUrl.searchParams.set("envId", options.envId);
    }

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to fetch secrets: ${await listResponse.text()}`);
    }

    const secrets: Array<{ id: string; key: string }> =
      await listResponse.json();
    const secret = secrets.find((s) => s.key === name);

    if (!secret) {
      spinner.fail(`Secret "${name}" not found`);
      process.exit(1);
    }

    // Delete it
    spinner.text = `Deleting secret "${name}"...`;

    const deleteResponse = await fetch(
      `${VAIF_API_URL}/functions/secrets/${secret.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      }
    );

    if (!deleteResponse.ok) {
      throw new Error(
        `Failed to delete secret: ${await deleteResponse.text()}`
      );
    }

    spinner.succeed(`Deleted secret "${name}"`);
    console.log("");
  } catch (error) {
    spinner.fail("Failed to delete secret");
    if (error instanceof Error) {
      console.log(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}
