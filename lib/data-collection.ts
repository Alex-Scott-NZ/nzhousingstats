// lib/data-collection.ts

import { db, weeklySnapshots, locationSnapshots } from './db/index';
import type { TradeMeLocalitiesResponse, ListingType } from './types/trademe.js';
import { eq, desc, and } from 'drizzle-orm';

/**
 * Collect and store TradeMe property data
 */
export async function collectPropertyData(listingType: ListingType): Promise<{
  success: boolean;
  totalRecords: number;
  totalNzListings: number;
  error?: string;
}> {
  const startTime = Date.now();
  const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const collectedAt = new Date().toISOString();

  try {
    console.log(`🔍 Collecting ${listingType} data...`);
    
    // Fetch data from TradeMe API
    const url = `https://api.trademe.co.nz/v1/localities.json?with_counts=true&listing_type=${listingType}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NZHousingStats/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status} ${response.statusText}`);
    }

    const regions: TradeMeLocalitiesResponse = await response.json();
    
    // Calculate total NZ listings
    const totalNzListings = regions.reduce((total, region) => total + (region.Count || 0), 0);
    
    console.log(`📊 Found ${totalNzListings.toLocaleString()} ${listingType} listings`);

    // Store raw snapshot
    const [weeklySnapshot] = await db.insert(weeklySnapshots).values({
      snapshotDate,
      listingType,
      totalNzListings,
      collectedAt,
      rawData: JSON.stringify(regions),
    }).returning();

    console.log(`💾 Stored weekly snapshot (ID: ${weeklySnapshot.id})`);

    // Flatten and store location data
    const locationRecords: Array<typeof locationSnapshots.$inferInsert> = [];

    regions.forEach(region => {
      // Region-level record
      locationRecords.push({
        snapshotDate,
        listingType,
        regionId: region.LocalityId,
        regionName: region.Name,
        districtId: null,
        districtName: null,
        suburbId: null,
        suburbName: null,
        locationType: 'region',
        listingCount: region.Count || null,
        collectedAt,
      });

      // District-level records
      region.Districts?.forEach(district => {
        locationRecords.push({
          snapshotDate,
          listingType,
          regionId: region.LocalityId,
          regionName: region.Name,
          districtId: district.DistrictId,
          districtName: district.Name,
          suburbId: null,
          suburbName: null,
          locationType: 'district',
          listingCount: district.Count || null,
          collectedAt,
        });

        // Suburb-level records
        district.Suburbs?.forEach(suburb => {
          locationRecords.push({
            snapshotDate,
            listingType,
            regionId: region.LocalityId,
            regionName: region.Name,
            districtId: district.DistrictId,
            districtName: district.Name,
            suburbId: suburb.SuburbId,
            suburbName: suburb.Name,
            locationType: 'suburb',
            listingCount: suburb.Count || null,
            collectedAt,
          });
        });
      });
    });

    // Batch insert location records
    await db.insert(locationSnapshots).values(locationRecords);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Stored ${locationRecords.length.toLocaleString()} location records in ${duration}ms`);

    return {
      success: true,
      totalRecords: locationRecords.length,
      totalNzListings,
    };

  } catch (error) {
    console.error('❌ Data collection failed:', error);
    return {
      success: false,
      totalRecords: 0,
      totalNzListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the latest snapshot for a listing type
 */
export async function getLatestSnapshot(listingType: ListingType) {
  return await db.query.weeklySnapshots.findFirst({
    where: (snapshots, { eq }) => eq(snapshots.listingType, listingType),
    orderBy: (snapshots, { desc }) => desc(snapshots.snapshotDate),
  });
}

/**
 * Get top regions by listing count for the latest snapshot
 */
export async function getTopRegions(listingType: ListingType, limit = 10) {
  const latestSnapshot = await getLatestSnapshot(listingType);
  if (!latestSnapshot) return [];

  return await db.query.locationSnapshots.findMany({
    where: (locations, { and, eq }) => and(
      eq(locations.snapshotDate, latestSnapshot.snapshotDate),
      eq(locations.listingType, listingType),
      eq(locations.locationType, 'region')
    ),
    orderBy: (locations, { desc }) => desc(locations.listingCount),
    limit,
  });
}

/**
 * Get latest snapshot summary
 */
export async function getLatestSnapshots() {
  return await db.query.weeklySnapshots.findMany({
    orderBy: desc(weeklySnapshots.collectedAt),
    limit: 10
  });
}

/**
 * Get locations with filters
 */
export async function getLocationsWithFilters({
  listingType = 'HOUSES_TO_BUY',
  locationType,
  regionId,
  districtId,
  minListings = 0,
  limit = 100,
  sortBy = 'listingCount'
}: {
  listingType?: ListingType;
  locationType?: 'region' | 'district' | 'suburb';
  regionId?: number;
  districtId?: number;
  minListings?: number;
  limit?: number;
  sortBy?: 'listingCount' | 'locationName';
}) {
  // Get latest snapshot date
  const latestSnapshot = await getLatestSnapshot(listingType);
  if (!latestSnapshot) return [];

  const conditions = [
    eq(locationSnapshots.snapshotDate, latestSnapshot.snapshotDate),
    eq(locationSnapshots.listingType, listingType)
  ];

  if (locationType) {
    conditions.push(eq(locationSnapshots.locationType, locationType));
  }
  if (regionId) {
    conditions.push(eq(locationSnapshots.regionId, regionId));
  }
  if (districtId) {
    conditions.push(eq(locationSnapshots.districtId, districtId));
  }

  const orderBy = sortBy === 'listingCount' 
    ? desc(locationSnapshots.listingCount)
    : locationSnapshots.regionName;

  return await db.query.locationSnapshots.findMany({
    where: and(...conditions),
    orderBy,
    limit
  });
}

/**
 * Get totals by location type
 */
export async function getTotalsByLocationType(listingType: ListingType = 'HOUSES_TO_BUY') {
  const latestSnapshot = await getLatestSnapshot(listingType);
  if (!latestSnapshot) return null;

  const results = await db.query.locationSnapshots.findMany({
    where: and(
      eq(locationSnapshots.snapshotDate, latestSnapshot.snapshotDate),
      eq(locationSnapshots.listingType, listingType)
    )
  });

  const totals = {
    total: latestSnapshot.totalNzListings,
    regions: results.filter(r => r.locationType === 'region').length,
    districts: results.filter(r => r.locationType === 'district').length,
    suburbs: results.filter(r => r.locationType === 'suburb').length,
    lastUpdated: latestSnapshot.collectedAt
  };

  return totals;
}