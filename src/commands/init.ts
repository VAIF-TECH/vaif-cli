import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { scaffoldTemplate } from "./templates.js";
import { claudeSetup } from "./claude-setup.js";
import { CLAUDE_MD_TEMPLATES, type ClaudeTemplateType } from "./claude-templates.js";

interface InitOptions {
  typescript?: boolean;
  force?: boolean;
  template?: string;
  features?: string;
  addFeatures?: string;
  claude?: string | true;
}

const defaultConfig = {
  $schema: "https://vaif.studio/schemas/config.json",
  projectId: "",
  database: {
    url: "${DATABASE_URL}",
    schema: "public",
  },
  types: {
    output: "./src/types/database.ts",
  },
  api: {
    baseUrl: "https://api.vaif.studio",
  },
};

export async function initConfig(options: InitOptions): Promise<void> {
  // --claude mode: generate CLAUDE.md for AI assistants
  if (options.claude !== undefined) {
    const templateType = typeof options.claude === "string" ? options.claude : null;

    // If a specific template type was given, use the static template
    if (templateType && templateType in CLAUDE_MD_TEMPLATES) {
      const spinner = ora("Generating CLAUDE.md from template...").start();
      let template = CLAUDE_MD_TEMPLATES[templateType as ClaudeTemplateType];

      // Phase 2: Append team conventions if found
      const conventions = importTeamConventions();
      if (conventions) {
        template += `\n## Team Conventions\n\n${conventions}\n`;
      }

      const outputPath = path.resolve("CLAUDE.md");

      if (fs.existsSync(outputPath) && !options.force) {
        spinner.fail("CLAUDE.md already exists");
        console.log(chalk.yellow("\nUse --force to overwrite."));
        process.exit(1);
      }

      fs.writeFileSync(outputPath, template, "utf-8");
      spinner.succeed(`Created CLAUDE.md (${templateType} template)`);
      if (conventions) {
        console.log(chalk.gray("  Imported team conventions from existing config files."));
      }
      console.log(chalk.gray("\n  Customize the generated CLAUDE.md with your project details."));
      console.log(chalk.gray("  For a personalized version from live data, run: vaif claude-setup\n"));
      return;
    }

    if (templateType && !(templateType in CLAUDE_MD_TEMPLATES)) {
      console.log(chalk.red(`\n  Unknown template type: "${templateType}"`));
      console.log(chalk.gray("  Available types: base, saas, mobile, ecommerce"));
      console.log(chalk.gray("  Or omit the type to auto-generate from your live project: vaif init --claude\n"));
      process.exit(1);
    }

    // No template type specified — Phase 2: auto-detect project type, then try live
    const detected = detectProjectType();
    if (detected) {
      console.log(chalk.gray(`\n  Detected project type: ${chalk.cyan(detected)}`));
      console.log(chalk.gray("  Generating from live project data with template context...\n"));
    } else {
      console.log(chalk.gray("\n  Generating from live project data...\n"));
    }

    await claudeSetup({ skipMcp: false });
    return;
  }

  // --add-features mode: add feature files to an existing project
  if (options.addFeatures) {
    if (!options.template) {
      console.log(chalk.red("\n--add-features requires --template to know which template to use."));
      console.log(chalk.gray("Example: vaif init --template react-spa --add-features functions,storage"));
      process.exit(1);
    }

    const features = options.addFeatures.split(",").map((f: string) => f.trim());
    await scaffoldTemplate(options.template, { force: options.force, features, addOnly: true });
    return;
  }

  const spinner = ora("Initializing VAIF configuration...").start();

  const configPath = path.resolve("vaif.config.json");

  // Check if config already exists
  if (fs.existsSync(configPath) && !options.force) {
    spinner.fail("vaif.config.json already exists");
    console.log(chalk.yellow("\nUse --force to overwrite existing configuration."));
    process.exit(1);
  }

  try {
    // Write config file
    fs.writeFileSync(
      configPath,
      JSON.stringify(defaultConfig, null, 2),
      "utf-8"
    );

    spinner.succeed("Created vaif.config.json");

    // If a template was specified, scaffold it
    if (options.template) {
      const features = options.features
        ? options.features.split(",").map((f: string) => f.trim())
        : undefined;
      await scaffoldTemplate(options.template, { force: options.force, features });
    } else {
      // Default behaviour: create a basic .env.example
      const envExamplePath = path.resolve(".env.example");
      if (!fs.existsSync(envExamplePath)) {
        const envExample = `# VAIF Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/database
VAIF_API_KEY=your-api-key
`;
        fs.writeFileSync(envExamplePath, envExample, "utf-8");
        console.log(chalk.gray("Created .env.example"));
      }

      // Create types directory if TypeScript
      if (options.typescript) {
        const typesDir = path.resolve("src/types");
        if (!fs.existsSync(typesDir)) {
          fs.mkdirSync(typesDir, { recursive: true });
          console.log(chalk.gray("Created src/types directory"));
        }
      }

      console.log("");
      console.log(chalk.green("VAIF initialized successfully!"));
      console.log("");
      console.log(chalk.gray("Next steps:"));
      console.log(chalk.gray("  1. Update vaif.config.json with your project ID"));
      console.log(chalk.gray("  2. Set DATABASE_URL in your environment"));
      console.log(chalk.gray("  3. Run: npx vaif generate"));
      console.log("");
    }

  } catch (error) {
    spinner.fail("Failed to initialize");
    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}`));
    }
    process.exit(1);
  }
}

// ============================================================================
// Phase 2: Project-type detection + convention import
// ============================================================================

/**
 * Detect project type by examining package.json dependencies and directory structure.
 */
function detectProjectType(): ClaudeTemplateType | null {
  try {
    const pkgPath = path.resolve("package.json");
    if (!fs.existsSync(pkgPath)) return null;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    // Mobile detection
    if (deps["expo"] || deps["react-native"] || deps["@vaiftech/sdk-expo"]) return "mobile";
    if (fs.existsSync(path.resolve("pubspec.yaml"))) return "mobile";
    if (fs.existsSync(path.resolve("Package.swift")) || fs.existsSync(path.resolve("*.xcodeproj"))) return "mobile";

    // E-commerce detection
    if (deps["stripe"] || deps["@stripe/stripe-js"] || deps["shopify-api-node"] || deps["@shopify/shopify-api"]) {
      // Check for e-commerce indicators
      const hasProductsOrOrders = fs.existsSync(path.resolve("src/models/product.ts")) ||
        fs.existsSync(path.resolve("src/models/order.ts")) ||
        fs.existsSync(path.resolve("src/pages/products")) ||
        fs.existsSync(path.resolve("src/pages/cart"));
      if (hasProductsOrOrders) return "ecommerce";
    }

    // SaaS detection (multi-tenant indicators)
    if (deps["stripe"] || deps["@stripe/stripe-js"]) return "saas";
    if (pkg.name?.includes("saas") || pkg.description?.toLowerCase().includes("saas")) return "saas";

    return "base";
  } catch {
    return null;
  }
}

/**
 * Import team conventions from existing AI config files.
 * Reads .cursorrules, .github/copilot-instructions.md, .windsurfrules, etc.
 */
function importTeamConventions(): string | null {
  const conventionFiles = [
    { path: ".cursorrules", label: "Cursor Rules" },
    { path: ".github/copilot-instructions.md", label: "GitHub Copilot Instructions" },
    { path: ".windsurfrules", label: "Windsurf Rules" },
    { path: ".clinerules", label: "Cline Rules" },
  ];

  const sections: string[] = [];

  for (const file of conventionFiles) {
    const filePath = path.resolve(file.path);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8").trim();
        if (content.length > 0 && content.length < 10000) {
          sections.push(`### From ${file.label} (\`${file.path}\`)\n\n${content}`);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}
