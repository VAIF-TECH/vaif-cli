#!/usr/bin/env node
import "dotenv/config";
import { createRequire } from "node:module";
import { program } from "commander";
import chalk from "chalk";
import { generateTypes } from "./commands/generate.js";
import { initConfig } from "./commands/init.js";
import { login, logout, whoami } from "./commands/login.js";
import { pull } from "./commands/pull.js";
import { push } from "./commands/push.js";
import { deploy as functionsDeploy, list as functionsList } from "./commands/functions.js";
import { seed as dbSeed, reset as dbReset, dbPush, dbPull } from "./commands/db.js";
import { generateKey, listKeys } from "./commands/keys.js";
import { setSecret, listSecrets, getSecret, deleteSecret } from "./commands/secrets.js";
import { info } from "./commands/info.js";
import { status } from "./commands/status.js";
import { listTemplates } from "./commands/templates.js";
import { claudeSetup } from "./commands/claude-setup.js";
import { migrate } from "./commands/migrate.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json");

// Neon cyber gradient for the VAIF brand
const g1 = chalk.hex("#00f0ff"); // cyan
const g2 = chalk.hex("#7b61ff"); // purple
const g3 = chalk.hex("#ff3dff"); // magenta
const g4 = chalk.hex("#00ff9d"); // green
const dim = chalk.hex("#555570");
const accent = chalk.hex("#00f0ff");

function showBanner() {
  console.log("");
  console.log(g1("  ╦  ╦") + g2("╔═╗╦") + g3("╔═╗  ") + g4("╔═╗╦  ╦"));
  console.log(g1("  ╚╗╔╝") + g2("╠═╣║") + g3("╠╣   ") + g4("║  ║  ║"));
  console.log(g1("   ╚╝ ") + g2("╩ ╩╩") + g3("╚    ") + g4("╚═╝╩═╝╩"));
  console.log("");
  console.log(dim("  ─────────────────────────────────────────"));
  console.log(accent("  VAIF Studio CLI") + dim(` v${VERSION}`));
  console.log(dim("  Build full-stack apps at lightning speed"));
  console.log(dim("  ─────────────────────────────────────────"));
  console.log("");
  console.log(chalk.bold("  Quick Start"));
  console.log(dim("  $ ") + accent("vaif login") + dim("                    Authenticate"));
  console.log(dim("  $ ") + accent("vaif init -t react-spa") + dim("       Scaffold project"));
  console.log(dim("  $ ") + accent("vaif db push") + dim("                 Push migrations"));
  console.log(dim("  $ ") + accent("vaif generate") + dim("                Generate types"));
  console.log(dim("  $ ") + accent("vaif functions deploy") + dim("        Deploy functions"));
  console.log("");
  console.log(chalk.bold("  Categories"));
  console.log(dim("    auth     ") + chalk.white("login, logout, whoami"));
  console.log(dim("    project  ") + chalk.white("init, templates, info, status"));
  console.log(dim("    schema   ") + chalk.white("pull, push, generate"));
  console.log(dim("    database ") + chalk.white("db push, db pull, db seed, db reset"));
  console.log(dim("    deploy   ") + chalk.white("functions deploy, functions list"));
  console.log(dim("    security ") + chalk.white("keys, secrets"));
  console.log(dim("    migrate  ") + chalk.white("migrate --from supabase|firebase"));
  console.log(dim("    ai       ") + chalk.white("claude-setup, init --claude"));
  console.log("");
  console.log(dim("  Run ") + accent("vaif <command> --help") + dim(" for details"));
  console.log(dim("  Docs: ") + chalk.underline("https://docs.vaif.studio"));
  console.log("");
}

program
  .name("vaif")
  .description("VAIF CLI - Type generation and development tools")
  .version(VERSION);

// ============ AUTHENTICATION ============

// Login
program
  .command("login")
  .description("Authenticate with VAIF (opens browser)")
  .option("-e, --email", "Login with email/password instead of browser")
  .option("-p, --project-id <id>", "Default project ID")
  .action(login);

// Logout
program
  .command("logout")
  .description("Log out and remove stored credentials")
  .action(logout);

// Whoami
program
  .command("whoami")
  .description("Show current authenticated user")
  .action(whoami);

// ============ PROJECT SETUP ============

// Initialize VAIF config
program
  .command("init")
  .description("Initialize VAIF configuration in your project")
  .option("--typescript", "Setup for TypeScript project")
  .option("-f, --force", "Overwrite existing config")
  .option("-t, --template <name>", "Scaffold from a template (run vaif templates for list)")
  .option("--features <features>", "Comma-separated features to include: auth,database,realtime,storage,functions")
  .option("--add-features <features>", "Add features to an existing project (requires --template)")
  .option("--claude [type]", "Generate CLAUDE.md for AI assistants (types: base, saas, mobile, ecommerce). Omit type to auto-detect or use live project data.")
  .action(initConfig);

// List available templates
program
  .command("templates")
  .alias("tpl")
  .description("List available project templates")
  .action(listTemplates);

// ============ PROJECT INFO ============

// Show project info
program
  .command("info")
  .description("Show project information (name, region, URLs)")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .action(info);

// Show project status
program
  .command("status")
  .description("Show project status (tables, functions, storage, connections)")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .action(status);

// ============ SCHEMA MANAGEMENT ============

