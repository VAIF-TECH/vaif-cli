import fs from "fs";
import path from "path";
import readline from "readline";
import ora from "ora";
import chalk from "chalk";
import { loadAuthConfig } from "./login.js";
import { loadConfig, type VaifConfig } from "../utils/config.js";

interface ClaudeSetupOptions {
  config?: string;
  projectId?: string;
  apiKey?: string;
  skipMcp?: boolean;
  skipClaudeMd?: boolean;
  outputDir?: string;
}

interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
}

interface SchemaForeignKey {
  column: string;
  foreignTable: string;
  foreignColumn: string;
}

interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  foreignKeys?: SchemaForeignKey[];
  indexes?: { name: string; columns: string[]; unique?: boolean }[];
}

interface SchemaData {
  tables: SchemaTable[];
}

interface ProjectInfo {
  name: string;
  apiUrl?: string;
  wsUrl?: string;
  realtimeUrl?: string;
}

const VAIF_API_URL = process.env.VAIF_API_URL || "https://api.vaif.studio";

function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function resolveProjectId(
  options: { projectId?: string },
  config: VaifConfig | null,
  auth: { projectId?: string }
): string | null {
  return options.projectId || config?.projectId || process.env.VAIF_PROJECT_ID || auth.projectId || null;
}

