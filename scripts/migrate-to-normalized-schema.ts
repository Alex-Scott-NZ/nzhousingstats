#!/usr/bin/env node
// scripts\migrate-to-normalized-schema.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../lib/db/index";
import { sql } from "drizzle-orm";

async function migrateDatabase() {
  console.log("🔄 Starting database migration to normalized schema...\n");

  try {
    // Step 0: Pre-migration data verification
    console.log("🔍 Pre-migration data verification...");
    
    const originalData = (await db.get(sql`
      SELECT 
        (SELECT COUNT(*) FROM location_snapshots WHERE location_type = 'region') as regions,
        (SELECT COUNT(*) FROM location_snapshots WHERE location_type = 'district') as districts,  
        (SELECT COUNT(*) FROM location_snapshots WHERE location_type = 'suburb') as suburbs,
        (SELECT SUM(listing_count) FROM location_snapshots WHERE location_type = 'region') as region_total,
        (SELECT SUM(listing_count) FROM location_snapshots WHERE location_type = 'district') as district_total,
        (SELECT SUM(listing_count) FROM location_snapshots WHERE location_type = 'suburb') as suburb_total,
        (SELECT COUNT(*) FROM location_snapshots WHERE location_type = 'suburb' AND listing_count IS NOT NULL) as suburbs_with_counts,
        (SELECT COUNT(*) FROM weekly_snapshots) as weekly_snapshots
    `)) as {
      regions: number;
      districts: number;
      suburbs: number;
      region_total: number;
      district_total: number;
      suburb_total: number;
      suburbs_with_counts: number;
      weekly_snapshots: number;
    };

    console.log("📊 Original data summary:");
    console.log(`   Regions: ${originalData.regions} (total: ${originalData.region_total?.toLocaleString()})`);
    console.log(`   Districts: ${originalData.districts} (total: ${originalData.district_total?.toLocaleString()})`);
    console.log(`   Suburbs: ${originalData.suburbs} (total: ${originalData.suburb_total?.toLocaleString()})`);
    console.log(`   Suburbs with counts: ${originalData.suburbs_with_counts}`);
    console.log(`   Weekly snapshots: ${originalData.weekly_snapshots}`);
    
    // Red flag check
    if (originalData.district_total === originalData.suburb_total) {
      console.log("⚠️  WARNING: District and suburb totals are identical - potential double counting detected!");
    }

    // Step 1: Create new tables (using TradeMe IDs as primary keys)
    console.log("\n📋 Creating new normalized tables...");

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS regions (
        id INTEGER PRIMARY KEY,  -- TradeMe LocalityId directly
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS districts (
        id INTEGER PRIMARY KEY,  -- TradeMe DistrictId directly
        name TEXT NOT NULL,
        region_id INTEGER NOT NULL REFERENCES regions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS suburbs (
        id INTEGER PRIMARY KEY,  -- TradeMe SuburbId directly
        name TEXT NOT NULL,
        district_id INTEGER NOT NULL REFERENCES districts(id),
        region_id INTEGER NOT NULL REFERENCES regions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS listing_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_date DATE NOT NULL,
        collected_at TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'completed',
        processing_time_ms INTEGER,
        UNIQUE(snapshot_date)
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS suburb_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
        listing_type_id INTEGER NOT NULL REFERENCES listing_types(id),
        suburb_id INTEGER NOT NULL REFERENCES suburbs(id),  -- References TradeMe SuburbId
        listing_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(snapshot_id, listing_type_id, suburb_id)
      )
    `);

    console.log("✅ New tables created successfully!");

    // Step 2: Populate listing types
    console.log("\n📝 Populating listing types...");
    await db.run(sql`
      INSERT OR IGNORE INTO listing_types (code, name, category) VALUES
      ('HOUSES_TO_BUY', 'Houses for Sale', 'RESIDENTIAL'),
      ('HOUSES_TO_RENT', 'Houses for Rent', 'RESIDENTIAL'),
      ('COMMERCIAL_FOR_SALE', 'Commercial for Sale', 'COMMERCIAL'),
      ('COMMERCIAL_FOR_LEASE', 'Commercial for Lease', 'COMMERCIAL')
    `);

    // Step 3: Populate regions (FILTER OUT LocalityId 100)
    console.log("\n🏔️ Populating regions...");
    await db.run(sql`
      INSERT OR IGNORE INTO regions (id, name)
      SELECT DISTINCT region_id, region_name 
      FROM location_snapshots 
      WHERE region_id IS NOT NULL 
        AND region_name IS NOT NULL
        AND region_id != 100  -- ✅ FILTER OUT DUMMY LOCALITY
    `);

    const regionCount = (await db.get(sql`SELECT COUNT(*) as count FROM regions`)) as { count: number };
    console.log(`   Added ${regionCount.count} regions (filtered out LocalityId 100)`);

    // Step 4: Populate districts
    console.log("\n🏘️ Populating districts...");
    await db.run(sql`
      INSERT OR IGNORE INTO districts (id, name, region_id)
      SELECT DISTINCT 
        ls.district_id, 
        ls.district_name,
        ls.region_id  -- Direct reference to TradeMe LocalityId
      FROM location_snapshots ls
      WHERE ls.district_id IS NOT NULL 
        AND ls.district_name IS NOT NULL
        AND ls.region_id IS NOT NULL
        AND ls.region_id != 100  -- ✅ FILTER OUT DUMMY LOCALITY
    `);

    const districtCount = (await db.get(sql`SELECT COUNT(*) as count FROM districts`)) as { count: number };
    console.log(`   Added ${districtCount.count} districts`);

    // Step 5: Populate suburbs
    console.log("\n🏠 Populating suburbs...");
    await db.run(sql`
      INSERT OR IGNORE INTO suburbs (id, name, district_id, region_id)
      SELECT DISTINCT 
        ls.suburb_id,
        ls.suburb_name,
        ls.district_id,  -- Direct reference to TradeMe DistrictId
        ls.region_id     -- Direct reference to TradeMe LocalityId
      FROM location_snapshots ls
      WHERE ls.suburb_id IS NOT NULL 
        AND ls.suburb_name IS NOT NULL
        AND ls.district_id IS NOT NULL
        AND ls.region_id IS NOT NULL
        AND ls.location_type = 'suburb'
        AND ls.region_id != 100  -- ✅ FILTER OUT DUMMY LOCALITY
    `);

    const suburbCount = (await db.get(sql`SELECT COUNT(*) as count FROM suburbs`)) as { count: number };
    console.log(`   Added ${suburbCount.count} suburbs`);

    // Step 6: Migrate snapshots
    console.log("\n📅 Migrating snapshots...");
    await db.run(sql`
      INSERT OR IGNORE INTO snapshots (snapshot_date, collected_at, status)
      SELECT DISTINCT 
        snapshot_date,
        collected_at,
        'completed'
      FROM weekly_snapshots
      ORDER BY snapshot_date
    `);

    const snapshotCount = (await db.get(sql`SELECT COUNT(*) as count FROM snapshots`)) as { count: number };
    console.log(`   Migrated ${snapshotCount.count} snapshots`);

    // Step 7: Migrate ONLY suburb listings data (single source of truth)
    console.log("\n📊 Migrating suburb listing data (ONLY suburbs)...");

    await db.run(sql`
      INSERT OR IGNORE INTO suburb_listings (snapshot_id, listing_type_id, suburb_id, listing_count)
      SELECT 
        s.id,
        lt.id,
        ls.suburb_id,  -- Direct use of TradeMe SuburbId
        ls.listing_count
      FROM location_snapshots ls
      JOIN snapshots s ON ls.snapshot_date = s.snapshot_date
      JOIN listing_types lt ON ls.listing_type = lt.code
      WHERE ls.location_type = 'suburb'         -- ONLY suburbs
        AND ls.listing_count IS NOT NULL       -- Skip NULL counts
        AND ls.listing_count > 0               -- Skip zero counts
        AND ls.region_id != 100                -- ✅ FILTER OUT DUMMY LOCALITY
    `);

    const listingCount = (await db.get(sql`SELECT COUNT(*) as count FROM suburb_listings`)) as { count: number };
    console.log(`   Migrated ${listingCount.count} suburb listing records`);

    // Step 8: Verification & Integrity Checks
    console.log("\n🔍 Post-migration verification...");

    const verification = (await db.get(sql`
      SELECT 
        (SELECT COUNT(*) FROM regions) as regions,
        (SELECT COUNT(*) FROM districts) as districts,
        (SELECT COUNT(*) FROM suburbs) as suburbs,
        (SELECT COUNT(*) FROM snapshots) as snapshots,
        (SELECT COUNT(*) FROM suburb_listings) as suburb_listings,
        (SELECT SUM(listing_count) FROM suburb_listings) as total_listings
    `)) as {
      regions: number;
      districts: number;
      suburbs: number;
      snapshots: number;
      suburb_listings: number;
      total_listings: number;
    };

    console.log(`   📊 Regions: ${verification.regions} (should be 15, not 16)`);
    console.log(`   📊 Districts: ${verification.districts}`);
    console.log(`   📊 Suburbs: ${verification.suburbs}`);
    console.log(`   📊 Snapshots: ${verification.snapshots}`);
    console.log(`   📊 Suburb Listings: ${verification.suburb_listings}`);
    console.log(`   📊 New Total Listings: ${verification.total_listings?.toLocaleString()}`);

    // Data integrity check
    console.log("\n✅ Data integrity check:");
    console.log(`   Original suburb total: ${originalData.suburb_total?.toLocaleString()}`);
    console.log(`   New calculated total:  ${verification.total_listings?.toLocaleString()}`);
    
    if (originalData.suburb_total === verification.total_listings) {
      console.log("   ✅ Totals match! Data migration successful.");
    } else {
      console.log("   ⚠️  Totals don't match - investigate further!");
    }

    console.log('\n🎉 Migration completed!');
    console.log('\n🔧 Next steps:');
    console.log('   1. Check data in Drizzle Studio');
    console.log('   2. Remove LocalityId 100 if it exists');
    console.log('   3. Drop old tables when confident');
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateDatabase();