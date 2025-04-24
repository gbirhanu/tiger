import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./migrations",
  dialect: "turso"
});
