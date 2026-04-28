# @vaif/cli

[![npm version](https://img.shields.io/npm/v/@vaif/cli)](https://www.npmjs.com/package/@vaif/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Command-line tools for [VAIF Studio](https://vaif.studio) — scaffold full projects from templates with feature selection, browser-based authentication, manage schemas, deploy functions, generate TypeScript types, migrate from Supabase/Firebase, and configure Claude Code integration.

## Installation

```bash
npm install -g @vaif/cli
# or use directly with npx
npx @vaif/cli init --template react-spa
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
| `nextjs-fullstack` | Next.js app with server/client VAIF client and React hooks | Next.js |
| `react-spa` | React SPA with hooks for queries/mutations and env setup | React / Vite |
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

Templates support **feature selection** to include only the VAIF modules you need:

```bash
vaif init --template react-spa --features auth,realtime,storage
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

Generated code uses the official `@vaif/client` SDK (auth + database + realtime + storage + functions in a single package). React templates additionally use `@vaif/react` for hooks. Templates do not depend on the deprecated `@vaiftech/*` packages.

If a `package.json` already exists in your directory, the CLI merges the template's dependencies into it instead of overwriting.

### What Templates Generate

**Every template includes:**
- `README.md` — Step-by-step setup guide (credentials, login, migrations, functions, running)
- `package.json` (or equivalent) — All dependencies pre-configured
- `vaif.config.json` — VAIF project configuration
- `.env.example` — Environment variables template
- Client initialization and integration files

## Commands

### Authentication

```bash
vaif login                           # Browser-based login (opens browser)
vaif login --email                   # Email/password login
vaif login --project-id <id>         # Login and set default project
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
vaif init --claude saas              # Static template: base|saas|mobile|ecommerce
```

### Add Features to Existing Project

```bash
vaif init --template react-spa --add-features functions,storage
```

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

VAIF API keys use the unified `vaif_*` prefix (e.g. `vaif_xxxxxxxxxxxx`). Legacy `vk_*`, `vaif_pk_*`, and `vaif_sk_*` prefixes are deprecated — run `npx @vaif/migrate` to update existing code.

### Secrets

Manage encrypted secrets that your VAIF Functions can access at runtime.

```bash
vaif secrets set API_KEY YOUR_API_KEY
vaif secrets set CERT --from-file cert.pem
vaif secrets list
vaif secrets get API_KEY
vaif secrets delete API_KEY
vaif sec ls                          # Alias
```

All secrets commands accept `--project-id` and `--env-id` flags.

### Migration from Other Platforms

```bash
vaif migrate --from supabase
vaif migrate --from firebase
vaif migrate --from supabase --dry-run
```

**Supabase migration reads:** `supabase/migrations/*.sql`, `supabase/config.toml`, `supabase/.temp/project-ref`, `supabase/functions/`.

**Firebase migration reads:** `firebase.json`, `.firebaserc`, `firestore.rules`, `functions/src/index.ts`.

### CLAUDE.md Generation

```bash
vaif init --claude                   # Auto-detect project type, generate from live project data
vaif init --claude base              # Static template: universal project
vaif init --claude saas              # Static template: SaaS with billing, teams
vaif init --claude mobile            # Static template: mobile app (RN/Expo, Flutter)
vaif init --claude ecommerce         # Static template: e-commerce with products, orders, Stripe
```

### Claude Code Integration

```bash
vaif claude-setup                     # Auto-configure everything
vaif claude-setup --project-id <id>
vaif claude-setup --skip-mcp
vaif claude-setup --skip-claude-md
vaif claude-setup -o ./my-app
```

Generates `.mcp.json` (configures `@vaif/mcp` so Claude Code can talk to your VAIF project) and `CLAUDE.md` (project context with schema, SDK examples, API reference).

## Configuration

`vaif.config.json` (created by `vaif init`):

```json
{
  "$schema": "https://raw.githubusercontent.com/VAIF-TECH/vaif-cli/main/schemas/vaif-config.schema.json",
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

The schema file is also bundled with the package at `node_modules/@vaif/cli/schemas/vaif-config.schema.json`.

## Environment Variables

The CLI automatically loads `.env` files from the current directory.

| Variable | Description |
|----------|-------------|
| `VAIF_API_URL` | API base URL (default: `https://api.vaif.studio`) |
| `VAIF_TOKEN` | API token (alternative to `vaif login`) |
| `VAIF_PROJECT_ID` | Default project ID (also read from `vaif.config.json`) |
| `VITE_VAIF_PROJECT_ID` | Project ID for Vite-based templates (React SPA) |
| `NEXT_PUBLIC_VAIF_PROJECT_ID` | Project ID for Next.js templates |

Project ID resolution: `--project-id` flag > `vaif.config.json` > `VAIF_PROJECT_ID` env var > login session.

## Related Packages

| Package | Description |
|---------|-------------|
| [@vaif/client](https://www.npmjs.com/package/@vaif/client) | TypeScript SDK — database, auth, realtime, storage, functions |
| [@vaif/react](https://www.npmjs.com/package/@vaif/react) | React hooks — useAuth, useQuery, useRealtime |
| [@vaif/mcp](https://www.npmjs.com/package/@vaif/mcp) | MCP server for Claude Code integration |
| [@vaif/migrate](https://www.npmjs.com/package/@vaif/migrate) | Codemod to migrate from `@vaiftech/*` packages to `@vaif/*` |

## Documentation

Full documentation at [docs.vaif.studio](https://docs.vaif.studio).

## License

MIT
