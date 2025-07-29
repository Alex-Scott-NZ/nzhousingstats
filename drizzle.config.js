// drizzle.config.js

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite', // Standard SQLite
  schema: './lib/db/schema.ts', 
  out: './drizzle',
  dbCredentials: {
    url: 'file:data/nzhousingstats.db',
  },
});