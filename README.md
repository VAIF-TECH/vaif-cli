# @vaiftech/cli

[![npm version](https://img.shields.io/npm/v/@vaiftech/cli)](https://www.npmjs.com/package/@vaiftech/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Command-line tools for [VAIF Studio](https://vaif.studio) (v1.10.0) — scaffold full projects from templates with feature selection, browser-based authentication, manage schemas, deploy functions, generate TypeScript types, migrate from Supabase/Firebase, and more.

## Installation

```bash
npm install -g @vaiftech/cli
# or use directly with npx
npx @vaiftech/cli init --template react-spa
```

## Quick Start

```bash
# Authenticate (opens browser)
vaif login

# Scaffold a new project from a template
vaif init --template nextjs-fullstack

# Scaffold with specific features
vaif init --template react-spa --features auth,realtime,storage

# Migrate from another platform
vaif migrate --from supabase --dry-run

# Generate CLAUDE.md for AI assistants
vaif init --claude

# Pull your database schema and generate types
vaif pull
vaif generate

# Deploy functions
vaif functions deploy
```

## Authentication

VAIF CLI uses **browser-based authentication** by default. Running `vaif login` opens your browser to authenticate with your VAIF account, then the CLI receives the session automatically.

```bash
# Default: browser-based login (recommended)
vaif login

# Fallback: email/password login
vaif login --email

# Check current session
vaif whoami

# Log out
vaif logout
```

The browser flow works by:
1. CLI requests a temporary auth code from the VAIF API
2. Your browser opens to the VAIF login/authorization page
3. After you approve, the CLI receives your session token
4. Credentials are saved securely to `~/.vaif/auth.json`

If the browser doesn't open automatically, the CLI prints the URL for you to copy.

## Templates

Scaffold a fully configured VAIF Studio project with one command:

```bash
vaif init --template <name>
```

### Available Templates

| Template | Description | Ecosystem |
|----------|-------------|-----------|
| `nextjs-fullstack` | Next.js app with server/client VAIF client, auth middleware, and React hooks | Next.js |
| `react-spa` | React SPA with VaifProvider, hooks for queries/mutations, and env setup | React / Vite |
| `ios-swift-app` | iOS app with VaifManager singleton, SwiftUI auth, and database helpers | Swift / iOS |
| `expo-mobile-app` | React Native / Expo with realtime hooks, storage uploads, and push notifications | Expo |
| `flutter-app` | Flutter app with VaifClient, auth flows, and typed database queries | Flutter / Dart |
| `python-fastapi-backend` | FastAPI server with VAIF auth middleware, database queries, and storage uploads | Python |
| `go-backend-api` | Go HTTP server with VAIF client, auth verification, and webhook handling | Go |
| `todo-app` | Minimal React + VAIF starter for learning the basics | React |
| `realtime-chat` | Real-time messaging app with presence tracking and live subscriptions | React |
| `saas-starter` | SaaS foundation with teams, org management, auth, and billing hooks | React / Node.js |
| `ecommerce-api` | E-commerce backend with products, orders, Stripe webhooks, and inventory | Node.js |

```bash
# List all templates with descriptions
vaif templates

# Scaffold and overwrite existing files
vaif init --template expo-mobile-app --force
```

### Feature Selection

Templates support **feature selection** to include only the VAIF modules you need. Specify features with `--features` or use the interactive selector:

```bash
# Specify features directly
vaif init --template react-spa --features auth,realtime,storage

# Interactive feature selection (prompted when --features is omitted)
vaif init --template nextjs-fullstack
# → Presents checkbox UI to pick: Database, Auth, Realtime, Storage, Functions
```

#### Available Features

| Feature | What it adds |
|---------|-------------|
| `database` | CRUD queries, type-safe database operations |
| `auth` | Login, signup, OAuth, session management pages |
| `realtime` | Live subscriptions, presence tracking hooks |
| `storage` | File upload/download, signed URL helpers |
| `functions` | Serverless function invocation utilities |

Each template has sensible defaults (e.g. `nextjs-fullstack` defaults to `database` + `auth`), but you can customize freely. Feature-specific files are only generated when the feature is selected — for example, selecting `auth` adds login/signup pages and the `@vaiftech/auth` dependency, selecting `storage` adds upload hooks.

If a `package.json` already exists in your directory, the CLI merges the template's dependencies into it instead of overwriting it.

### What Templates Generate

Templates generate **complete project scaffolding** with everything you need to start building:

**Every template includes:**
- `README.md` — Step-by-step setup guide (credentials, login, migrations, functions, running)
- `package.json` (or equivalent) — All dependencies pre-configured
- `vaif.config.json` — VAIF project configuration
- `.env.example` — Environment variables template
- Client initialization and integration files

**With features selected, templates also include:**
- **database**: Drizzle migration (`drizzle/0001_initial.sql`), schema file, and config
- **auth**: Login/signup pages, auth guard component
- **realtime**: Subscription hooks with live data
- **storage**: File upload/download hooks
- **functions**: Example serverless function (`functions/hello.ts`) ready to deploy

**Native/Backend templates** include platform-specific equivalents (Python models, Go structs, Dart classes, Swift managers).

## Commands

### Authentication

```bash
vaif login                           # Browser-based login (opens browser)
vaif login --email                   # Email/password login
vaif login --project-id <id>        # Login and set default project
vaif whoami                          # Show current user
vaif logout                          # Log out
```

### Project Setup

```bash
vaif init                            # Create vaif.config.json
vaif init --template react-spa       # Scaffold from template
vaif init --template nextjs-fullstack --features auth,storage
vaif init --typescript               # Setup for TypeScript
vaif init --force                    # Overwrite existing config
vaif init --claude                   # Auto-detect project type + generate CLAUDE.md from live data
vaif init --claude saas              # Generate CLAUDE.md from static template (base|saas|mobile|ecommerce)
```

### Add Features to Existing Project

Add features you didn't include during initial scaffolding:

```bash
vaif init --template react-spa --add-features functions
vaif init --template react-spa --add-features functions,storage
```

This only creates the feature-specific files (e.g., `functions/hello.ts`) without touching existing files.

### Templates

```bash
vaif templates                       # List all available templates
vaif tpl                             # Alias
```

### Project Info

```bash
vaif info                            # Project details (name, region, URLs)
vaif status                          # Tables, functions, storage, connections
```

### Schema Management

```bash
vaif pull                            # Pull database schema from remote
vaif push                            # Push local schema changes
vaif push --dry-run                  # Preview changes without applying
```

### Type Generation

```bash
vaif generate                        # Generate TypeScript types
vaif generate --output ./types.ts    # Custom output path
vaif generate --dry-run              # Preview without writing
vaif gen                             # Alias
```

### Functions

```bash
vaif functions deploy                # Deploy all functions
vaif functions deploy --name myFunc  # Deploy specific function
vaif functions list                  # List deployed functions
vaif fn ls                           # Alias
```

### Database

```bash
vaif db push                         # Push Drizzle migrations
vaif db pull                         # Pull remote schema
vaif db seed                         # Seed with test data
vaif db seed --truncate              # Truncate before seeding
vaif db reset --force                # Reset database (destructive)
```

### API Keys

```bash
vaif keys generate                   # Generate new API key
vaif keys generate --name "Prod"     # Named key
vaif keys list                       # List all keys
```

### Secrets

Manage encrypted secrets that your VAIF Functions can access at runtime. Secret values are encrypted at rest and injected into function invocations automatically.

```bash
vaif secrets set API_KEY YOUR_API_KEY    # Create or update a secret
vaif secrets set CERT --from-file cert.pem  # Set secret from file
vaif secrets list                      # List secret names (values hidden)
vaif secrets get API_KEY               # Reveal a secret value
vaif secrets delete API_KEY            # Delete a secret
vaif sec ls                            # Alias
```

All secrets commands accept `--project-id` and `--env-id` flags to target a specific project and environment.

#### How Functions Access Secrets

Secrets are automatically injected into your function's execution context. Access them via `process.env` or the `secrets` parameter depending on your runtime:

```typescript
// functions/hello.ts
export default async function handler(req, ctx) {
  const apiKey = ctx.secrets.API_KEY;
  // Use the secret...
}
```

### Migration from Other Platforms

Migrate your project from Supabase or Firebase to VAIF Studio. The CLI analyzes your local project files, builds a migration plan, and optionally executes it via the VAIF API.

```bash
vaif migrate --from supabase         # Analyze Supabase project + show migration plan
vaif migrate --from firebase         # Analyze Firebase project + show migration plan
vaif migrate --from supabase --dry-run  # Preview plan without executing
vaif migrate --from firebase -p <id> # Specify target VAIF project
vaif migrate --from supabase -o ./my-supabase-app  # Analyze a different directory
```

**Supabase migration reads:**
- `supabase/migrations/*.sql` — Table schemas, indexes, RLS policies
- `supabase/config.toml` — Project configuration
- `supabase/.temp/project-ref` — Project reference
- `supabase/functions/` — Edge functions

**Firebase migration reads:**
- `firebase.json` — Hosting, functions, Firestore, storage config
- `.firebaserc` — Project aliases
- `firestore.rules` — Security rules (translated to RLS policies)
- `functions/src/index.ts` — Cloud functions

The migration plan shows tables, storage buckets, functions, and notes. In dry-run mode, it also saves the plan to `migration-plan.md`. When executed, it creates tables, buckets, and function stubs via the VAIF API.

### CLAUDE.md Generation

Generate a `CLAUDE.md` file for AI assistants to understand your project:

```bash
vaif init --claude                   # Auto-detect project type, generate from live project data
vaif init --claude base              # Static template: universal project
vaif init --claude saas              # Static template: SaaS with billing, teams, multi-tenancy
vaif init --claude mobile            # Static template: mobile app (React Native, Expo, Flutter)
vaif init --claude ecommerce         # Static template: e-commerce with products, orders, Stripe
```

**Auto-detection** examines `package.json` dependencies and directory structure to determine project type (mobile, ecommerce, saas, or base) and generates a tailored CLAUDE.md with live project data.

**Convention import**: When using a static template, the CLI automatically imports team conventions from existing AI config files (`.cursorrules`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`) and appends them to the generated CLAUDE.md.

For a fully personalized CLAUDE.md from your live project data (database schema, API keys, etc.), use:

```bash
vaif claude-setup
```

### Claude Code Integration

Set up [Claude Code](https://claude.ai/claude-code) to work with your VAIF project. This generates a `.mcp.json` (MCP server config) and a `CLAUDE.md` (project context with your full database schema, SDK examples, and API reference).

```bash
vaif claude-setup                     # Auto-configure everything
vaif claude-setup --project-id <id>   # Specify project
vaif claude-setup --skip-mcp          # Only generate CLAUDE.md
vaif claude-setup --skip-claude-md    # Only generate .mcp.json
vaif claude-setup -o ./my-app         # Custom output directory
```

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <path>` | Config file path | `vaif.config.json` |
| `-p, --project-id <id>` | Project ID | from config/env |
| `-k, --api-key <key>` | API key for MCP server | auto-generated |
| `--skip-mcp` | Skip generating `.mcp.json` | `false` |
| `--skip-claude-md` | Skip generating `CLAUDE.md` | `false` |
| `-o, --output-dir <dir>` | Output directory | `.` |

**Generated files:**

- **`.mcp.json`** — Configures the `@vaiftech/mcp` server so Claude Code can query your database, manage schema, upload files, invoke functions, and more.
- **`CLAUDE.md`** — Gives Claude full context about your project: SDK setup with your actual API key, complete database schema with types and constraints, CRUD examples using your real table names, auth/storage/realtime/functions usage patterns, row-level security (RLS), storage policies, edge function deployment, API key management, secrets management, filter/pagination reference, JSONB subkey filters, compound filters (AND+OR), full-text search, aggregation, FK joins, upsert, `vaif.auth` context in functions, function-to-function invocation, and database triggers.

The MCP server also includes guided prompts (`setup-backend`, `add-feature`, `generate-api-code`, `debug-query`) accessible via `/mcp` in Claude Code.

## Configuration

`vaif.config.json` (created by `vaif init`):

```json
{
  "$schema": "https://vaif.studio/schemas/config.json",
  "projectId": "your-project-id",
  "database": {
    "url": "${DATABASE_URL}",
    "schema": "public"
  },
  "types": {
    "output": "./src/types/database.ts"
  },
  "api": {
    "baseUrl": "https://api.vaif.studio"
  }
}
```

## Environment Variables

The CLI automatically loads `.env` files from the current directory. You can set these variables in your `.env` or export them in your shell:

| Variable | Description |
|----------|-------------|
| `VAIF_API_URL` | API base URL (default: `https://api.vaif.studio`) |
| `VAIF_TOKEN` | API token (alternative to `vaif login`) |
| `VAIF_PROJECT_ID` | Default project ID (also read from `vaif.config.json`) |
| `VITE_VAIF_PROJECT_ID` | Project ID for Vite-based templates (React SPA) |
| `NEXT_PUBLIC_VAIF_PROJECT_ID` | Project ID for Next.js templates |

Project ID resolution order: `--project-id` flag > `vaif.config.json` > `VAIF_PROJECT_ID` env var > login session.

## Related Packages

| Package | Description |
|---------|-------------|
| [@vaif/client](https://www.npmjs.com/package/@vaif/client) | TypeScript SDK — database, auth, realtime, storage, functions |
| [@vaiftech/auth](https://www.npmjs.com/package/@vaiftech/auth) | Standalone auth SDK — OAuth, MFA, sessions |
| [@vaiftech/react](https://www.npmjs.com/package/@vaiftech/react) | React hooks — useAuth, useQuery, useRealtime |
| [@vaiftech/sdk-expo](https://www.npmjs.com/package/@vaiftech/sdk-expo) | React Native / Expo SDK |

## Documentation

Full documentation at [docs.vaif.studio](https://docs.vaif.studio).

## License

MIT
