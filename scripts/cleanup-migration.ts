#!/usr/bin/env node
// scripts\cleanup-migration.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function cleanup() {
  console.log('🧹 Cleaning up migration tables...\n');
  
  try {
    await db.run(sql`DROP TABLE IF EXISTS suburb_listings`);
    await db.run(sql`DROP TABLE IF EXISTS snapshots`); 
    await db.run(sql`DROP TABLE IF EXISTS suburbs`);
    await db.run(sql`DROP TABLE IF EXISTS districts`);
    await db.run(sql`DROP TABLE IF EXISTS regions`);
    await db.run(sql`DROP TABLE IF EXISTS listing_types`);
    
    console.log('✅ All migration tables dropped');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

cleanup();