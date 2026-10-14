import { defineConfig } from 'drizzle-kit'

// 生成したSQLは `wrangler d1 migrations apply` で適用する（drizzle/meta は wrangler からは無視される）
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
})
