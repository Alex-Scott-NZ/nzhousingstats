// lib\db\index.ts

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Create database connection
const client = createClient({
  url: 'file:data/nzhousingstats.db'
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from './schema';