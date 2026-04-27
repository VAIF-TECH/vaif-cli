import fs from "fs";
import path from "path";
import readline from "readline";
import chalk from "chalk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatureName = "auth" | "database" | "realtime" | "storage" | "functions";

export const ALL_FEATURES: { name: FeatureName; label: string; description: string }[] = [
  { name: "database", label: "Database", description: "CRUD queries, type-safe operations" },
  { name: "auth", label: "Authentication", description: "login, signup, OAuth, sessions" },
  { name: "realtime", label: "Realtime", description: "live subscriptions, presence" },
  { name: "storage", label: "Storage", description: "file uploads, signed URLs" },
  { name: "functions", label: "Functions", description: "serverless function calls" },
];

export interface TemplateFile {
  /** Relative path from project root */
  path: string;
  /** File content (template literal) */
  content: string;
}

export interface TemplateDefinition {
  name: string;
  description: string;
  /** Language / ecosystem tag shown in the list command */
  tag: string;
  files: TemplateFile[];
  /** Files added when specific features are selected */
  featureFiles?: Partial<Record<FeatureName, TemplateFile[]>>;
  /** Default features when using this template without --features */
  defaultFeatures?: FeatureName[];
  /** npm dependencies to install (JS/TS templates only) */
  dependencies?: string[];
  /** npm devDependencies to install (JS/TS templates only) */
  devDependencies?: string[];
  /** Lines printed after scaffolding */
  postInstructions: string[];
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

export const TEMPLATES: Record<string, TemplateDefinition> = {
  // ── 1. Next.js Full-Stack ────────────────────────────────────────────
  "nextjs-fullstack": {
    name: "Next.js Full-Stack",
    description: "Next.js app with server/client VAIF client, auth middleware, and React hooks",
    tag: "Next.js",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-vaif-app",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@vaif/client": "^0.3.0",
    "@vaiftech/auth": "^1.0.0",
    "@vaiftech/react": "^1.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0"
  }
}
`,
      },
      {
        path: "tsconfig.json",
        content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
      },
      {
        path: "next.config.ts",
        content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
      },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import { VaifProvider } from "@vaiftech/react";
import { vaif } from "@/lib/vaif";
import "./globals.css";

export const metadata: Metadata = {
  title: "My VAIF App",
  description: "Built with VAIF Studio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <VaifProvider client={vaif}>{children}</VaifProvider>
      </body>
    </html>
  );
}
`,
      },
      {
        path: "app/page.tsx",
        content: `export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
      <h1>Welcome to VAIF</h1>
      <p>Your Next.js app is ready. Start building!</p>
    </main>
  );
}
`,
      },
      {
        path: "app/globals.css",
        content: `*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
      },
      {
        path: "lib/vaif.ts",
        content: `import { createVaifClient } from "@vaif/client";

// Browser client – safe to use in Client Components
export const vaif = createVaifClient({
  baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
  projectId: process.env.NEXT_PUBLIC_VAIF_PROJECT_ID,
  apiKey: process.env.NEXT_PUBLIC_VAIF_API_KEY!,
});

// Server client – use in Server Components, Route Handlers, Server Actions
export function createVaifServer() {
  return createVaifClient({
    baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
    projectId: process.env.VAIF_PROJECT_ID,
    apiKey: process.env.VAIF_SECRET_KEY!,
  });
}
`,
      },
      {
        path: ".env.local.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys → Project Settings → API Keys

NEXT_PUBLIC_VAIF_API_URL=https://api.vaif.studio
NEXT_PUBLIC_VAIF_PROJECT_ID=your-project-id
NEXT_PUBLIC_VAIF_API_KEY=your-api-key
VAIF_SECRET_KEY=your-secret-key

# CLI project ID (for vaif generate, vaif pull, vaif secrets, etc.)
VAIF_PROJECT_ID=your-project-id
`,
      },
      {
        path: ".gitignore",
        content: `node_modules
.next
out
.env
.env.local
*.local
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — Next.js Full-Stack

A full-stack Next.js application powered by [VAIF Studio](https://vaif.studio), with server and client VAIF clients, auth middleware, and React hooks.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   Copy the example environment file and fill in your project values:

   \\\`\\\`\\\`bash
   cp .env.local.example .env.local
   \\\`\\\`\\\`

   Get your Project ID, API Key, and Secret Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

5. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

6. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

7. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

8. **Run the development server**

   \\\`\\\`\\\`bash
   npm run dev
   \\\`\\\`\\\`

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

\\\`\\\`\\\`
.
├── app/
│   ├── layout.tsx        # Root layout with VaifProvider
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── lib/
│   └── vaif.ts           # Browser + server VAIF client setup
├── .env.local.example    # Environment variable template
├── next.config.ts        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json
\\\`\\\`\\\`

## Available Scripts

| Command          | Description                 |
| ---------------- | --------------------------- |
| \\\`npm run dev\\\`   | Start development server    |
| \\\`npm run build\\\` | Create production build     |
| \\\`npm run start\\\` | Start production server     |
| \\\`npm run lint\\\`  | Run ESLint                  |

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      auth: [
        {
          path: "app/page.tsx",
          content: `import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
      <h1>Welcome to VAIF</h1>
      <p>Your Next.js app is ready. Start building!</p>
      <p style={{ marginTop: 24 }}>
        <Link href="/login" style={{ marginRight: 16 }}>Log in</Link>
        <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
`,
        },
        {
          path: "middleware.ts",
          content: `import { NextResponse, type NextRequest } from "next/server";
import { createVaifClient } from "@vaif/client";
import { authMiddleware } from "@vaiftech/auth/nextjs";

const protectedRoutes = ["/dashboard", "/settings", "/api/protected"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  const vaif = createVaifClient({
    baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
    projectId: process.env.VAIF_PROJECT_ID,
    apiKey: process.env.VAIF_SECRET_KEY!,
  });

  return authMiddleware(vaif, request, {
    loginRedirect: "/login",
    onUnauthenticated: () => {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/api/protected/:path*"],
};
`,
        },
        {
          path: "app/(auth)/login/page.tsx",
          content: `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { vaif } from "@/lib/vaif";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await vaif.auth.login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>Log In</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 24px" }}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
`,
        },
        {
          path: "app/(auth)/signup/page.tsx",
          content: `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { vaif } from "@/lib/vaif";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await vaif.auth.signUp(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Sign up failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 24px" }}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
`,
        },
      ],
      storage: [
        {
          path: "lib/storage.ts",
          content: `import { createVaifServer } from "./vaif";

export async function uploadFile(bucket: string, file: Buffer | Blob, filePath: string) {
  const vaif = createVaifServer();
  const { data, error } = await vaif.storage.from(bucket).upload(filePath, file);
  if (error) throw error;
  const { data: urlData } = vaif.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData.publicUrl };
}

export async function getSignedUrl(bucket: string, filePath: string, expiresIn = 3600) {
  const vaif = createVaifServer();
  const { data, error } = await vaif.storage.from(bucket).createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
`,
        },
        {
          path: "app/api/upload/route.ts",
          content: `import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as Blob | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const fileName = (formData.get("fileName") as string) || "upload";
  const bucket = (formData.get("bucket") as string) || "uploads";
  const filePath = \`\${Date.now()}-\${fileName}\`;

  const result = await uploadFile(bucket, file, filePath);
  return NextResponse.json(result);
}
`,
        },
      ],
      realtime: [
        {
          path: "hooks/useRealtime.ts",
          content: `"use client";

import { useEffect, useState, useCallback } from "react";
import { vaif } from "@/lib/vaif";

interface UseRealtimeOptions<T> {
  table: string;
  schema?: string;
  filter?: string;
  initialData?: T[];
}

export function useRealtime<T extends { id: string }>({
  table,
  schema = "public",
  filter,
  initialData = [],
}: UseRealtimeOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);

  useEffect(() => {
    vaif.from(table).select("*").then(({ data: rows }) => {
      if (rows) setData(rows as T[]);
    });
  }, [table]);

  useEffect(() => {
    const channelConfig: Record<string, string> = { event: "*", schema, table };
    if (filter) channelConfig.filter = filter;

    const channel = vaif
      .channel(\`\${table}-changes\`)
      .on("postgres_changes", channelConfig, (payload) => {
        if (payload.eventType === "INSERT") {
          setData((prev) => [...prev, payload.new as T]);
        } else if (payload.eventType === "UPDATE") {
          setData((prev) => prev.map((item) => (item.id === (payload.new as T).id ? (payload.new as T) : item)));
        } else if (payload.eventType === "DELETE") {
          setData((prev) => prev.filter((item) => item.id !== (payload.old as T).id));
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [table, schema, filter]);

  const refresh = useCallback(async () => {
    const { data: rows } = await vaif.from(table).select("*");
    if (rows) setData(rows as T[]);
  }, [table]);

  return { data, refresh };
}
`,
        },
      ],
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaif/client", "@vaiftech/auth", "@vaiftech/react", "next", "react", "react-dom"],
    devDependencies: ["@types/node", "@types/react", "@types/react-dom", "typescript"],
    postInstructions: [
      "cd my-vaif-app",
      "npm install",
      "# Copy .env.local.example to .env.local and add your VAIF credentials",
      "npm run dev",
    ],
  },

  // ── 2. React SPA ─────────────────────────────────────────────────────
  "react-spa": {
    name: "React SPA",
    description: "Single-page React app with Vite, VAIF client, and provider wrapper",
    tag: "React + Vite",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-vaif-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vaif/client": "^0.3.0",
    "@vaiftech/react": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
`,
      },
      {
        path: "tsconfig.json",
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
`,
      },
      {
        path: "vite.config.ts",
        content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`,
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My VAIF App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      },
      {
        path: "src/main.tsx",
        content: `import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { VaifProvider } from "@vaiftech/react";
import { vaif } from "./lib/vaif";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <VaifProvider client={vaif}>
        <App />
      </VaifProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
`,
      },
      {
        path: "src/App.tsx",
        content: `import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

function Home() {
  return (
    <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
      <h1>Welcome to VAIF</h1>
      <p>Your app is ready. Start building!</p>
    </div>
  );
}
`,
      },
      {
        path: "src/lib/vaif.ts",
        content: `import { createVaifClient } from "@vaif/client";

export const vaif = createVaifClient({
  baseUrl: import.meta.env.VITE_VAIF_API_URL || 'https://api.vaif.studio',
  projectId: import.meta.env.VITE_VAIF_PROJECT_ID,
  apiKey: import.meta.env.VITE_VAIF_API_KEY,
});
`,
      },
      {
        path: "src/vite-env.d.ts",
        content: `/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAIF_API_URL: string;
  readonly VITE_VAIF_PROJECT_ID: string;
  readonly VITE_VAIF_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys

VITE_VAIF_API_URL=https://api.vaif.studio
VITE_VAIF_PROJECT_ID=your-project-id
VITE_VAIF_API_KEY=your-api-key
`,
      },
      {
        path: ".gitignore",
        content: `node_modules
dist
.env
.env.local
*.local
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — React SPA

A single-page React application built with [Vite](https://vite.dev/) and powered by [VAIF Studio](https://vaif.studio).

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID and API Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

5. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

6. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

7. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

8. **Run the development server**

   \\\`\\\`\\\`bash
   npm run dev
   \\\`\\\`\\\`

   Open the URL shown in your terminal (usually [http://localhost:5173](http://localhost:5173)).

## Project Structure

\\\`\\\`\\\`
.
├── src/
│   ├── App.tsx           # Root component with routes
│   ├── main.tsx          # Entry point with VaifProvider
│   ├── lib/
│   │   └── vaif.ts       # VAIF client setup
│   └── vite-env.d.ts     # Vite environment types
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variable template
└── package.json
\\\`\\\`\\\`

## Available Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| \\\`npm run dev\\\`       | Start development server       |
| \\\`npm run build\\\`     | Create production build        |
| \\\`npm run preview\\\`   | Preview production build       |

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      auth: [
        {
          path: "src/App.tsx",
          content: `import { Routes, Route, Link } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
    </Routes>
  );
}

function Home() {
  return (
    <div style={{ maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
      <h1>Welcome to VAIF</h1>
      <p>Your app is ready. Start building!</p>
      <p style={{ marginTop: 24 }}>
        <Link to="/login" style={{ marginRight: 16 }}>Log in</Link>
        <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
`,
        },
        {
          path: "src/pages/Login.tsx",
          content: `import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { vaif } from "../lib/vaif";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await vaif.auth.login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>Log In</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 24px" }}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
`,
        },
        {
          path: "src/pages/Signup.tsx",
          content: `import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { vaif } from "../lib/vaif";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await vaif.auth.signUp(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Sign up failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ display: "block", width: "100%", padding: 8 }} />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "8px 24px" }}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
`,
        },
        {
          path: "src/components/AuthGuard.tsx",
          content: `import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { vaif } from "../lib/vaif";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    vaif.auth.getUser()
      .then(() => {
        setAuthenticated(true);
        setLoading(false);
      })
      .catch(() => {
        navigate("/login");
        setLoading(false);
      });
  }, [navigate]);

  if (loading) return fallback ?? <div>Loading...</div>;
  if (!authenticated) return null;
  return <>{children}</>;
}
`,
        },
      ],
      storage: [
        {
          path: "src/hooks/useFileUpload.ts",
          content: `import { useState, useCallback } from "react";