// Pull schema from remote
program
  .command("pull")
  .description("Pull database schema from your VAIF project")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-o, --output <path>", "Output file path", "vaif.schema.json")
  .option("-s, --schema <name>", "Schema name", "public")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .action(pull);

// Push schema changes to remote
program
  .command("push")
  .description("Push local schema changes to your VAIF project")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-s, --schema <path>", "Schema file path", "vaif.schema.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("--dry-run", "Preview changes without applying")
  .option("-f, --force", "Apply changes without confirmation")
  .action(push);

// ============ TYPE GENERATION ============

// Generate types from database schema
program
  .command("generate")
  .alias("gen")
  .description("Generate TypeScript types from your database schema")
  .option("-c, --connection <url>", "Database connection string")
  .option("-o, --output <path>", "Output file path", "./src/types/database.ts")
  .option("--schema <name>", "Schema name", "public")
  .option("--config <path>", "Config file path", "vaif.config.json")
  .option("--dry-run", "Preview generated types without writing")
  .action(generateTypes);

// ============ FUNCTIONS ============

// Functions subcommand
const functionsCmd = program
  .command("functions")
  .alias("fn")
  .description("Manage serverless functions");

// Deploy functions
functionsCmd
  .command("deploy")
  .description("Deploy functions to your VAIF project")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-e, --env-id <id>", "Environment ID")
  .option("-n, --name <name>", "Function name filter")
  .option("-r, --runtime <runtime>", "Runtime (nodejs, typescript, python)")
  .option("--entrypoint <file>", "Specific entrypoint file")
  .option("--dry-run", "Preview deployment without deploying")
  .action(functionsDeploy);

// List functions
functionsCmd
  .command("list")
  .alias("ls")
  .description("List deployed functions")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-e, --env-id <id>", "Environment ID")
  .action(functionsList);

// ============ DATABASE ============

// Database subcommand
const dbCmd = program
  .command("db")
  .description("Database management commands");

// Push local migrations
dbCmd
  .command("push")
  .description("Push local Drizzle migrations to VAIF project")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-d, --dir <path>", "Migrations directory", "./drizzle")
  .option("--dry-run", "Preview without applying")
  .action(dbPush);

// Pull schema from remote
dbCmd
  .command("pull")
  .description("Pull schema from VAIF project")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-o, --output <path>", "Output file", "vaif.schema.json")
  .action(dbPull);

// Seed database
dbCmd
  .command("seed")
  .description("Seed your database with test data")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-f, --file <path>", "Specific seed file")
  .option("-t, --table <name>", "Seed specific table only")
  .option("--truncate", "Truncate tables before seeding")
  .option("--dry-run", "Preview seeding without inserting data")
  .action(dbSeed);

// Reset database
dbCmd
  .command("reset")
  .description("Reset database (drop all tables and data)")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-f, --force", "Confirm reset (required)")
  .action(dbReset);

// ============ API KEYS ============

// Keys subcommand
const keysCmd = program
  .command("keys")
  .description("Manage API keys");

// Generate a new key
keysCmd
  .command("generate")
  .description("Generate a new API key")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-n, --name <name>", "Key name")
  .action(generateKey);

// List keys
keysCmd
  .command("list")
  .alias("ls")
  .description("List API keys")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .action(listKeys);

// ============ SECRETS ============

// Secrets subcommand
const secretsCmd = program
  .command("secrets")
  .alias("sec")
  .description("Manage function secrets");

// Set a secret
secretsCmd
  .command("set <name> [value]")
  .description("Create or update a secret")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-e, --env-id <id>", "Environment ID or name")
  .option("--from-file <path>", "Read secret value from a file")
  .action(setSecret);

// List secrets
secretsCmd
  .command("list")
  .alias("ls")
  .description("List all secrets (names only)")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-e, --env-id <id>", "Environment ID or name")
  .action(listSecrets);

// Get a secret value
secretsCmd
  .command("get <name>")
  .description("Reveal a secret value")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-e, --env-id <id>", "Environment ID or name")
  .action(getSecret);

// Delete a secret
secretsCmd
  .command("delete <name>")
  .description("Delete a secret")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID (overrides config)")
  .option("-e, --env-id <id>", "Environment ID or name")
  .action(deleteSecret);

// ============ MIGRATION ============

// Migrate from another platform
program
  .command("migrate")
  .description("Migrate from Supabase or Firebase to VAIF Studio")
  .requiredOption("--from <platform>", "Source platform: supabase or firebase")
  .option("--dry-run", "Show migration plan without executing")
  .option("-c, --config <path>", "VAIF config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Target VAIF project ID")
  .option("-o, --output-dir <dir>", "Source project directory to analyze", ".")
  .action(migrate);

// ============ AI INTEGRATIONS ============

// Claude Code setup
program
  .command("claude-setup")
  .description("Configure Claude Code integration (MCP server + CLAUDE.md)")
  .option("-c, --config <path>", "Config file path", "vaif.config.json")
  .option("-p, --project-id <id>", "Project ID")
  .option("-k, --api-key <key>", "API key for MCP server")
  .option("--skip-mcp", "Skip generating .mcp.json")
  .option("--skip-claude-md", "Skip generating CLAUDE.md")
  .option("-o, --output-dir <dir>", "Output directory", ".")
  .action(claudeSetup);

// Show branded banner if no command provided
if (!process.argv.slice(2).length) {
  showBanner();
  process.exit(0);
}

// Parse and execute
program.parse(process.argv);
