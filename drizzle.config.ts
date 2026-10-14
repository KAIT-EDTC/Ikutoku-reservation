import { defineConfig } from 'drizzle-kit'

// Generated SQL is applied with `wrangler d1 migrations apply` (it ignores migrations/meta).
export default defineConfig({ dialect: 'sqlite', schema: './server/schema.ts', out: './migrations' })