import { vaif } from "../lib/vaif";

interface UploadResult {
  path: string;
  publicUrl: string;
}

interface UseFileUploadOptions {
  bucket?: string;
  folder?: string;
}

export function useFileUpload({ bucket = "uploads", folder = "" }: UseFileUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      setUploading(true);
      setError(null);

      const filePath = folder
        ? \`\${folder}/\${Date.now()}-\${file.name}\`
        : \`\${Date.now()}-\${file.name}\`;

      const { data, error: uploadError } = await vaif.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return null;
      }

      const { data: urlData } = vaif.storage.from(bucket).getPublicUrl(data.path);

      setUploading(false);
      return { path: data.path, publicUrl: urlData.publicUrl };
    },
    [bucket, folder],
  );

  return { upload, uploading, error };
}
`,
        },
      ],
      realtime: [
        {
          path: "src/hooks/useRealtimeSubscription.ts",
          content: `import { useEffect, useState, useCallback } from "react";
import { vaif } from "../lib/vaif";

interface UseRealtimeOptions<T> {
  table: string;
  schema?: string;
  filter?: string;
  initialData?: T[];
}

export function useRealtimeSubscription<T extends { id: string }>({
  table,
  schema = "public",
  filter,
  initialData = [],
}: UseRealtimeOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);

  useEffect(() => {
    // Load initial data
    let query = vaif.from(table).select("*");
    query.then(({ data: rows }) => {
      if (rows) setData(rows as T[]);
    });
  }, [table]);

  useEffect(() => {
    const channelConfig: Record<string, string> = {
      event: "*",
      schema,
      table,
    };
    if (filter) channelConfig.filter = filter;

    const channel = vaif
      .channel(\`\${table}-changes\`)
      .on("postgres_changes", channelConfig, (payload) => {
        if (payload.eventType === "INSERT") {
          setData((prev) => [...prev, payload.new as T]);
        } else if (payload.eventType === "UPDATE") {
          setData((prev) =>
            prev.map((item) => (item.id === (payload.new as T).id ? (payload.new as T) : item)),
          );
        } else if (payload.eventType === "DELETE") {
          setData((prev) => prev.filter((item) => item.id !== (payload.old as T).id));
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [table, schema, filter]);

  const refresh = useCallback(async () => {
    const { data: rows } = await vaif.from(table).select("*");
    if (rows) setData(rows as T[]);
  }, [table]);

  return { data, refresh };
}
`,
        },
      ],
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaif/client", "@vaiftech/react", "react", "react-dom", "react-router-dom"],
    devDependencies: ["@types/react", "@types/react-dom", "@vitejs/plugin-react", "typescript", "vite"],
    postInstructions: [
      "cd my-vaif-app",
      "npm install",
      "# Copy .env.example to .env and add your VAIF credentials",
      "npm run dev",
    ],
  },

  // ── 3. iOS Swift App ─────────────────────────────────────────────────
  "ios-swift-app": {
    name: "iOS Swift App",
    description: "Swift client manager for iOS/macOS apps using Swift Package Manager",
    tag: "Swift / iOS",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "VaifManager.swift",
        content: `import Foundation
import VaifClient

/// Singleton manager for the VAIF client.
/// Add your project ID and API key in the initialiser or load from a config file.
@MainActor
final class VaifManager: ObservableObject {
    static let shared = VaifManager()

    let client: VaifClient

    @Published var isAuthenticated = false

    private init() {
        guard
            let projectId = ProcessInfo.processInfo.environment["VAIF_PROJECT_ID"]
                ?? Bundle.main.infoDictionary?["VAIF_PROJECT_ID"] as? String,
            let apiKey = ProcessInfo.processInfo.environment["VAIF_API_KEY"]
                ?? Bundle.main.infoDictionary?["VAIF_API_KEY"] as? String
        else {
            fatalError("VAIF_PROJECT_ID and VAIF_API_KEY must be set")
        }

        self.client = VaifClient(
            projectId: projectId,
            apiKey: apiKey
        )
    }

    // MARK: - Auth helpers

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
        isAuthenticated = true
    }

    func signOut() async throws {
        try await client.auth.signOut()
        isAuthenticated = false
    }

    // MARK: - Database helpers

    func query<T: Decodable>(_ table: String, type: T.Type) async throws -> [T] {
        return try await client.from(table).select().execute().value
    }

    func insert<T: Encodable>(_ table: String, values: T) async throws {
        try await client.from(table).insert(values).execute()
    }
}
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Add these to your Xcode scheme environment variables or Info.plist

VAIF_PROJECT_ID=your-project-id
VAIF_API_KEY=your-anon-key
`,
      },
      {
        path: "README-VAIF.md",
        content: `# VAIF Swift Setup

## 1. Add the Swift Package

In Xcode: **File → Add Package Dependencies…**

Enter the repository URL:
\`\`\`
https://github.com/vaif-technologies/vaif-swift
\`\`\`

Select the **VaifClient** library and add it to your target.

## 2. Configure Environment

Add your project credentials to your Xcode scheme:

1. Edit Scheme → Run → Arguments → Environment Variables
2. Add \`VAIF_PROJECT_ID\` and \`VAIF_API_KEY\`

Or add them to **Info.plist**:
\`\`\`xml
<key>VAIF_PROJECT_ID</key>
<string>your-project-id</string>
<key>VAIF_API_KEY</key>
<string>your-anon-key</string>
\`\`\`

## 3. Usage

\`\`\`swift
import SwiftUI

struct ContentView: View {
    @StateObject private var vaif = VaifManager.shared

    var body: some View {
        // Use vaif.client to interact with your project
        Text("Connected to VAIF")
    }
}
\`\`\`

## 4. Generate Types

Run the VAIF CLI to generate Swift models from your schema:

\`\`\`bash
npx @vaiftech/cli generate --output ./Models/Database.swift --lang swift
\`\`\`
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — iOS Swift

An iOS/macOS application powered by [VAIF Studio](https://vaif.studio), using the VaifClient Swift package.

## Prerequisites

- Xcode 15 or later
- iOS 17+ / macOS 14+ deployment target
- A VAIF Studio account — sign up at <https://vaif.studio>
- (Optional) VAIF CLI for type generation: \\\`npm install -g @vaiftech/cli\\\`

## Setup

1. **Add the Swift Package**

   In Xcode: **File > Add Package Dependencies...**

   Enter the repository URL:

   \\\`\\\`\\\`
   https://github.com/vaif-technologies/vaif-swift
   \\\`\\\`\\\`

   Select the **VaifClient** library and add it to your target.

2. **Configure credentials**

   Add your project credentials to your Xcode scheme:

   - **Edit Scheme > Run > Arguments > Environment Variables**
   - Add \\\`VAIF_PROJECT_ID\\\` and \\\`VAIF_API_KEY\\\`

   Alternatively, add them to **Info.plist**:

   \\\`\\\`\\\`xml
   <key>VAIF_PROJECT_ID</key>
   <string>your-project-id</string>
   <key>VAIF_API_KEY</key>
   <string>your-anon-key</string>
   \\\`\\\`\\\`

   Get your credentials from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI** (for type generation)

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

5. **Generate Swift models**

   \\\`\\\`\\\`bash
   vaif generate --output ./Models/Database.swift --lang swift
   \\\`\\\`\\\`

6. **Build and run**

   Press **Cmd+R** in Xcode or run from the command line:

   \\\`\\\`\\\`bash
   xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16'
   \\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
.
├── VaifManager.swift      # Singleton VAIF client manager
├── .env.example           # Environment variable reference
└── README-VAIF.md         # Additional VAIF setup notes
\\\`\\\`\\\`

## Usage

\\\`\\\`\\\`swift
import SwiftUI

struct ContentView: View {
    @StateObject private var vaif = VaifManager.shared

    var body: some View {
        Text("Connected to VAIF")
    }
}
\\\`\\\`\\\`

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    postInstructions: [
      "Add the VaifClient Swift package from https://github.com/vaif-technologies/vaif-swift",
      "Add VAIF_PROJECT_ID and VAIF_API_KEY to your Xcode scheme environment",
      "See README-VAIF.md for full setup instructions",
    ],
  },

  // ── 4. Expo Mobile App ───────────────────────────────────────────────
  "expo-mobile-app": {
    name: "Expo Mobile App",
    description: "React Native / Expo app with VAIF client configured for mobile",
    tag: "Expo / React Native",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "package.json",
        content: `{
  "name": "my-vaif-app",
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.1.0",
    "@vaiftech/sdk-expo": "^1.0.0",
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "react": "^19.0.0",
    "react-native": "~0.76.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0"
  }
}
`,
      },
      {
        path: "app.json",
        content: `{
  "expo": {
    "name": "my-vaif-app",
    "slug": "my-vaif-app",
    "version": "1.0.0",
    "scheme": "myvaifapp",
    "platforms": ["ios", "android", "web"],
    "newArchEnabled": true
  }
}
`,
      },
      {
        path: "app/_layout.tsx",
        content: `import { Stack } from "expo-router";