async function fetchAndSelectProject(token: string): Promise<string | null> {
  const spinner = ora("Fetching your projects...").start();

  try {
    const response = await fetch(`${VAIF_API_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      spinner.fail("Could not fetch projects");
      return null;
    }

    const projects: { id: string; name: string; orgId?: string }[] = await response.json();

    if (!projects || projects.length === 0) {
      spinner.fail("No projects found. Create a project at https://vaif.studio first.");
      return null;
    }

    if (projects.length === 1) {
      spinner.succeed(`Found project: ${chalk.cyan(projects[0].name)} (${projects[0].id})`);
      return projects[0].id;
    }

    spinner.succeed(`Found ${projects.length} projects\n`);

    for (let i = 0; i < projects.length; i++) {
      console.log(chalk.gray(`  ${i + 1}.`) + ` ${chalk.white(projects[i].name)} ${chalk.gray(`(${projects[i].id})`)}`);
    }
    console.log("");

    const answer = await promptLine(chalk.cyan(`  Select a project [1-${projects.length}]: `));
    const index = parseInt(answer, 10) - 1;

    if (isNaN(index) || index < 0 || index >= projects.length) {
      console.log(chalk.red("\n  Invalid selection."));
      return null;
    }

    return projects[index].id;
  } catch {
    spinner.fail("Could not fetch projects");
    return null;
  }
}

function generateSchemaMarkdown(tables: SchemaTable[]): string {
  if (!tables || tables.length === 0) {
    return "*No tables found. Create tables in the VAIF Studio dashboard.*";
  }

  let md = "";
  for (const table of tables) {
    md += `### \`${table.name}\`\n\n`;
    md += "| Column | Type | Nullable | Default | Constraints |\n";
    md += "|--------|------|----------|---------|-------------|\n";

    for (const col of table.columns) {
      const constraints: string[] = [];
      if (col.isPrimaryKey) constraints.push("PK");
      if (!col.nullable) constraints.push("NOT NULL");

      const fk = table.foreignKeys?.find((f) => f.column === col.name);
      if (fk) constraints.push(`FK → ${fk.foreignTable}.${fk.foreignColumn}`);

      md += `| ${col.name} | ${col.type} | ${col.nullable ? "yes" : "no"} | ${col.defaultValue || "-"} | ${constraints.join(", ") || "-"} |\n`;
    }
    md += "\n";
  }

  return md;
}

function generateCrudExamples(tables: SchemaTable[], projectUrl: string, apiKey: string): string {
  const sampleTables = tables.slice(0, 3);
  if (sampleTables.length === 0) return "";

  let md = "";
  for (const table of sampleTables) {
    const cols = table.columns.filter((c) => !c.isPrimaryKey && c.name !== "created_at" && c.name !== "updated_at");
    const insertFields = cols
      .slice(0, 3)
      .map((c) => `  ${c.name}: ${exampleValue(c)}`)
      .join(",\n");

    md += `### \`${table.name}\`\n\n`;
    md += "```typescript\n";
    md += `// Select all\nconst ${table.name} = await vaif.from("${table.name}").select();\n\n`;
    md += `// Select with filter\nconst filtered = await vaif.from("${table.name}").select().eq("${cols[0]?.name || "id"}", value);\n\n`;
    md += `// Insert\nconst created = await vaif.from("${table.name}").insert({\n${insertFields}\n});\n\n`;
    md += `// Update\nawait vaif.from("${table.name}").update(recordId, {\n  ${cols[0]?.name || "name"}: newValue\n});\n\n`;
    md += `// Delete\nawait vaif.from("${table.name}").delete(recordId);\n`;
    md += "```\n\n";

    // Add direct REST example for the first table only
    if (table === sampleTables[0]) {
      md += `#### Direct REST API (fetch)\n\n`;
      md += "```typescript\n";
      md += `// GET all rows (returns { data: [...], count: N })\n`;
      md += `const res = await fetch("${projectUrl}/generated/${table.name}", {\n`;
      md += `  headers: { "x-vaif-key": "${apiKey}" },\n`;
      md += `});\n`;
      md += `const { data } = await res.json();\n\n`;
      md += `// GET single row (returns { data: {...} })\n`;
      md += `const res2 = await fetch("${projectUrl}/generated/${table.name}/\${id}", {\n`;
      md += `  headers: { "x-vaif-key": "${apiKey}" },\n`;
      md += `});\n`;
      md += `const { data: record } = await res2.json();\n`;
      md += "```\n\n";
    }
  }

  return md;
}

function exampleValue(col: SchemaColumn): string {
  const t = col.type.toLowerCase();
  if (t.includes("uuid")) return '"crypto.randomUUID()"';
  if (t.includes("int") || t.includes("serial")) return "42";
  if (t.includes("bool")) return "true";
  if (t.includes("timestamp") || t.includes("date")) return '"new Date().toISOString()"';
  if (t.includes("json")) return "{}";
  if (t.includes("float") || t.includes("numeric") || t.includes("decimal") || t.includes("double")) return "3.14";
  return `"example_${col.name}"`;
}

function generateClaudeMd(params: {
  projectId: string;
  apiKey: string;
  apiUrl: string;
  projectName: string;
  schema: SchemaData;
}): string {
  const { projectId, apiKey, apiUrl, projectName, schema } = params;

  const schemaSection = generateSchemaMarkdown(schema.tables);
  const crudSection = generateCrudExamples(schema.tables, apiUrl, apiKey);

  return `# VAIF Studio Backend

This project uses **VAIF Studio** as its backend. Project: **${projectName}** (\`${projectId}\`).

## SDK Setup

\`\`\`bash
npm install @vaif/client
\`\`\`

\`\`\`typescript
import { createVaifClient } from "@vaif/client";

const vaif = createVaifClient({
  baseUrl: "${apiUrl}",
  projectId: "${projectId}",
  apiKey: "${apiKey}",
});
\`\`\`

## Database Schema

${schemaSection}

## CRUD Examples

${crudSection}

## Authentication (End-User Auth)

VAIF provides **project-scoped** authentication for your app's end-users. All auth routes are scoped to your project ID.

### API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| \`/projects/${projectId}/auth/signup\` | POST | None (public) | Register a new user |
| \`/projects/${projectId}/auth/login\` | POST | None (public) | Login with email/password |
| \`/projects/${projectId}/auth/refresh\` | POST | Cookie | Refresh access token |

### Signup

\`\`\`typescript
const res = await fetch("${apiUrl}/projects/${projectId}/auth/signup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "securePassword123",
    metadata: { displayName: "Jane Doe" },  // optional
  }),
});
const { accessToken, expiresIn, user } = await res.json();
// accessToken: JWT with { sub: userId, email, projectId, type: "project_user" }
\`\`\`

### Login

\`\`\`typescript
const res = await fetch("${apiUrl}/projects/${projectId}/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "securePassword123",
  }),
});
const { accessToken, expiresIn, user } = await res.json();
\`\`\`

### Token Refresh

\`\`\`typescript
// Refresh token is stored as httpOnly cookie (project_refresh_token)
// and sent automatically with same-origin requests
const res = await fetch("${apiUrl}/projects/${projectId}/auth/refresh", {
  method: "POST",
  credentials: "include",  // sends the httpOnly cookie
});
const { accessToken, expiresIn, user } = await res.json();
\`\`\`

### Using Auth in Your App

\`\`\`typescript
// Store the access token and use it for authenticated requests
const headers = {
  Authorization: \\\`Bearer \\\${accessToken}\\\`,
  "x-vaif-key": "${apiKey}",
};

// The JWT contains: { sub: userId, email, projectId, type: "project_user" }
// Use this with RLS to scope data to the current user
\`\`\`

> **Important**: Auth routes are at \`/projects/{projectId}/auth/*\`, NOT \`/auth/*\`. The \`/auth/*\` routes are for VAIF Studio platform accounts, not your app's end-users.

## Storage

\`\`\`typescript
// Upload a file
const { url } = await vaif.storage.upload("avatars", file, {
  contentType: "image/png",
});

// Download a file
const blob = await vaif.storage.download("avatars", "photo.png");

// Create a signed URL (expiring)
const { signedUrl } = await vaif.storage.createSignedUrl("avatars", "photo.png", {
  expiresIn: 3600,
});

// List files in a bucket
const files = await vaif.storage.list("avatars", { limit: 100 });
\`\`\`

## Functions

\`\`\`typescript
// Invoke a serverless function
const result = await vaif.functions.invoke("send_welcome_email", {
  body: { userId: "user_123", template: "welcome" },
});
\`\`\`

> **Function naming**: Names must be alphanumeric and underscores only (\`^[a-zA-Z0-9_]+$\`). Use \`send_email\` not \`send-email\`.

## Realtime

\`\`\`typescript
// Subscribe to a channel
const channel = vaif.realtime.channel("my-channel");

// Listen for postgres changes
channel.on("postgres_changes", {
  event: "INSERT",
  schema: "public",
  table: "messages",
}, (payload) => {
  console.log("New message:", payload.new);
});

// Listen for UPDATE events
channel.on("postgres_changes", {
  event: "UPDATE",
  schema: "public",
  table: "messages",
}, (payload) => {
  console.log("Updated:", payload.new, "was:", payload.old);
});

// Listen for DELETE events
channel.on("postgres_changes", {
  event: "DELETE",
  schema: "public",
  table: "messages",
}, (payload) => {
  console.log("Deleted:", payload.old);
});

// Subscribe to start receiving events
channel.subscribe();

// Unsubscribe when done
channel.unsubscribe();
\`\`\`

## Row-Level Security (RLS)

Filter data per-user by sending the \`X-VAIF-RLS\` header with your requests. The header format is \`field:value\`, comma-separated for multiple fields.

\`\`\`typescript
// SDK: pass RLS context to scope queries to the current user
const posts = await vaif.from("posts").select({
  headers: { "x-vaif-rls": \`user_id:\${currentUser.id}\` },
});

// Multiple RLS fields (e.g., multi-tenant + user scoping)
const data = await vaif.from("documents").select({
  headers: { "x-vaif-rls": \`org_id:\${orgId},user_id:\${userId}\` },
});
\`\`\`

**How it works:**
- On **SELECT / UPDATE / DELETE**: RLS fields are added as WHERE conditions (e.g., \`WHERE user_id = $1\`)
- On **INSERT**: RLS fields are auto-populated into the record if not already provided
- This enables multi-tenant data isolation without database-level RLS policies

## Realtime Setup

Enable realtime on your tables, then subscribe to live changes:

\`\`\`typescript
// 1. Enable realtime on tables via API
await fetch("${apiUrl}/realtime/install", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    projectId: "${projectId}",
    tables: ["messages", "notifications"],
  }),
});

// 2. Subscribe to changes via SDK
const channel = vaif.realtime.channel("chat-room");

channel.on("postgres_changes", {
  event: "*",        // INSERT, UPDATE, DELETE, or * for all
  schema: "public",
  table: "messages",
}, (payload) => {
  console.log("Change:", payload.eventType, payload.new);
});

channel.subscribe();

// 3. Presence: track who's online
channel.on("presence", { event: "sync" }, () => {
  const state = channel.presenceState();
  console.log("Online users:", Object.keys(state));
});
channel.track({ user_id: currentUser.id, status: "online" });

// 4. Broadcast: send ephemeral messages (typing indicators, cursors)
channel.send({
  type: "broadcast",
  event: "typing",
  payload: { userId: currentUser.id },
});

// Cleanup
channel.unsubscribe();
\`\`\`

## Storage Policies

Control who can access storage buckets with RLS-style policies:

\`\`\`typescript
// Create a policy: only the uploader can read their own files
await fetch("${apiUrl}/storage/buckets/\${bucketId}/policies", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "owner_read",
    operation: "SELECT",         // SELECT | INSERT | UPDATE | DELETE | ALL
    definition: "auth.uid() = owner_id",
  }),
});

// Create a policy: authenticated users can upload
await fetch("${apiUrl}/storage/buckets/\${bucketId}/policies", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "auth_insert",
    operation: "INSERT",
    definition: "auth.uid() IS NOT NULL",
  }),
});
\`\`\`

## Edge Function Deployment

Create and deploy serverless functions:

\`\`\`typescript
// 1. Create a function
const fn = await fetch("${apiUrl}/functions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    projectId: "${projectId}",
    name: "send_welcome_email",
    runtime: "nodejs20",       // nodejs20 (default)
    entrypoint: "index.ts",    // default
    timeoutMs: 10000,          // 1000–30000ms, default 10000
  }),
});

// 2. Deploy source code
await fetch(\`${apiUrl}/functions/\${fn.id}/source\`, {
  method: "PUT",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sourceCode: \`
      export default async function handler(req, ctx) {
        const { userId } = req.body;
        // ctx.secrets contains your encrypted secrets
        const apiKey = ctx.secrets.SENDGRID_KEY;
        return { status: "sent", userId };
      }
    \`,
  }),
});

// 3. Invoke the function
const result = await vaif.functions.invoke("send_welcome_email", {
  body: { userId: "user_123" },
});
\`\`\`

### Authenticated Context in Functions

Access the caller's verified identity via \\\`vaif.auth\\\`:

\`\`\`typescript
export default async function handler(req) {
  const auth = vaif.auth;
  // auth.type = 'user' | 'api_key' | 'function'
  // auth.userId    — User ID (for user/function types)
  // auth.email     — User email (for user type)
  // auth.projectId — Always present
  // auth.scopes    — API key scopes (for api_key type)

  if (!auth || auth.type !== 'user') {
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

  return { body: { message: "Hello " + auth.email } };
}
\`\`\`

### Function-to-Function Invocation

Call other functions from within a handler:

\`\`\`typescript
export default async function handler(req) {
  const result = await vaif.invoke("send_email", {
    to: "user@example.com",
    subject: "Hello",
  });
  return { statusCode: 200, body: result };
}
\`\`\`

### Database Triggers

Fire functions automatically on insert/update/delete events. Configure triggers via the API:

\`\`\`
POST /functions/\\\${functionId}/triggers
{ "event": "db.insert", "tableName": "orders", "enabled": true }
\`\`\`

## API Key Management

API keys are project-scoped and used for data-plane authentication (CRUD, storage, functions).

\`\`\`typescript
// Create a new API key
const { key } = await fetch("${apiUrl}/projects/${projectId}/api-keys", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "production-frontend" }),
}).then(r => r.json());

// List keys
const keys = await fetch("${apiUrl}/projects/${projectId}/api-keys", {
  headers: { Authorization: \`Bearer \${token}\` },
}).then(r => r.json());

// Rotate a key (generates new secret, old key stops working)
await fetch(\`${apiUrl}/projects/${projectId}/api-keys/\${keyId}/rotate\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${token}\` },
});

// Revoke a key
await fetch(\`${apiUrl}/projects/${projectId}/api-keys/\${keyId}/revoke\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${token}\` },
});
\`\`\`

## Secrets & Environment Variables

Secrets are encrypted at rest and injected into function invocations at runtime.

\`\`\`typescript
// Set a secret (via API)
await fetch("${apiUrl}/functions/secrets", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    projectId: "${projectId}",
    key: "STRIPE_SECRET_KEY",
    value: "sk_live_...",
  }),
});

// Or use the CLI
// vaif secrets set STRIPE_SECRET_KEY sk_live_...
// vaif secrets list
// vaif secrets delete STRIPE_SECRET_KEY
\`\`\`

**Accessing secrets in functions:**

\`\`\`typescript
export default async function handler(req, ctx) {
  const stripe = new Stripe(ctx.secrets.STRIPE_SECRET_KEY);
  // ...
}
\`\`\`

## API Reference Notes

### Filter Syntax

The SDK supports these filter operators:

| Operator | Description | Example |
|----------|-------------|---------|
| \`eq\` | Equal | \`.eq("status", "active")\` |
| \`neq\` | Not equal | \`.neq("status", "deleted")\` |
| \`gt\` | Greater than | \`.gt("age", 18)\` |
| \`lt\` | Less than | \`.lt("price", 100)\` |
| \`gte\` | Greater than or equal | \`.gte("score", 90)\` |
| \`lte\` | Less than or equal | \`.lte("count", 10)\` |
| \`in\` | In array | \`.in("role", ["admin", "editor"])\` |
| \`like\` | Pattern match (case-sensitive) | \`.like("name", "%john%")\` |
| \`ilike\` | Pattern match (case-insensitive) | \`.ilike("name", "%john%")\` |
| \`is\` | IS comparison (null, true, false) | \`.is("deleted_at", null)\` |

### JSONB Subkey Filters

Filter on nested JSONB fields using arrow notation:

| Filter | SQL Generated |
|--------|--------------|
| \\\`filter[metadata->status]=active\\\` | \\\`metadata->>'status' = 'active'\\\` |
| \\\`filter[config->theme.ilike]=%dark%\\\` | \\\`config->>'theme' ILIKE '%dark%'\\\` |
| \\\`filter[data->user->role]=admin\\\` | \\\`data->'user'->>'role' = 'admin'\\\` |

All standard operators work with JSONB paths. The last segment uses \\\`->>\\\` (text extraction).

### Compound Filters (AND + OR)

Combine AND and OR conditions:

\`\`\`
?filter[status]=active&or_filter[role]=admin&or_filter[role]=moderator
\`\`\`

This generates: \\\`WHERE status = 'active' AND (role = 'admin' OR role = 'moderator')\\\`

### Full-Text Search

\`\`\`typescript
const results = await fetch("${apiUrl}/generated/posts/search", {
  method: "POST",
  headers: { "x-vaif-key": "${apiKey}", "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "search term",
    columns: ["title", "body"],
    limit: 20,
  }),
});
// Results ranked by ts_rank score
\`\`\`

### Aggregation

\`\`\`typescript
const stats = await fetch("${apiUrl}/generated/orders/aggregate", {
  method: "POST",
  headers: { "x-vaif-key": "${apiKey}", "Content-Type": "application/json" },
  body: JSON.stringify({
    aggregates: [
      { fn: "count", column: "*" },
      { fn: "sum", column: "total" },
      { fn: "avg", column: "total" },
    ],
    groupBy: ["status"],
  }),
});
\`\`\`

### Joins (Foreign Key Includes)

Include related rows by specifying foreign key columns:

\`\`\`
GET /generated/posts?include=author_id&include=category_id
\`\`\`

Returns posts with \\\`author_id_included\\\` and \\\`category_id_included\\\` objects containing the related rows.

### Upsert

Insert or update on conflict:

\`\`\`typescript
const result = await fetch("${apiUrl}/generated/users", {
  method: "POST",
  headers: { "x-vaif-key": "${apiKey}", "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "alice@example.com",
    name: "Alice",
    _upsert: true,
    _conflictColumns: ["email"],
  }),
});
\`\`\`

### Pagination

\`\`\`typescript
// Default: limit 20, offset 0
const page1 = await vaif.from("posts").select().limit(20).offset(0);
const page2 = await vaif.from("posts").select().limit(20).offset(20);
\`\`\`

### REST API Response Format

When calling the REST API directly (without the SDK), all data-plane responses are wrapped:

\`\`\`typescript
// GET /generated/{table} → list
{ data: [...], count: 5 }

// GET /generated/{table}/{id} → single record
{ data: { id: "...", ... } }

// POST /generated/{table} → created record
{ data: { id: "...", ... } }

// PATCH /generated/{table}/{id} → updated record
{ data: { id: "...", ... } }

// DELETE /generated/{table}/{id}
{ ok: true }

// Error responses
{ error: "NotFound", message: "...", requestId: "..." }
\`\`\`

The SDK unwraps these automatically, but if you use \`fetch()\` directly, access the data via \`response.data\`.

### Numeric/Decimal Column Serialization

PostgreSQL \`numeric\` and \`decimal\` columns serialize to **JSON strings** (to preserve arbitrary precision). This is standard behavior. Any column typed as \`numeric\` or \`decimal\` will arrive as \`"3.14"\` not \`3.14\`.

\`\`\`typescript
// Wrong — value is a string, comparison may fail
if (item.price > 10.0) { ... }

// Correct — parse before arithmetic
if (parseFloat(item.price) > 10.0) { ... }
\`\`\`

### Auth Headers

VAIF uses **two auth modes** — choose the right one for each operation:

| Auth Mode | Header | Used For |
|-----------|--------|----------|
| **API Key** | \`x-vaif-key: vaif_xxx\` | Data-plane: CRUD (\`/generated/*\`), storage uploads/downloads, function invocation |
| **JWT Token** | \`Authorization: Bearer <jwt>\` | Control-plane: schema introspection, project management, function CRUD, bucket creation |

> **Important**: API keys do NOT work for control-plane endpoints (creating functions, managing buckets, schema changes). Those require a JWT session token. The MCP server handles this automatically by using both auth modes.

### MCP Tools (via .mcp.json)

The \`.mcp.json\` file configures an MCP server that gives Claude Code direct access to your VAIF project. Available tools:

| Tool | What it does |
|------|-------------|
| \`list_tables\`, \`describe_table\` | Inspect database schema |
| \`get_schema\` | Full schema as JSON |
| \`create_tables\` | Create or update tables declaratively |
| \`query_rows\` | Query with filters, JSONB paths, pagination |
| \`insert_row\`, \`update_row\`, \`delete_row\` | CRUD operations on any table |
| \`list_functions\`, \`deploy_function\`, \`invoke_function\` | Function management |
| \`get_function_logs\` | Execution history with status filters |
| \`set_secret\`, \`list_secrets\`, \`delete_secret\` | Function secrets |
| \`list_buckets\`, \`list_files\`, \`get_signed_url\` | Storage operations |
| \`enable_realtime\`, \`realtime_status\` | Realtime subscriptions |

> **Note**: MCP tools are only available to the main Claude Code session, not to spawned sub-agents (Task tool). The main session should handle all VAIF backend operations directly.
`;
}

export async function claudeSetup(options: ClaudeSetupOptions): Promise<void> {
  const spinner = ora();

  // Step 1: Check auth
  const auth = loadAuthConfig();
  if (!auth || !auth.token) {
    console.log(chalk.red("Not logged in"));
    console.log(chalk.gray("Run `vaif login` first to authenticate"));
    process.exit(1);
  }

  // Step 2: Load config (optional)
  const configPath = options.config || "vaif.config.json";
  let config: VaifConfig | null = null;
  try {
    config = await loadConfig(configPath);
  } catch {
    // Config is optional
  }

  // Step 3: Resolve project ID (auto-fetch if not specified)
  let projectId = resolveProjectId(options, config, auth);
  if (!projectId) {
    console.log(chalk.yellow("No project ID specified — fetching your projects...\n"));
    projectId = await fetchAndSelectProject(auth.token);
    if (!projectId) {
      console.log(chalk.gray("\n  Tip: pass --project-id <id> or set projectId in vaif.config.json"));
      process.exit(1);
    }
  }

  const outputDir = path.resolve(options.outputDir || ".");

  console.log("");
  console.log(chalk.bold("VAIF Claude Code Setup"));
  console.log(chalk.gray(`  Project: ${projectId}`));
  console.log("");

  // Step 4: Fetch schema
  spinner.start("Fetching database schema...");

  let schema: SchemaData = { tables: [] };
  try {
    const response = await fetch(
      `${VAIF_API_URL}/schema-engine/introspect/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );

    if (response.ok) {
      schema = await response.json();
      spinner.succeed(`Fetched schema (${schema.tables?.length || 0} tables)`);
    } else {
      spinner.warn("Could not fetch schema — continuing without it");
    }
  } catch {
    spinner.warn("Could not fetch schema — continuing without it");
  }

  // Step 5: Fetch project info
  spinner.start("Fetching project info...");

  let projectName = projectId;
  let projectApiUrl = VAIF_API_URL;
  try {
    const response = await fetch(
      `${VAIF_API_URL}/projects/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      // API returns { project: {...}, environments: [...] }
      const project = data.project || data;
      projectName = project.name || projectId;
      projectApiUrl = project.apiUrl || VAIF_API_URL;
      spinner.succeed(`Project: ${projectName}`);
    } else {
      spinner.warn("Could not fetch project info — using defaults");
    }
  } catch {
    spinner.warn("Could not fetch project info — using defaults");
  }

  // Step 6: Resolve API key
  let apiKey = options.apiKey || config?.api?.apiKey || "";

  if (!apiKey) {
    spinner.start("Generating API key for Claude Code...");
    try {
      const keyName = `claude-code-${Date.now()}`;
      const response = await fetch(
        `${VAIF_API_URL}/projects/${projectId}/api-keys`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: keyName, scopes: ["crud", "realtime", "functions", "storage"] }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        apiKey = data.apiKey || data.key;
        spinner.succeed(`Generated API key: ${keyName}`);
      } else {
        spinner.fail("Could not auto-generate API key");
        console.log(chalk.yellow("  Pass one with --api-key or generate via `vaif keys generate`"));
        process.exit(1);
      }
    } catch {
      spinner.fail("Could not auto-generate API key");
      console.log(chalk.yellow("  Pass one with --api-key or generate via `vaif keys generate`"));
      process.exit(1);
    }
  }

  // Step 7: Write .mcp.json
  if (!options.skipMcp) {
    spinner.start("Writing .mcp.json...");
    const mcpConfig = {
      mcpServers: {
        "vaif-studio": {
          command: "npx",
          args: ["@vaif/mcp"],
          env: {
            VAIF_API_KEY: apiKey,
            VAIF_PROJECT_ID: projectId,
            VAIF_API_URL: projectApiUrl,
            VAIF_AUTH_TOKEN: auth.token,
          },
        },
      },
    };

    const mcpPath = path.join(outputDir, ".mcp.json");
    fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
    spinner.succeed(`Written ${chalk.cyan(".mcp.json")}`);
  }

  // Step 8: Write CLAUDE.md
  if (!options.skipClaudeMd) {
    spinner.start("Writing CLAUDE.md...");
    const claudeMd = generateClaudeMd({
      projectId,
      apiKey,
      apiUrl: projectApiUrl,
      projectName,
      schema,
    });

    const claudeMdPath = path.join(outputDir, "CLAUDE.md");
    fs.writeFileSync(claudeMdPath, claudeMd, "utf-8");
    spinner.succeed(`Written ${chalk.cyan("CLAUDE.md")}`);
  }

  // Step 9: Print success
  console.log("");
  console.log(chalk.green.bold("  Claude Code integration configured!"));
  console.log("");

  if (!options.skipMcp) {
    console.log(chalk.gray("  MCP Server:  ") + chalk.white(".mcp.json"));
  }
  if (!options.skipClaudeMd) {
    console.log(chalk.gray("  Context:     ") + chalk.white("CLAUDE.md"));
  }

  console.log("");
  console.log(chalk.bold("  Next steps:"));
  console.log(chalk.gray("  1. Open this project in Claude Code"));
  console.log(chalk.gray("  2. The MCP server auto-connects to your VAIF project"));
  console.log(chalk.gray("  3. Ask Claude to query, modify, or build against your schema"));
  console.log("");
}
