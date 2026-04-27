import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: false,
  clean: true,
  target: "es2020",
  minify: true,
  treeshake: true,
  shims: true,
  async onSuccess() {
    // Add shebang to cli.js after build
    const cliPath = join(process.cwd(), "dist", "cli.js");
    try {
      const content = readFileSync(cliPath, "utf-8");
      if (!content.startsWith("#!/usr/bin/env node")) {
        writeFileSync(cliPath, `#!/usr/bin/env node\n${content}`);
      }
    } catch {
      // File might not exist yet
    }
  },
});