import { VaifProvider } from "@vaiftech/sdk-expo";
import { vaif } from "../lib/vaif";

export default function RootLayout() {
  return (
    <VaifProvider client={vaif}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Home" }} />
      </Stack>
    </VaifProvider>
  );
}
`,
      },
      {
        path: "app/index.tsx",
        content: `import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to VAIF</Text>
      <Text style={styles.subtitle}>Your mobile app is ready. Start building!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center" },
});
`,
      },
      {
        path: "lib/vaif.ts",
        content: `import { createExpoClient } from "@vaiftech/sdk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const vaif = createExpoClient({
  projectId: process.env.EXPO_PUBLIC_VAIF_PROJECT_ID!,
  apiKey: process.env.EXPO_PUBLIC_VAIF_API_KEY!,
  storage: AsyncStorage,
  realtime: { enabled: true },
});
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys → Project Settings → API Keys

EXPO_PUBLIC_VAIF_PROJECT_ID=your-project-id
EXPO_PUBLIC_VAIF_API_KEY=your-anon-key

# CLI uses these (non-prefixed) for vaif db push, vaif secrets, etc.
VAIF_PROJECT_ID=your-project-id
`,
      },
      {
        path: ".gitignore",
        content: `node_modules
.expo
dist
.env
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — Expo Mobile

A React Native / Expo mobile application powered by [VAIF Studio](https://vaif.studio), with Expo Router and native async storage.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (\\\`npx expo\\\`)
- iOS Simulator (macOS) or Android Emulator, or the Expo Go app on your device
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID and API Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

5. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

6. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

7. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

8. **Start the development server**

   \\\`\\\`\\\`bash
   npx expo start
   \\\`\\\`\\\`

   Scan the QR code with Expo Go, or press \\\`i\\\` for iOS Simulator / \\\`a\\\` for Android Emulator.

## Project Structure

\\\`\\\`\\\`
.
├── app/
│   ├── _layout.tsx        # Root layout with VaifProvider
│   └── index.tsx          # Home screen
├── lib/
│   └── vaif.ts            # Expo VAIF client setup
├── app.json               # Expo configuration
├── .env.example           # Environment variable template
└── package.json
\\\`\\\`\\\`

## Available Scripts

| Command                    | Description                       |
| -------------------------- | --------------------------------- |
| \\\`npx expo start\\\`          | Start Expo development server     |
| \\\`npx expo start --ios\\\`    | Start on iOS Simulator            |
| \\\`npx expo start --android\\\`| Start on Android Emulator         |
| \\\`npx expo start --web\\\`    | Start in web browser              |

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      auth: [
        {
          path: "app/index.tsx",
          content: `import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to VAIF</Text>
      <Text style={styles.subtitle}>Your mobile app is ready. Start building!</Text>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.push("/(auth)/signup")}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center", marginBottom: 32 },
  buttons: { gap: 12, width: "100%" },
  button: { backgroundColor: "#0070f3", borderRadius: 8, padding: 14, alignItems: "center" },
  secondaryButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#0070f3" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryText: { color: "#0070f3" },
});
`,
        },
        {
          path: "app/(auth)/login.tsx",
          content: `import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { vaif } from "../../lib/vaif";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await vaif.auth.login(email, password);
      router.replace("/");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Log In"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: "#0070f3", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
`,
        },
        {
          path: "app/(auth)/signup.tsx",
          content: `import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { vaif } from "../../lib/vaif";

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    try {
      await vaif.auth.signUp(email, password);
      router.replace("/");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creating account..." : "Sign Up"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: "#0070f3", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
`,
        },
      ],
      storage: [
        {
          path: "hooks/useImagePicker.ts",
          content: `import { useState, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { vaif } from "../lib/vaif";

interface UploadResult {
  path: string;
  publicUrl: string;
}

export function useImagePicker(bucket = "uploads") {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndUpload = useCallback(async (): Promise<UploadResult | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return null;

    setUploading(true);
    setError(null);

    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop() || "jpg";
    const filePath = \`\${Date.now()}.\${ext}\`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { data, error: uploadError } = await vaif.storage
      .from(bucket)
      .upload(filePath, blob);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return null;
    }

    const { data: urlData } = vaif.storage.from(bucket).getPublicUrl(data.path);
    setUploading(false);
    return { path: data.path, publicUrl: urlData.publicUrl };
  }, [bucket]);

  return { pickAndUpload, uploading, error };
}
`,
        },
      ],
      realtime: [
        {
          path: "hooks/useRealtimeMessages.ts",
          content: `import { useEffect, useState, useCallback } from "react";
import { vaif } from "../lib/vaif";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

export function useRealtimeMessages(channelId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vaif.from("messages").select("*").eq("channel_id", channelId)
      .order("created_at", { ascending: true }).limit(50)
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
        setLoading(false);
      });
  }, [channelId]);

  useEffect(() => {
    const channel = vaif
      .channel(\`messages:\${channelId}\`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: \`channel_id=eq.\${channelId}\` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [channelId]);

  const refresh = useCallback(async () => {
    const { data } = await vaif.from("messages").select("*").eq("channel_id", channelId).order("created_at", { ascending: true }).limit(50);
    if (data) setMessages(data as Message[]);
  }, [channelId]);

  return { messages, loading, refresh };
}
`,
        },
      ],
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaiftech/sdk-expo", "@react-native-async-storage/async-storage", "expo", "expo-router", "react", "react-native"],
    postInstructions: [
      "cd my-vaif-app",
      "npm install",
      "# Copy .env.example to .env and add your VAIF credentials",
      "npx expo start",
    ],
  },

  // ── 5. Flutter App ───────────────────────────────────────────────────
  "flutter-app": {
    name: "Flutter App",
    description: "Dart/Flutter client setup with environment configuration",
    tag: "Flutter / Dart",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "lib/main.dart",
        content: `import 'package:flutter/material.dart';
import 'vaif_client.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initVaif();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My VAIF App',
      theme: ThemeData(colorSchemeSeed: Colors.blue, useMaterial3: true),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My VAIF App')),
      body: const Center(child: Text('Welcome to VAIF! Start building.')),
    );
  }
}
`,
      },
      {
        path: "lib/vaif_client.dart",
        content: `import 'package:vaif_client/vaif_client.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

late final VaifClient vaif;

Future<void> initVaif() async {
  await dotenv.load(fileName: '.env');

  final projectId = dotenv.env['VAIF_PROJECT_ID'];
  final apiKey = dotenv.env['VAIF_API_KEY'];

  if (projectId == null || apiKey == null) {
    throw Exception('VAIF_PROJECT_ID and VAIF_API_KEY must be set in .env');
  }

  vaif = VaifClient(
    projectId: projectId,
    apiKey: apiKey,
    realtime: const RealtimeConfig(enabled: true),
  );
}
`,
      },
      {
        path: "pubspec.yaml",
        content: `name: my_vaif_app
description: A Flutter app powered by VAIF.
version: 0.1.0
publish_to: 'none'

environment:
  sdk: ^3.5.0

dependencies:
  flutter:
    sdk: flutter
  vaif_client: ^1.0.0
  flutter_dotenv: ^5.1.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
  assets:
    - .env
`,
      },
      {
        path: ".env.example",
        content: `VAIF_PROJECT_ID=your-project-id
VAIF_API_KEY=your-anon-key
`,
      },
      {
        path: ".gitignore",
        content: `build/
.dart_tool/
.packages
.env
*.iml
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — Flutter

A Flutter application powered by [VAIF Studio](https://vaif.studio), with Dart client and environment configuration.

## Prerequisites

- [Flutter SDK](https://flutter.dev/docs/get-started/install) 3.5 or later
- Dart SDK (included with Flutter)
- A VAIF Studio account — sign up at <https://vaif.studio>
- (Optional) VAIF CLI for type generation: \\\`npm install -g @vaiftech/cli\\\`

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   flutter pub get
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID and API Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI** (for schema and type generation)

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

5. **Generate Dart models**

   \\\`\\\`\\\`bash
   vaif generate --output ./lib/models/database.dart --lang dart
   \\\`\\\`\\\`

6. **Run the app**

   \\\`\\\`\\\`bash
   flutter run
   \\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
.
├── lib/
│   ├── main.dart           # App entry point
│   ├── vaif_client.dart    # VAIF client setup
│   └── screens/            # Screen widgets (added by features)
├── pubspec.yaml            # Dart dependencies
├── .env.example            # Environment variable template
└── .gitignore
\\\`\\\`\\\`

## Available Commands

| Command                  | Description                        |
| ------------------------ | ---------------------------------- |
| \\\`flutter pub get\\\`       | Install dependencies               |
| \\\`flutter run\\\`           | Run on connected device/emulator   |
| \\\`flutter build apk\\\`    | Build Android APK                  |
| \\\`flutter build ios\\\`    | Build iOS app                      |
| \\\`flutter test\\\`          | Run tests                          |

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      auth: [
        {
          path: "lib/screens/login_screen.dart",
          content: `import 'package:flutter/material.dart';
import '../vaif_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _handleLogin() async {
    setState(() { _loading = true; _error = null; });

    try {
      await vaif.auth.login(
        email: _emailController.text,
        password: _passwordController.text,
      );
      if (mounted) Navigator.of(context).pushReplacementNamed('/');
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Log In')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(controller: _emailController, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            TextField(controller: _passwordController, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            const SizedBox(height: 24),
            if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loading ? null : _handleLogin,
              child: Text(_loading ? 'Logging in...' : 'Log In'),
            ),
          ],
        ),
      ),
    );
  }
}
`,
        },
      ],
      database: [
        {
          path: "lib/models/database.dart",
          content: `/// Database models for VAIF.
/// Run \`vaif generate --output ./lib/models/database.dart --lang dart\` to regenerate.

class User {
  final String id;
  final String email;
  final String? name;
  final DateTime createdAt;

  User({required this.id, required this.email, this.name, required this.createdAt});

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: json['id'] as String,
    email: json['email'] as String,
    name: json['name'] as String?,
    createdAt: DateTime.parse(json['created_at'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'name': name,
    'created_at': createdAt.toIso8601String(),
  };
}

class Post {
  final String id;
  final String userId;
  final String title;
  final String? content;
  final bool published;
  final DateTime createdAt;

  Post({
    required this.id,
    required this.userId,
    required this.title,
    this.content,
    required this.published,
    required this.createdAt,
  });

  factory Post.fromJson(Map<String, dynamic> json) => Post(
    id: json['id'] as String,
    userId: json['user_id'] as String,
    title: json['title'] as String,
    content: json['content'] as String?,
    published: json['published'] as bool,
    createdAt: DateTime.parse(json['created_at'] as String),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'title': title,
    'content': content,
    'published': published,
    'created_at': createdAt.toIso8601String(),
  };
}
`,
        },
      ],
      functions: [
        {
          path: "lib/services/functions_service.dart",
          content: `import '../vaif_client.dart';

/// Service for invoking VAIF serverless functions.
class FunctionsService {
  /// Invoke the "hello" function with an optional name parameter.
  static Future<Map<String, dynamic>> hello({String name = 'World'}) async {
    final result = await vaif.functions.invoke(
      'hello',
      body: {'name': name},
    );
    return result.data as Map<String, dynamic>;
  }

  /// Invoke any VAIF function by name.
  static Future<Map<String, dynamic>> invoke(
    String functionName, {
    Map<String, dynamic>? body,
  }) async {
    final result = await vaif.functions.invoke(
      functionName,
      body: body ?? {},
    );
    return result.data as Map<String, dynamic>;
  }
}
`,
        },
      ],
    },
    postInstructions: [
      "flutter pub get",
      "# Copy .env.example to .env and add your VAIF credentials",
      "flutter run",
    ],
  },

  // ── 6. Python FastAPI Backend ────────────────────────────────────────
  "python-fastapi-backend": {
    name: "Python FastAPI Backend",
    description: "FastAPI backend with VAIF client, auth middleware, and type-safe queries",
    tag: "Python / FastAPI",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "main.py",
        content: `"""VAIF FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from vaif_client import get_vaif_client

app = FastAPI(title="My VAIF API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "message": "VAIF API running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/items")
async def list_items():
    client = get_vaif_client()
    result = await client.from_("items").select("*").execute()
    return {"data": result.data}
`,
      },
      {
        path: "vaif_client.py",
        content: `"""VAIF client setup for FastAPI."""

import os
from functools import lru_cache

from dotenv import load_dotenv
from vaif import Client, ServiceClient

load_dotenv()

VAIF_PROJECT_ID = os.environ["VAIF_PROJECT_ID"]
VAIF_API_KEY = os.environ["VAIF_API_KEY"]
VAIF_SECRET_KEY = os.environ.get("VAIF_SECRET_KEY", "")


@lru_cache()
def get_vaif_client() -> Client:
    """Public client using the anon key (respects Row Level Security)."""
    return Client(project_id=VAIF_PROJECT_ID, api_key=VAIF_API_KEY)


@lru_cache()
def get_vaif_admin() -> ServiceClient:
    """Admin/service client that bypasses RLS. Use with caution."""
    return ServiceClient(project_id=VAIF_PROJECT_ID, secret_key=VAIF_SECRET_KEY)
`,
      },
      {
        path: "requirements.txt",
        content: `vaif>=0.2.0
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
python-dotenv>=1.0.0
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys → Project Settings → API Keys

VAIF_PROJECT_ID=your-project-id
VAIF_API_KEY=your-anon-key
VAIF_SECRET_KEY=your-secret-key
`,
      },
      {
        path: ".gitignore",
        content: `__pycache__
*.pyc
.env
.venv
venv
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — Python FastAPI Backend

A FastAPI backend application powered by [VAIF Studio](https://vaif.studio), with auth middleware and type-safe queries.

## Prerequisites

- [Python](https://www.python.org/) 3.10 or later
- pip (included with Python)
- A VAIF Studio account — sign up at <https://vaif.studio>
- (Optional) VAIF CLI for schema management: \\\`npm install -g @vaiftech/cli\\\`

## Setup

1. **Create a virtual environment** (recommended)

   \\\`\\\`\\\`bash
   python -m venv .venv
   source .venv/bin/activate   # On Windows: .venv\\\\Scripts\\\\activate
   \\\`\\\`\\\`

2. **Install dependencies**

   \\\`\\\`\\\`bash
   pip install -r requirements.txt
   \\\`\\\`\\\`

3. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID, API Key, and Secret Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

4. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

5. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

6. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

7. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

8. **Generate Python types**

   \\\`\\\`\\\`bash
   vaif generate --lang python
   \\\`\\\`\\\`

9. **Run the development server**

   \\\`\\\`\\\`bash
   uvicorn main:app --reload
   \\\`\\\`\\\`

   The API will be available at [http://localhost:8000](http://localhost:8000). Interactive docs at [http://localhost:8000/docs](http://localhost:8000/docs).

## Project Structure

\\\`\\\`\\\`
.
├── main.py                # FastAPI application entry point
├── vaif_client.py         # VAIF client setup (public + admin)
├── middleware/
│   └── auth.py            # Auth middleware (added by auth feature)
├── routes/
│   ├── storage.py         # Storage routes (added by storage feature)
│   └── functions.py       # Functions routes (added by functions feature)
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variable template
└── .gitignore
\\\`\\\`\\\`

## Available Endpoints

| Method | Path                             | Description              |
| ------ | -------------------------------- | ------------------------ |
| GET    | \\\`/\\\`                             | Health check             |
| GET    | \\\`/health\\\`                       | Health status            |
| GET    | \\\`/items\\\`                        | List items from database |

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      auth: [
        {
          path: "middleware/auth.py",
          content: `"""VAIF auth middleware for FastAPI."""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from vaif_client import get_vaif_admin

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """FastAPI dependency that validates VAIF auth tokens.

