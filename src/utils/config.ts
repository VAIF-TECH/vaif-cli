import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export interface VaifConfig {
  projectId?: string;
  database?: {
    url?: string;
    schema?: string;
  };
  types?: {
    output?: string;
  };
  api?: {
    baseUrl?: string;
    apiKey?: string;
  };
}

export async function loadConfig(configPath: string): Promise<VaifConfig | null> {
  const resolvedPath = path.resolve(configPath);

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(resolvedPath, "utf-8");
    const config: VaifConfig = JSON.parse(content);

    // Interpolate environment variables
    if (config.database?.url) {
      config.database.url = interpolateEnvVars(config.database.url);
    }

    if (config.api?.apiKey) {
      config.api.apiKey = interpolateEnvVars(config.api.apiKey);
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to parse config file: ${configPath}`);
  }
}

function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    return process.env[envVar] || match;
  });
}

export function getProjectRoot(): string {
  let currentDir = process.cwd();

  // Walk up looking for package.json
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}
