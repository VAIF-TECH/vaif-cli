/**
 * Static CLAUDE.md templates for different project types.
 * Used by `vaif init --claude <type>` when no live project is available.
 *
 * For personalized CLAUDE.md from live project data, use `vaif claude-setup`.
 */

export type ClaudeTemplateType = "base" | "saas" | "mobile" | "ecommerce";

export const CLAUDE_MD_TEMPLATES: Record<ClaudeTemplateType, string> = {
  base: `# VAIF Studio Backend

This project uses **VAIF Studio** as its backend.

## SDK Setup

\`\`\`bash
npm install @vaif/client
\`\`\`

\`\`\`typescript
import { createVaifClient } from "@vaif/client";

const vaif = createVaifClient({
  baseUrl: "https://api.vaif.studio",
  projectId: process.env.VAIF_PROJECT_ID!,
  apiKey: process.env.VAIF_API_KEY!,
});
\`\`\`

## MCP Server

This project includes an MCP server for Claude Code integration. Tools available:

- **Database**: list_tables, describe_table, query_rows, insert_row, update_row, delete_row
- **Schema**: get_schema, create_tables
- **Storage**: list_buckets, create_bucket, list_files, get_signed_url
- **Functions**: list_functions, invoke_function, create_function, deploy_function
- **Auth**: list_api_keys, create_api_key
- **Realtime**: realtime_status, enable_realtime

## Database

\`\`\`typescript
// Query
const { data } = await vaif.from("table_name").select().eq("column", value);

// Insert
const { data } = await vaif.from("table_name").insert({ column: value });

// Update
await vaif.from("table_name").update({ column: newValue }).eq("id", recordId);

// Delete
await vaif.from("table_name").delete().eq("id", recordId);
\`\`\`

## Authentication

\`\`\`typescript
// Sign up
await vaif.auth.signUp({ email, password });

// Sign in
const { data } = await vaif.auth.signIn({ email, password });

// OAuth
await vaif.auth.signInWithOAuth({ provider: "google", redirectTo: callbackUrl });

// Get current user
const user = await vaif.auth.getUser();
\`\`\`

## Storage

\`\`\`typescript
// Upload
await vaif.storage.from("bucket").upload("path/file.png", file);

// Signed URL
const { url } = await vaif.storage.from("bucket").createSignedUrl("path/file.png", 3600);

// List files
const { data } = await vaif.storage.from("bucket").list("path/");
\`\`\`

## Functions

\`\`\`typescript
// Invoke
const result = await vaif.functions.invoke("function_name", { body: { key: "value" } });
\`\`\`

> Function names must be alphanumeric + underscores only (\`^[a-zA-Z0-9_]+$\`).

## Realtime

\`\`\`typescript
const subscription = vaif.realtime
  .channel("table_name")
  .on("INSERT", (payload) => console.log("New:", payload.new))
  .on("UPDATE", (payload) => console.log("Updated:", payload.new))
  .on("DELETE", (payload) => console.log("Removed:", payload.old))
  .subscribe();
\`\`\`

## Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| eq | Equal | \`.eq("status", "active")\` |
| neq | Not equal | \`.neq("status", "deleted")\` |
| gt / gte | Greater than | \`.gt("age", 18)\` |
| lt / lte | Less than | \`.lt("price", 100)\` |
| in | In array | \`.in("role", ["admin", "editor"])\` |
| like / ilike | Pattern match | \`.ilike("name", "%john%")\` |
| is | IS NULL check | \`.is("deleted_at", null)\` |

## Auth Headers

| Mode | Header | Used For |
|------|--------|----------|
| API Key | \`x-vaif-key: vaif_xxx\` | Data-plane: CRUD, storage, functions |
| JWT Token | \`Authorization: Bearer <jwt>\` | Control-plane: schema, project management |

## Environment Variables

\`\`\`bash
VAIF_API_URL=https://api.vaif.studio
VAIF_PROJECT_ID=proj_xxx
VAIF_API_KEY=vaif_xxx
\`\`\`
`,

  saas: `# VAIF Studio — SaaS Backend

This project uses **VAIF Studio** as its backend for a SaaS application.

## SDK Setup

\`\`\`bash
npm install @vaif/client @vaif/react
\`\`\`

\`\`\`typescript
import { createVaifClient } from "@vaif/client";

const vaif = createVaifClient({
  baseUrl: "https://api.vaif.studio",
  projectId: process.env.VAIF_PROJECT_ID!,
  apiKey: process.env.VAIF_API_KEY!,
});
\`\`\`

## Common SaaS Schema Patterns

### Multi-Tenant with Organizations

\`\`\`sql
-- Organizations (tenants)
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Organization members
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member', -- owner, admin, member
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Tenant-scoped data
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_projects_org ON projects(org_id);
\`\`\`

### Row-Level Security for Multi-Tenancy

\`\`\`typescript
// Scope all queries to the current organization
const projects = await vaif.from("projects").select().eq("org_id", currentOrgId);

// Or use RLS headers for automatic scoping
const data = await vaif.from("projects").select({
  headers: { "x-vaif-rls": \\\`org_id:\${currentOrgId}\\\` },
});
\`\`\`

### Auth Flows

\`\`\`typescript
// Sign up → create org → add as owner
const { data: user } = await vaif.auth.signUp({ email, password });
const { data: org } = await vaif.from("orgs").insert({ name: orgName, slug });
await vaif.from("org_members").insert({ org_id: org.id, user_id: user.id, role: "owner" });
\`\`\`

### Billing Integration

\`\`\`typescript
// Store Stripe customer/subscription IDs
CREATE TABLE billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE REFERENCES orgs(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
);

// Webhook handler (VAIF Function)
export default async function handler(req, ctx) {
  const event = req.body;
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    await vaif.from("billing_accounts")
      .update({ plan: sub.metadata.plan, period_end: sub.current_period_end })
      .eq("stripe_subscription_id", sub.id);
  }
  return { received: true };
}
\`\`\`

### Invite System

\`\`\`sql
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);
\`\`\`

## API Key Scoping

\`\`\`
x-vaif-key: vaif_xxx          → Data-plane (CRUD, storage, functions)
Authorization: Bearer <jwt>   → Control-plane (schema, project management)
\`\`\`

## Environment Variables

\`\`\`bash
VAIF_API_URL=https://api.vaif.studio
VAIF_PROJECT_ID=proj_xxx
VAIF_API_KEY=vaif_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
\`\`\`
`,

  mobile: `# VAIF Studio — Mobile App Backend

This project uses **VAIF Studio** as its backend for a mobile application (React Native/Expo, Flutter, or Swift).

## SDK Setup

### React Native / Expo
\`\`\`bash
npm install @vaif/client
\`\`\`

\`\`\`typescript
import { Vaif } from "@vaif/client";

const vaif = new Vaif({
  baseURL: "https://api.vaif.studio",
  apiKey: "vaif_xxx",
});
\`\`\`

### Flutter / Dart
\`\`\`yaml
# pubspec.yaml
dependencies:
  vaif_client: ^1.0.0
\`\`\`

\`\`\`dart
import 'package:vaif_client/vaif_client.dart';

final vaif = VaifClient(
  baseUrl: 'https://api.vaif.studio',
  projectId: 'proj_xxx',
  apiKey: 'vaif_xxx',
);
\`\`\`

### Swift / iOS
\`\`\`swift
// Package.swift
.package(url: "https://github.com/VAIF-TECH/vaif-swift", from: "0.2.0")

import VaifClient

let vaif = VaifClient(
    baseUrl: "https://api.vaif.studio",
    projectId: "proj_xxx",
    apiKey: "vaif_xxx"
)
\`\`\`

## Common Mobile Patterns

### User Profiles with Avatars

\`\`\`sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  push_token TEXT,
  device_type TEXT, -- ios, android
  last_seen TIMESTAMPTZ DEFAULT now()
);
\`\`\`

### Push Notifications

\`\`\`typescript
// Store push tokens
await vaif.from("profiles").update({
  push_token: expoPushToken,
  device_type: Platform.OS,
}).eq("user_id", userId);

// Send notification (VAIF Function)
export default async function handler(req, ctx) {
  const { userId, title, body } = req.body;
  const { data: profile } = await vaif.from("profiles")
    .select("push_token, device_type")
    .eq("user_id", userId)
    .single();

  // Send via Expo Push API or APNs/FCM
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: profile.push_token,
      title, body,
    }),
  });
  return { sent: true };
}
\`\`\`

### Offline-First with Sync

\`\`\`typescript
// Cache data locally, sync when online
import AsyncStorage from "@react-native-async-storage/async-storage";

// Fetch and cache
const { data } = await vaif.from("items").select();
await AsyncStorage.setItem("items_cache", JSON.stringify(data));

// Read from cache when offline
const cached = JSON.parse(await AsyncStorage.getItem("items_cache") || "[]");
\`\`\`

### Image Upload from Camera

\`\`\`typescript
import * as ImagePicker from "expo-image-picker";

const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
if (!result.canceled) {
  const uri = result.assets[0].uri;
  const response = await fetch(uri);
  const blob = await response.blob();

  await vaif.storage.from("avatars").upload(
    \\\`\${userId}/avatar.jpg\\\`,
    blob,
    { contentType: "image/jpeg" }
  );
}
\`\`\`

### Realtime Chat

\`\`\`typescript
// Subscribe to new messages
const subscription = vaif.realtime
  .channel("messages")
  .on("INSERT", (payload) => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();

// Send a message
await vaif.from("messages").insert({
  room_id: roomId,
  user_id: userId,
  content: messageText,
});
\`\`\`

## Auth with Secure Token Storage

The Expo SDK automatically stores auth tokens in SecureStore (iOS Keychain / Android Keystore).

\`\`\`typescript
import { Vaif } from "@vaif/client";

const vaif = new Vaif({ baseURL: "https://api.vaif.studio", apiKey: "vaif_xxx" });

async function login(email: string, password: string) {
  const { token } = await vaif.auth.login({ email, password });
  // Persist token via expo-secure-store / SecureStore
}
\`\`\`

## Environment Variables

\`\`\`bash
VAIF_API_URL=https://api.vaif.studio
VAIF_PROJECT_ID=proj_xxx
VAIF_API_KEY=vaif_xxx
EXPO_PUBLIC_VAIF_PROJECT_ID=proj_xxx
EXPO_PUBLIC_VAIF_API_KEY=vaif_xxx
\`\`\`
`,

  ecommerce: `# VAIF Studio — E-Commerce Backend

This project uses **VAIF Studio** as its backend for an e-commerce application.

## SDK Setup

\`\`\`bash
npm install @vaif/client
\`\`\`

\`\`\`typescript
import { createVaifClient } from "@vaif/client";

const vaif = createVaifClient({
  baseUrl: "https://api.vaif.studio",
  projectId: process.env.VAIF_PROJECT_ID!,
  apiKey: process.env.VAIF_API_KEY!,
});
\`\`\`

## E-Commerce Schema

\`\`\`sql
-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  sku TEXT UNIQUE,
  inventory_count INTEGER DEFAULT 0,
  category_id UUID REFERENCES categories(id),
  images JSONB DEFAULT '[]', -- [{url, alt, position}]
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- draft, active, archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled
  subtotal NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) DEFAULT 0,
  shipping NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  shipping_address JSONB,
  billing_address JSONB,
  stripe_payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Cart (session-based)
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  items JSONB DEFAULT '[]', -- [{productId, quantity, price}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reviews_product ON reviews(product_id);
\`\`\`

## Common Patterns

### Product Listing with Filters

\`\`\`typescript
// Browse products with category filter and pagination
const { data: products } = await vaif
  .from("products")
  .select("id, name, slug, price, compare_at_price, images, category:categories(name)")
  .eq("status", "active")
  .eq("category_id", categoryId)
  .order("created_at", { ascending: false })
  .limit(20)
  .offset(page * 20);
\`\`\`

### Cart Management

\`\`\`typescript
// Add to cart
const cart = await vaif.from("carts").select().eq("user_id", userId).single();
const items = [...(cart.data?.items || [])];
const existing = items.findIndex(i => i.productId === productId);
if (existing >= 0) {
  items[existing].quantity += quantity;
} else {
  items.push({ productId, quantity, price });
}
await vaif.from("carts").update({ items, updated_at: new Date().toISOString() }).eq("id", cart.data.id);
\`\`\`

### Order Creation

\`\`\`typescript
// Create order from cart
const { data: order } = await vaif.from("orders").insert({
  user_id: userId,
  subtotal, tax, shipping,
  total: subtotal + tax + shipping,
  shipping_address: addressData,
});

// Create order items
const orderItems = cartItems.map(item => ({
  order_id: order.id,
  product_id: item.productId,
  quantity: item.quantity,
  unit_price: item.price,
  total: item.price * item.quantity,
}));
await vaif.from("order_items").insert(orderItems);
\`\`\`

### Inventory Management

\`\`\`typescript
// Decrement inventory on order (VAIF Function)
export default async function handler(req, ctx) {
  const { items } = req.body; // [{productId, quantity}]
  for (const item of items) {
    const { data: product } = await vaif.from("products")
      .select("inventory_count")
      .eq("id", item.productId)
      .single();

    if (product.inventory_count < item.quantity) {
      return { error: \\\`Insufficient stock for \${item.productId}\\\` };
    }

    await vaif.from("products")
      .update({ inventory_count: product.inventory_count - item.quantity })
      .eq("id", item.productId);
  }
  return { success: true };
}
\`\`\`

### Payment Webhooks

\`\`\`typescript
// Stripe webhook handler (VAIF Function)
export default async function handler(req, ctx) {
  const sig = req.headers["stripe-signature"];
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, ctx.secrets.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case "payment_intent.succeeded":
      await vaif.from("orders")
        .update({ status: "confirmed" })
        .eq("stripe_payment_intent_id", event.data.object.id);
      break;
    case "payment_intent.payment_failed":
      await vaif.from("orders")
        .update({ status: "cancelled" })
        .eq("stripe_payment_intent_id", event.data.object.id);
      break;
  }
  return { received: true };
}
\`\`\`

### Product Image Upload

\`\`\`typescript
// Upload product images to storage
const { url } = await vaif.storage
  .from("product-images")
  .upload(\\\`\${productId}/\${fileName}\\\`, file, { contentType: "image/webp" });

// Update product images array
const { data: product } = await vaif.from("products").select("images").eq("id", productId).single();
const images = [...(product.images || []), { url, alt: altText, position: product.images.length }];
await vaif.from("products").update({ images }).eq("id", productId);
\`\`\`

## Environment Variables

\`\`\`bash
VAIF_API_URL=https://api.vaif.studio
VAIF_PROJECT_ID=proj_xxx
VAIF_API_KEY=vaif_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
\`\`\`

> **Note**: \`numeric\` columns (like \`price\`) serialize to JSON strings to preserve precision. Parse with \`parseFloat()\` before arithmetic.
`,
};
