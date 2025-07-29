// lib/db/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Weekly snapshots table - stores raw API responses
 * One record per listing type per week
 */
export const weeklySnapshots = sqliteTable('weekly_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotDate: text('snapshot_date').notNull(), // YYYY-MM-DD format
  listingType: text('listing_type').notNull(), // HOUSES_TO_BUY, HOUSES_TO_RENT, etc.
  totalNzListings: integer('total_nz_listings').notNull(),
  collectedAt: text('collected_at').notNull(), // ISO timestamp
  rawData: text('raw_data').notNull(), // JSON stringified API response
});

/**
 * Location snapshots table - flattened data for easy querying
 * One record per location per week
 */
export const locationSnapshots = sqliteTable('location_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotDate: text('snapshot_date').notNull(), // Links to weekly_snapshots
  listingType: text('listing_type').notNull(),
  
  // Location hierarchy
  regionId: integer('region_id').notNull(),
  regionName: text('region_name').notNull(),
  districtId: integer('district_id'), // NULL for region-level records
  districtName: text('district_name'),
  suburbId: integer('suburb_id'), // NULL for district/region-level records
  suburbName: text('suburb_name'),
  
  // Location type and data
  locationType: text('location_type').notNull(), // 'region', 'district', 'suburb'
  listingCount: integer('listing_count'), // NULL if no listings
  
  // Metadata
  collectedAt: text('collected_at').notNull(), // ISO timestamp
});

// Export types for use in application
export type WeeklySnapshot = typeof weeklySnapshots.$inferSelect;
export type NewWeeklySnapshot = typeof weeklySnapshots.$inferInsert;
export type LocationSnapshot = typeof locationSnapshots.$inferSelect;
export type NewLocationSnapshot = typeof locationSnapshots.$inferInsert;