    Usage:
        @app.get("/protected")
        async def protected_route(user=Depends(get_current_user)):
            return {"user_id": user["id"]}
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
        )

    client = get_vaif_admin()
    try:
        user = await client.auth.get_user(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return user
`,
        },
        {
          path: "middleware/__init__.py",
          content: ``,
        },
      ],
      storage: [
        {
          path: "routes/storage.py",
          content: `"""File upload routes using VAIF Storage."""

from fastapi import APIRouter, UploadFile, File
from vaif_client import get_vaif_admin

router = APIRouter(prefix="/storage", tags=["storage"])

BUCKET = "uploads"


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    client = get_vaif_admin()
    file_path = f"{file.filename}"
    contents = await file.read()

    result = await client.storage.from_(BUCKET).upload(file_path, contents)
    url_data = client.storage.from_(BUCKET).get_public_url(result.path)

    return {"path": result.path, "public_url": url_data}
`,
        },
        {
          path: "routes/__init__.py",
          content: ``,
        },
      ],
      database: [
        {
          path: "migrations/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "models.py",
          content: `"""Pydantic models matching the database schema."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: str
    name: Optional[str] = None


class User(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class PostBase(BaseModel):
    title: str
    content: Optional[str] = None
    published: bool = False


class Post(PostBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
`,
        },
      ],
      functions: [
        {
          path: "routes/functions.py",
          content: `"""Invoke VAIF serverless functions."""

from fastapi import APIRouter
from vaif_client import get_vaif_client

router = APIRouter(prefix="/functions", tags=["functions"])


@router.post("/invoke/{function_name}")
async def invoke_function(function_name: str, payload: dict = {}):
    client = get_vaif_client()
    result = await client.functions.invoke(function_name, body=payload)
    return {"data": result}
`,
        },
        {
          path: "functions/hello.py",
          content: `"""Example VAIF serverless function."""

import json
import os


def handler(request):
    """Simple hello function.

    Deploy with: vaif functions deploy
    """
    # Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
    # are available as environment variables at runtime:
    # api_key = os.environ.get("MY_API_KEY")

    try:
        body = json.loads(request.body) if request.body else {}
        name = body.get("name", "World")
    except (json.JSONDecodeError, AttributeError):
        name = "World"

    return {
        "statusCode": 200,
        "body": json.dumps({"message": f"Hello, {name}!"}),
    }
`,
        },
      ],
    },
    postInstructions: [
      "pip install -r requirements.txt",
      "# Copy .env.example to .env and add your VAIF credentials",
      "uvicorn main:app --reload",
    ],
  },

  // ── 7. Go Backend API ────────────────────────────────────────────────
  "go-backend-api": {
    name: "Go Backend API",
    description: "Go backend with VAIF client initialisation and HTTP middleware",
    tag: "Go",
    defaultFeatures: ["database", "auth"],
    files: [
      {
        path: "main.go",
        content: `package main

import (
\t"encoding/json"
\t"log"
\t"net/http"

\t"github.com/joho/godotenv"
\t"myapp/vaif"
)

func main() {
\t_ = godotenv.Load()

\tif err := vaif.Init(); err != nil {
\t\tlog.Fatalf("Failed to initialise VAIF: %v", err)
\t}

\tmux := http.NewServeMux()

\tmux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
\t\tjson.NewEncoder(w).Encode(map[string]string{"status": "ok"})
\t})

\tlog.Println("Server running on :8080")
\tlog.Fatal(http.ListenAndServe(":8080", mux))
}
`,
      },
      {
        path: "vaif/client.go",
        content: `package vaif

import (
\t"fmt"
\t"os"

\tvaifclient "github.com/vaif-technologies/vaif-go"
)

var Client *vaifclient.Client

func Init() error {
\tprojectID := os.Getenv("VAIF_PROJECT_ID")
\tapiKey := os.Getenv("VAIF_API_KEY")
\tsecretKey := os.Getenv("VAIF_SECRET_KEY")

\tif projectID == "" || apiKey == "" {
\t\treturn fmt.Errorf("VAIF_PROJECT_ID and VAIF_API_KEY must be set")
\t}

\tvar err error
\tClient, err = vaifclient.NewClient(vaifclient.Config{
\t\tProjectID: projectID,
\t\tAPIKey:    apiKey,
\t\tSecretKey: secretKey,
\t})
\tif err != nil {
\t\treturn fmt.Errorf("failed to create VAIF client: %w", err)
\t}

\treturn nil
}
`,
      },
      {
        path: "go.mod",
        content: `module myapp

go 1.22

require (
\tgithub.com/joho/godotenv v1.5.1
\tgithub.com/vaif-technologies/vaif-go v1.0.0
)
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
VAIF_PROJECT_ID=your-project-id
VAIF_API_KEY=your-anon-key
VAIF_SECRET_KEY=your-secret-key
`,
      },
      {
        path: ".gitignore",
        content: `*.exe
*.exe~
*.dll
*.so
*.dylib
.env
`,
      },
      {
        path: "README.md",
        content: `# My VAIF App — Go Backend API

A Go backend API powered by [VAIF Studio](https://vaif.studio), with HTTP handlers and auth middleware.

## Prerequisites

- [Go](https://go.dev/dl/) 1.22 or later
- A VAIF Studio account — sign up at <https://vaif.studio>
- (Optional) VAIF CLI for schema management: \\\`npm install -g @vaiftech/cli\\\`

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   go mod tidy
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID, API Key, and Secret Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

5. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

6. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

7. **Generate Go types**

   \\\`\\\`\\\`bash
   vaif generate --lang go
   \\\`\\\`\\\`

8. **Run the server**

   \\\`\\\`\\\`bash
   go run main.go
   \\\`\\\`\\\`

   The API will be available at [http://localhost:8080](http://localhost:8080).

## Project Structure

\\\`\\\`\\\`
.
├── main.go                # Application entry point
├── vaif/
│   └── client.go          # VAIF client initialisation
├── middleware/
│   └── auth.go            # Auth middleware (added by auth feature)
├── handlers/
│   └── storage.go         # Storage handlers (added by storage feature)
├── go.mod                 # Go module definition
├── .env.example           # Environment variable template
└── .gitignore
\\\`\\\`\\\`

## Available Endpoints

| Method | Path       | Description    |
| ------ | ---------- | -------------- |
| GET    | \\\`/health\\\` | Health check   |

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      auth: [
        {
          path: "middleware/auth.go",
          content: `package middleware

import (
\t"net/http"
\t"strings"

\t"myapp/vaif"
\tvaifclient "github.com/vaif-technologies/vaif-go"
)

func AuthMiddleware(next http.Handler) http.Handler {
\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
\t\tauth := r.Header.Get("Authorization")
\t\tif auth == "" {
\t\t\thttp.Error(w, "missing authorization header", http.StatusUnauthorized)
\t\t\treturn
\t\t}

\t\ttoken := strings.TrimPrefix(auth, "Bearer ")
\t\tif token == auth {
\t\t\thttp.Error(w, "invalid authorization format", http.StatusUnauthorized)
\t\t\treturn
\t\t}

\t\tuser, err := vaif.Client.Auth.GetUser(r.Context(), token)
\t\tif err != nil {
\t\t\thttp.Error(w, "invalid or expired token", http.StatusUnauthorized)
\t\t\treturn
\t\t}

\t\tctx := vaifclient.WithUser(r.Context(), user)
\t\tnext.ServeHTTP(w, r.WithContext(ctx))
\t})
}
`,
        },
      ],
      storage: [
        {
          path: "handlers/storage.go",
          content: `package handlers

import (
\t"encoding/json"
\t"fmt"
\t"io"
\t"net/http"
\t"time"

\t"myapp/vaif"
)

func UploadHandler(w http.ResponseWriter, r *http.Request) {
\tif r.Method != http.MethodPost {
\t\thttp.Error(w, "method not allowed", http.StatusMethodNotAllowed)
\t\treturn
\t}

\tfile, header, err := r.FormFile("file")
\tif err != nil {
\t\thttp.Error(w, "invalid file", http.StatusBadRequest)
\t\treturn
\t}
\tdefer file.Close()

\tdata, err := io.ReadAll(file)
\tif err != nil {
\t\thttp.Error(w, "failed to read file", http.StatusInternalServerError)
\t\treturn
\t}

\tpath := fmt.Sprintf("%d-%s", time.Now().Unix(), header.Filename)
\tresult, err := vaif.Client.Storage.From("uploads").Upload(r.Context(), path, data)
\tif err != nil {
\t\thttp.Error(w, "upload failed", http.StatusInternalServerError)
\t\treturn
\t}

\tw.Header().Set("Content-Type", "application/json")
\tjson.NewEncoder(w).Encode(result)
}
`,
        },
      ],
      database: [
        {
          path: "migrations/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project
-- Use goose or another Go migration tool to apply:
--   goose postgres "$DATABASE_URL" up

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "models/models.go",
          content: `package models

import (
\t"time"

\t"github.com/google/uuid"
)

type User struct {
\tID        uuid.UUID \`json:"id"\`
\tEmail     string    \`json:"email"\`
\tName      *string   \`json:"name,omitempty"\`
\tCreatedAt time.Time \`json:"created_at"\`
}

type Post struct {
\tID        uuid.UUID \`json:"id"\`
\tUserID    uuid.UUID \`json:"user_id"\`
\tTitle     string    \`json:"title"\`
\tContent   *string   \`json:"content,omitempty"\`
\tPublished bool      \`json:"published"\`
\tCreatedAt time.Time \`json:"created_at"\`
}
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.go",
          content: `package functions

import (
\t"encoding/json"
\t"fmt"
\t"net/http"
)

// HelloRequest is the expected request body.
type HelloRequest struct {
\tName string \`json:"name"\`
}

// HelloResponse is the response body.
type HelloResponse struct {
\tMessage string \`json:"message"\`
}

// HelloHandler is an example VAIF serverless function.
//
// Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
// are available as environment variables at runtime:
//
//\tapiKey := os.Getenv("MY_API_KEY")  // import "os"
func HelloHandler(w http.ResponseWriter, r *http.Request) {
\tvar req HelloRequest
\tif err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
\t\treq.Name = "World"
\t}

\tw.Header().Set("Content-Type", "application/json")
\tjson.NewEncoder(w).Encode(HelloResponse{
\t\tMessage: fmt.Sprintf("Hello, %s!", req.Name),
\t})
}
`,
        },
      ],
    },
    postInstructions: [
      "go mod tidy",
      "# Copy .env.example to .env and add your VAIF credentials",
      "go run main.go",
    ],
  },

  // ── 8. Todo App ──────────────────────────────────────────────────────
  "todo-app": {
    name: "Todo App",
    description: "Simple React todo app – great for learning VAIF basics",
    tag: "React Starter",
    defaultFeatures: ["database"],
    files: [
      {
        path: "src/lib/vaif.ts",
        content: `import { createVaifClient } from "@vaif/client";

export const vaif = createVaifClient({
  baseUrl: import.meta.env.VITE_VAIF_API_URL || 'https://api.vaif.studio',
  projectId: import.meta.env.VITE_VAIF_PROJECT_ID,
  apiKey: import.meta.env.VITE_VAIF_API_KEY,
});

// Typed helpers for the todos table
export interface Todo {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
  user_id?: string;
}

export async function getTodos(): Promise<Todo[]> {
  const { data, error } = await vaif
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Todo[];
}

export async function addTodo(title: string): Promise<Todo> {
  const { data, error } = await vaif
    .from("todos")
    .insert({ title, done: false })
    .select()
    .single();

  if (error) throw error;
  return data as Todo;
}

export async function toggleTodo(id: string, done: boolean): Promise<void> {
  const { error } = await vaif
    .from("todos")
    .update({ done })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await vaif
    .from("todos")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys

VITE_VAIF_API_URL=https://api.vaif.studio
VITE_VAIF_PROJECT_ID=your-project-id
VITE_VAIF_API_KEY=your-api-key
`,
      },
      {
        path: "README.md",
        content: `# Todo App — VAIF Starter

A simple React todo application for learning [VAIF Studio](https://vaif.studio) basics, including typed database queries and CRUD operations.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID and API Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Create the todos table**

   Create a \\\`todos\\\` table in your VAIF dashboard with columns:
   - \\\`id\\\` (uuid, primary key)
   - \\\`title\\\` (text)
   - \\\`done\\\` (boolean)
   - \\\`created_at\\\` (timestamptz)
   - \\\`user_id\\\` (uuid, optional)

5. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

6. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

7. **Run the development server**

   \\\`\\\`\\\`bash
   npm run dev
   \\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
.
├── src/
│   └── lib/
│       └── vaif.ts         # VAIF client + typed todo helpers
├── .env.example            # Environment variable template
└── package.json
\\\`\\\`\\\`

## Key Files

- **\\\`src/lib/vaif.ts\\\`** — VAIF client setup plus typed helpers for \\\`getTodos\\\`, \\\`addTodo\\\`, \\\`toggleTodo\\\`, and \\\`deleteTodo\\\`.

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaif/client", "@vaiftech/react"],
    postInstructions: [
      "Copy .env.example to .env and fill in your project credentials",
      "Create a 'todos' table in your VAIF dashboard with columns: id (uuid), title (text), done (boolean), created_at (timestamptz)",
      "Import helpers from './lib/vaif' in your components",
      "Run: npx vaif generate  to generate TypeScript types",
    ],
  },

  // ── 9. Realtime Chat ─────────────────────────────────────────────────
  "realtime-chat": {
    name: "Realtime Chat",
    description: "React chat app with VAIF realtime subscriptions for live messaging",
    tag: "React + Realtime",
    defaultFeatures: ["database", "realtime", "auth"],
    files: [
      {
        path: "src/lib/vaif.ts",
        content: `import { createVaifClient } from "@vaif/client";

export const vaif = createVaifClient({
  baseUrl: import.meta.env.VITE_VAIF_API_URL || 'https://api.vaif.studio',
  projectId: import.meta.env.VITE_VAIF_PROJECT_ID,
  apiKey: import.meta.env.VITE_VAIF_API_KEY,
});

export interface Message {
  id: string;
  content: string;
  user_id: string;
  username: string;
  channel_id: string;
  created_at: string;
}

export async function sendMessage(
  channelId: string,
  content: string,
  userId: string,
  username: string,
): Promise<Message> {
  const { data, error } = await vaif
    .from("messages")
    .insert({
      content,
      user_id: userId,
      username,
      channel_id: channelId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function getMessages(channelId: string, limit = 50): Promise<Message[]> {
  const { data, error } = await vaif
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as Message[];
}
`,
      },
      {
        path: "src/hooks/useRealtimeMessages.ts",
        content: `import { useEffect, useState, useCallback } from "react";
import { vaif, type Message, getMessages } from "../lib/vaif";

interface UseRealtimeMessagesOptions {
  channelId: string;
  initialLimit?: number;
}

/**
 * Hook that subscribes to realtime message changes on a channel.
 *
 * Usage:
 *   const { messages, isLoading, error } = useRealtimeMessages({
 *     channelId: "general",
 *   });
 */
export function useRealtimeMessages({
  channelId,
  initialLimit = 50,
}: UseRealtimeMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial messages
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const data = await getMessages(channelId, initialLimit);
        if (!cancelled) {
          setMessages(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [channelId, initialLimit]);

  // Subscribe to realtime changes
  useEffect(() => {
    const subscription = vaif
      .channel(\`messages:\${channelId}\`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: \`channel_id=eq.\${channelId}\`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new as Message]);
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === (payload.new as Message).id
                  ? (payload.new as Message)
                  : msg,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) =>
              prev.filter((msg) => msg.id !== (payload.old as Message).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [channelId]);

  const refresh = useCallback(async () => {
    const data = await getMessages(channelId, initialLimit);
    setMessages(data);
  }, [channelId, initialLimit]);

  return { messages, isLoading, error, refresh };
}
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys

VITE_VAIF_API_URL=https://api.vaif.studio
VITE_VAIF_PROJECT_ID=your-project-id
VITE_VAIF_API_KEY=your-api-key
`,
      },
      {
        path: "README.md",
        content: `# Realtime Chat — VAIF Starter

A React chat application with live messaging powered by [VAIF Studio](https://vaif.studio) realtime subscriptions.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env
   \\\`\\\`\\\`

   Get your Project ID and API Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Create the messages table**

   Create a \\\`messages\\\` table in your VAIF dashboard with columns:
   - \\\`id\\\` (uuid, primary key)
   - \\\`content\\\` (text)
   - \\\`user_id\\\` (text)
   - \\\`username\\\` (text)
   - \\\`channel_id\\\` (text)
   - \\\`created_at\\\` (timestamptz)

5. **Enable Realtime**

   In your VAIF dashboard, enable Realtime on the \\\`messages\\\` table.

6. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

7. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

8. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

9. **Run the development server**

   \\\`\\\`\\\`bash
   npm run dev
   \\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
.
├── src/
│   ├── lib/
│   │   └── vaif.ts                  # VAIF client + message helpers
│   └── hooks/
│       └── useRealtimeMessages.ts   # Realtime subscription hook
├── .env.example                     # Environment variable template
└── package.json
\\\`\\\`\\\`

## Key Files

- **\\\`src/lib/vaif.ts\\\`** — VAIF client setup with realtime enabled, plus \\\`sendMessage\\\` and \\\`getMessages\\\` helpers.
- **\\\`src/hooks/useRealtimeMessages.ts\\\`** — React hook that subscribes to live message updates on a channel.

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaif/client", "@vaiftech/react"],
    postInstructions: [
      "Copy .env.example to .env and fill in your project credentials",
      "Create a 'messages' table with columns: id (uuid), content (text), user_id (text), username (text), channel_id (text), created_at (timestamptz)",
      "Enable Realtime on the messages table in your VAIF dashboard",
      "Use the useRealtimeMessages hook in your components",
      "Run: npx vaif generate  to generate TypeScript types",
    ],
  },

  // ── 10. SaaS Starter ─────────────────────────────────────────────────
  "saas-starter": {
    name: "SaaS Starter",
    description: "Full SaaS starter with VAIF auth, team/org support, and server-side helpers",
    tag: "Next.js SaaS",
    defaultFeatures: ["database", "auth", "functions"],
    files: [
      {
        path: "lib/vaif.ts",
        content: `import { createVaifClient } from "@vaif/client";

// Browser client – use in Client Components
export const vaif = createVaifClient({
  baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
  projectId: process.env.NEXT_PUBLIC_VAIF_PROJECT_ID,
  apiKey: process.env.NEXT_PUBLIC_VAIF_API_KEY!,
});

// Server client – use in Server Components, Route Handlers, Server Actions
export function createVaifServer() {
  return createVaifClient({
    baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
    projectId: process.env.VAIF_PROJECT_ID,
    apiKey: process.env.VAIF_SECRET_KEY!,
  });
}
`,
      },
      {
        path: "lib/auth.ts",
        content: `import { createVaifServer } from "./vaif";

// ── User helpers ────────────────────────────────────────────────────

export async function getCurrentUser() {
  const vaif = createVaifServer();
  const { data: { user }, error } = await vaif.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ── Team / Organisation helpers ─────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  joined_at: string;
}

export async function getUserTeams(userId: string): Promise<Team[]> {
  const vaif = createVaifServer();

  // Get team IDs the user belongs to
  const { data: memberships, error: memberError } = await vaif
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (memberError) throw memberError;
  if (!memberships?.length) return [];

  const teamIds = memberships.map((m) => m.team_id);

  const { data: teams, error: teamError } = await vaif
    .from("teams")
    .select("*")
    .in("id", teamIds)
    .order("name");

  if (teamError) throw teamError;
  return (teams ?? []) as Team[];
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const vaif = createVaifServer();

  const { data, error } = await vaif
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("joined_at");

  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export async function createTeam(name: string, slug: string): Promise<Team> {
  const user = await requireUser();
  const vaif = createVaifServer();

  const { data: team, error } = await vaif
    .from("teams")
    .insert({ name, slug, owner_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // Add the creator as owner
  await vaif.from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    role: "owner",
  });

  return team as Team;
}

export async function inviteToTeam(
  teamId: string,
  email: string,
  role: TeamMember["role"] = "member",
): Promise<void> {
  const vaif = createVaifServer();

  // Look up user by email
  const { data: users } = await vaif
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (!users?.length) {
    throw new Error("User not found. They must create an account first.");
  }

  const { error } = await vaif.from("team_members").insert({
    team_id: teamId,
    user_id: users[0].id,
    role,
  });

  if (error) throw error;
}

// ── Role-based checks ───────────────────────────────────────────────

export async function requireTeamRole(
  teamId: string,
  requiredRoles: TeamMember["role"][],
): Promise<TeamMember> {
  const user = await requireUser();
  const vaif = createVaifServer();

  const { data: member, error } = await vaif
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (error || !member) {
    throw new Error("Not a member of this team");
  }

  if (!requiredRoles.includes(member.role)) {
    throw new Error(\`Requires one of: \${requiredRoles.join(", ")}\`);
  }

  return member as TeamMember;
}
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys → Project Settings → API Keys

NEXT_PUBLIC_VAIF_API_URL=https://api.vaif.studio
NEXT_PUBLIC_VAIF_PROJECT_ID=your-project-id
NEXT_PUBLIC_VAIF_API_KEY=your-api-key
VAIF_SECRET_KEY=your-secret-key

# CLI project ID (for vaif generate, vaif pull, vaif secrets, etc.)
VAIF_PROJECT_ID=your-project-id
`,
      },
      {
        path: "README.md",
        content: `# SaaS Starter — VAIF Studio

A full SaaS starter kit powered by [VAIF Studio](https://vaif.studio) with authentication, team/organization support, role-based access control, and server-side helpers.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env.local
   \\\`\\\`\\\`

   Get your Project ID, API Key, and Secret Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Create required tables**

   Create the following tables in your VAIF dashboard:
   - \\\`teams\\\` — id (uuid), name (text), slug (text), owner_id (uuid), created_at (timestamptz)
   - \\\`team_members\\\` — id (uuid), team_id (uuid), user_id (uuid), role (text), joined_at (timestamptz)

5. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

6. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

7. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

8. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

9. **Run the development server**

   \\\`\\\`\\\`bash
   npm run dev
   \\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
.
├── lib/
│   ├── vaif.ts        # Browser + server VAIF client setup
│   └── auth.ts        # User, team, and role-based auth helpers
├── .env.example       # Environment variable template
└── package.json
\\\`\\\`\\\`

## Key Files

- **\\\`lib/vaif.ts\\\`** — Browser and server VAIF client setup.
- **\\\`lib/auth.ts\\\`** — Helpers for \\\`getCurrentUser\\\`, \\\`requireUser\\\`, \\\`getUserTeams\\\`, \\\`createTeam\\\`, \\\`inviteToTeam\\\`, and \\\`requireTeamRole\\\`.

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaif/client", "@vaiftech/auth", "@vaiftech/react"],
    postInstructions: [
      "Copy .env.example to .env.local and fill in your project credentials",
      "Create 'teams' and 'team_members' tables in your VAIF dashboard",
      "Import auth helpers from '@/lib/auth' in your Server Components/Actions",
      "Use requireUser() for authenticated routes and requireTeamRole() for role checks",
      "Run: npx vaif generate  to generate TypeScript types",
    ],
  },

  // ── 11. E-commerce API ───────────────────────────────────────────────
  "ecommerce-api": {
    name: "E-commerce API",
    description: "API-first e-commerce setup with VAIF storage for product images",
    tag: "Next.js E-commerce",
    defaultFeatures: ["database", "auth", "storage"],
    files: [
      {
        path: "lib/vaif.ts",
        content: `import { createVaifClient } from "@vaif/client";

// Browser client
export const vaif = createVaifClient({
  baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
  projectId: process.env.NEXT_PUBLIC_VAIF_PROJECT_ID,
  apiKey: process.env.NEXT_PUBLIC_VAIF_API_KEY!,
});

// Server client
export function createVaifServer() {
  return createVaifClient({
    baseUrl: process.env.NEXT_PUBLIC_VAIF_API_URL || 'https://api.vaif.studio',
    projectId: process.env.VAIF_PROJECT_ID,
    apiKey: process.env.VAIF_SECRET_KEY!,
  });
}
`,
      },
      {
        path: "lib/storage.ts",
        content: `import { createVaifServer } from "./vaif";

const PRODUCT_IMAGES_BUCKET = "product-images";

interface UploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Upload a product image to VAIF Storage.
 *
 * @param file - The file buffer or Blob to upload
 * @param productId - Product ID used to organise files in folders
 * @param fileName - Original filename (will be sanitised)
 * @returns The storage path and public URL
 */
export async function uploadProductImage(
  file: Buffer | Blob,
  productId: string,
  fileName: string,
): Promise<UploadResult> {
  const vaif = createVaifServer();

  // Sanitise filename and build path
  const sanitised = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = \`\${productId}/\${Date.now()}-\${sanitised}\`;

  const { data, error } = await vaif.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: getContentType(fileName),
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = vaif.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

/**
 * Delete a product image from storage.
 */
export async function deleteProductImage(storagePath: string): Promise<void> {
  const vaif = createVaifServer();

  const { error } = await vaif.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([storagePath]);

  if (error) throw error;
}

/**
 * Generate a signed URL for a private product image.
 *
 * @param storagePath - The path returned from uploadProductImage
 * @param expiresIn - Seconds until the URL expires (default: 1 hour)
 */
export async function getSignedImageUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string> {
  const vaif = createVaifServer();

  const { data, error } = await vaif.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * List all images for a product.
 */
export async function listProductImages(productId: string) {
  const vaif = createVaifServer();

  const { data, error } = await vaif.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .list(productId, {
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) throw error;
  return data;
}

function getContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
  };
  return mimeTypes[ext ?? ""] ?? "application/octet-stream";
}
`,
      },
      {
        path: ".env.example",
        content: `# VAIF Configuration
# Get these values from https://console.vaif.studio/security/api-keys → Project Settings → API Keys

NEXT_PUBLIC_VAIF_API_URL=https://api.vaif.studio
NEXT_PUBLIC_VAIF_PROJECT_ID=your-project-id
NEXT_PUBLIC_VAIF_API_KEY=your-api-key
VAIF_SECRET_KEY=your-secret-key

# CLI project ID (for vaif generate, vaif pull, vaif secrets, etc.)
VAIF_PROJECT_ID=your-project-id
`,
      },
      {
        path: "README.md",
        content: `# E-commerce API — VAIF Studio

An API-first e-commerce setup powered by [VAIF Studio](https://vaif.studio) with product image storage, signed URLs, and server-side helpers.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- A VAIF Studio account — sign up at <https://vaif.studio>

## Setup

1. **Install dependencies**

   \\\`\\\`\\\`bash
   npm install
   \\\`\\\`\\\`

2. **Configure credentials**

   \\\`\\\`\\\`bash
   cp .env.example .env.local
   \\\`\\\`\\\`

   Get your Project ID, API Key, and Secret Key from <https://console.vaif.studio/security/api-keys> under **Project Settings > API Keys**.

3. **Install and log in to the VAIF CLI**

   \\\`\\\`\\\`bash
   npm install -g @vaiftech/cli
   vaif login
   \\\`\\\`\\\`

4. **Create a storage bucket**

   In your VAIF dashboard, create a \\\`product-images\\\` storage bucket.

5. **Pull your database schema**

   \\\`\\\`\\\`bash
   vaif pull
   \\\`\\\`\\\`

6. **Push database migrations** (if using the database feature)

   \\\`\\\`\\\`bash
   vaif db push
   \\\`\\\`\\\`

7. **Deploy serverless functions** (if using the functions feature)

   \\\`\\\`\\\`bash
   vaif functions deploy
   \\\`\\\`\\\`

8. **Generate TypeScript types**

   \\\`\\\`\\\`bash
   vaif generate
   \\\`\\\`\\\`

9. **Run the development server**

   \\\`\\\`\\\`bash
   npm run dev
   \\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
.
├── lib/
│   ├── vaif.ts        # Browser + server VAIF client setup
│   └── storage.ts     # Product image upload, delete, signed URLs
├── .env.example       # Environment variable template
└── package.json
\\\`\\\`\\\`

## Key Files

- **\\\`lib/vaif.ts\\\`** — Browser and server VAIF client setup.
- **\\\`lib/storage.ts\\\`** — Helpers for \\\`uploadProductImage\\\`, \\\`deleteProductImage\\\`, \\\`getSignedImageUrl\\\`, and \\\`listProductImages\\\`.

## Documentation

Full documentation is available at <https://docs.vaif.studio>.
`,
      },
    ],
    featureFiles: {
      database: [
        {
          path: "drizzle/0001_initial.sql",
          content: `-- Initial migration
-- Customize this schema for your project

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "content" text,
  "published" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
`,
        },
        {
          path: "drizzle.config.ts",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`,
        },
        {
          path: "src/db/schema.ts",
          content: `import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
`,
        },
      ],
      functions: [
        {
          path: "functions/hello.ts",
          content: `export default async function handler(req: Request): Promise<Response> {
  const { name } = await req.json().catch(() => ({ name: "World" }));

  // Secrets set via \\\`vaif secrets set\\\` or the Security > Secrets page
  // are available as environment variables at runtime:
  // const apiKey = process.env.MY_API_KEY;

  return Response.json({ message: \`Hello, \${name}!\` });
}
`,
        },
      ],
    },
    dependencies: ["@vaif/client", "@vaiftech/auth"],
    postInstructions: [
      "Copy .env.example to .env.local and fill in your project credentials",
      "Create a 'product-images' storage bucket in your VAIF dashboard",
      "Import storage helpers from '@/lib/storage' in your API routes",
      "Use uploadProductImage() in your product creation flow",
      "Run: npx vaif generate  to generate TypeScript types",
    ],
  },
};

// ---------------------------------------------------------------------------
// List templates command
// ---------------------------------------------------------------------------

export function listTemplates(): void {
  console.log("");
  console.log(chalk.bold("Available project templates"));
  console.log("");

  const nameWidth = 26;
  const tagWidth = 22;

  // Header
  console.log(
    `  ${chalk.gray("Template".padEnd(nameWidth))}${chalk.gray("Stack".padEnd(tagWidth))}${chalk.gray("Description")}`,
  );
  console.log(chalk.gray("  " + "-".repeat(nameWidth + tagWidth + 40)));

  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    console.log(
      `  ${chalk.cyan(key.padEnd(nameWidth))}${chalk.yellow(tpl.tag.padEnd(tagWidth))}${chalk.white(tpl.description)}`,
    );
  }

  console.log("");
  console.log(chalk.gray("Usage:"));
  console.log(chalk.gray(`  npx @vaiftech/cli init --template <name>`));
  console.log(chalk.gray(`  npx @vaiftech/cli init -t nextjs-fullstack`));
  console.log(chalk.gray(`  npx @vaiftech/cli init -t react-spa --features auth,database,realtime`));
  console.log("");
  console.log(chalk.gray("Available features: auth, database, realtime, storage, functions"));
  console.log("");
}

// ---------------------------------------------------------------------------
// Scaffold a template into the current working directory
// ---------------------------------------------------------------------------

export interface ScaffoldOptions {
  force?: boolean;
  features?: string[];
  addOnly?: boolean; // Only add feature files, skip base files
}

// ---------------------------------------------------------------------------
// Interactive feature selection
// ---------------------------------------------------------------------------

async function promptFeatures(defaultFeatures: FeatureName[]): Promise<FeatureName[]> {
  // If not a TTY, return defaults
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return defaultFeatures;
  }

  const selected = new Set<number>(
    defaultFeatures.map((f) => ALL_FEATURES.findIndex((af) => af.name === f)).filter((i) => i >= 0),
  );
  let cursor = 0;

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    readline.emitKeypressEvents(process.stdin, rl);
    if (process.stdin.setRawMode) process.stdin.setRawMode(true);

    function render() {
      // Move cursor up to re-render (after first render)
      const lines = ALL_FEATURES.length + 2;
      process.stdout.write(`\x1b[${lines}A`);
      printMenu();
    }

    function printMenu() {
      console.log(chalk.bold("\n? Which VAIF features do you want to include?"));
      ALL_FEATURES.forEach((feat, i) => {
        const check = selected.has(i) ? chalk.green("[x]") : "[ ]";
        const pointer = i === cursor ? chalk.cyan("> ") : "  ";
        console.log(`${pointer}${check} ${feat.label} ${chalk.gray(`(${feat.description})`)}`);
      });
      console.log(chalk.gray("  (up/down to move, space to toggle, enter to confirm)"));
    }

    printMenu();

    process.stdin.on("keypress", (_str: string, key: readline.Key) => {
      if (key.name === "up" && cursor > 0) {
        cursor--;
        render();
      } else if (key.name === "down" && cursor < ALL_FEATURES.length - 1) {
        cursor++;
        render();
      } else if (key.name === "space") {
        if (selected.has(cursor)) selected.delete(cursor);
        else selected.add(cursor);
        render();
      } else if (key.name === "return") {
        if (process.stdin.setRawMode) process.stdin.setRawMode(false);
        rl.close();
        const result = [...selected].sort().map((i) => ALL_FEATURES[i].name);
        resolve(result.length > 0 ? result : defaultFeatures);
      } else if (key.name === "c" && key.ctrl) {
        if (process.stdin.setRawMode) process.stdin.setRawMode(false);
        rl.close();
        process.exit(0);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Scaffold a template into the current working directory
// ---------------------------------------------------------------------------

export async function scaffoldTemplate(
  templateName: string,
  options: ScaffoldOptions = {},
): Promise<void> {
  const template = TEMPLATES[templateName];

  if (!template) {
    console.log(chalk.red(`\nUnknown template: ${templateName}`));
    console.log(chalk.yellow("Run 'vaif templates' to see available templates.\n"));
    process.exit(1);
  }

  // Determine features to include
  let features: FeatureName[];
  if (options.features && options.features.length > 0) {
    features = options.features.filter((f): f is FeatureName =>
      ALL_FEATURES.some((af) => af.name === f),
    );
  } else if (options.addOnly) {
    // --add-features mode requires explicit features
    console.log(chalk.red("\nNo features specified."));
    console.log(chalk.yellow("Usage: vaif init --template <name> --add-features <features>"));
    console.log(chalk.gray("Available features: auth, database, realtime, storage, functions"));
    process.exit(1);
  } else if (template.featureFiles && Object.keys(template.featureFiles).length > 0) {
    features = await promptFeatures(template.defaultFeatures ?? ["database", "auth"]);
  } else {
    features = template.defaultFeatures ?? [];
  }

  if (options.addOnly) {
    console.log("");
    console.log(
      chalk.bold(`Adding features to ${chalk.cyan(template.name)} project...`),
    );
    console.log(chalk.gray(`  Features: ${features.join(", ")}`));
    console.log("");
  } else {
    console.log("");
    console.log(
      chalk.bold(`Scaffolding ${chalk.cyan(template.name)} template...`),
    );
    if (features.length > 0) {
      console.log(chalk.gray(`  Features: ${features.join(", ")}`));
    }
    console.log("");
  }

  // Collect files: base + features for full scaffold, only features for --add-features
  // Feature files can override base files (e.g. auth adds routes to App.tsx)
  const baseFiles = options.addOnly ? [] : [...template.files];
  const featureFilePaths = new Set<string>();
  const featureFilesList: typeof baseFiles = [];
  if (template.featureFiles) {
    for (const feat of features) {
      const featureFileList = template.featureFiles[feat];
      if (featureFileList) {
        for (const f of featureFileList) {
          featureFilePaths.add(f.path);
          featureFilesList.push(f);
        }
      }
    }
  }
  // Filter out base files that are overridden by feature files, then append feature files
  const allFiles = baseFiles.filter(f => !featureFilePaths.has(f.path)).concat(featureFilesList);

  let filesCreated = 0;
  let filesSkipped = 0;

  for (const file of allFiles) {
    const fullPath = path.resolve(file.path);
    const dir = path.dirname(fullPath);

    // Create directories if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // For package.json, merge dependencies into existing file instead of skipping
    if (file.path === "package.json" && fs.existsSync(fullPath) && !options.force) {
      try {
        const existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        const tpl = JSON.parse(file.content);
        // Strip workspace:* and link: protocols from existing deps (monorepo artifacts)
        const cleanDeps = (deps: Record<string, string> | undefined) => {
          if (!deps) return {};
          const cleaned: Record<string, string> = {};
          for (const [k, v] of Object.entries(deps)) {
            if (!v.startsWith("workspace:") && !v.startsWith("link:") && !v.startsWith("file:")) {
              cleaned[k] = v;
            }
          }
          return cleaned;
        };
        existing.dependencies = { ...cleanDeps(existing.dependencies), ...(tpl.dependencies || {}) };
        existing.devDependencies = { ...cleanDeps(existing.devDependencies), ...(tpl.devDependencies || {}) };
        if (tpl.scripts) {
          existing.scripts = { ...(existing.scripts || {}), ...tpl.scripts };
        }
        fs.writeFileSync(fullPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
        console.log(chalk.green(`  merge   ${file.path}  (added dependencies)`));
        filesCreated++;
        continue;
      } catch {
        // If merge fails, fall through to normal skip
      }
    }

    // Skip existing files unless force is set
    if (fs.existsSync(fullPath) && !options.force) {
      console.log(chalk.yellow(`  skip  ${file.path}  (already exists)`));
      filesSkipped++;
      continue;
    }

    fs.writeFileSync(fullPath, file.content, "utf-8");
    console.log(chalk.green(`  create  ${file.path}`));
    filesCreated++;
  }

  console.log("");

  if (filesCreated > 0) {
    console.log(
      chalk.green(`Created ${filesCreated} file${filesCreated !== 1 ? "s" : ""}.`),
    );
  }
  if (filesSkipped > 0) {
    console.log(
      chalk.yellow(
        `Skipped ${filesSkipped} file${filesSkipped !== 1 ? "s" : ""} (use --force to overwrite).`,
      ),
    );
  }

  // ── Inject feature-specific dependencies into package.json ────────
  const featureDeps: Record<FeatureName, Record<string, string>> = {
    auth: { "@vaiftech/auth": "^1.0.0" },
    database: {},
    realtime: {},
    storage: {},
    functions: {},
  };

  const pkgPath = path.resolve("package.json");
  if (fs.existsSync(pkgPath) && features.length > 0) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      let added = false;
      for (const feat of features) {
        const deps = featureDeps[feat];
        if (deps) {
          for (const [name, version] of Object.entries(deps)) {
            if (!pkg.dependencies?.[name]) {
              pkg.dependencies = pkg.dependencies || {};
              pkg.dependencies[name] = version;
              added = true;
            }
          }
        }
      }
      if (added) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      }
    } catch {
      // Silently skip if package.json can't be parsed
    }
  }

  // ── Dependency instructions ────────────────────────────────────────

  if (template.dependencies?.length || template.devDependencies?.length) {
    console.log("");
    console.log(chalk.bold("Install dependencies:"));
    if (template.dependencies?.length) {
      console.log(
        chalk.cyan(`  npm install ${template.dependencies.join(" ")}`),
      );
    }
    if (template.devDependencies?.length) {
      console.log(
        chalk.cyan(
          `  npm install -D ${template.devDependencies.join(" ")}`,
        ),
      );
    }
  }

  // ── Post-scaffold instructions ─────────────────────────────────────

  console.log("");
  console.log(chalk.bold.green("Project scaffolded successfully!"));
  console.log("");
  console.log(chalk.bold("  Next steps:"));
  template.postInstructions.forEach((line) => {
    console.log(chalk.gray(`    ${line}`));
  });
  console.log("");
  console.log(chalk.gray("  Get your project credentials at https://console.vaif.studio/security/api-keys"));
  console.log("");
}
