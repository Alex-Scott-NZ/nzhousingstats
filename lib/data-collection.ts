// lib\data-collection.ts
//scripts/data-collection.ts
import { db } from "../lib/db";
import { sql } from "drizzle-orm";
import type {
  TradeMeLocalitiesResponse,
  ListingType,
  Region,
  District,
  Suburb,
} from "../lib/types/trademe";

/**
 * Collect and store TradeMe property data in normalized schema
 */
export async function collectPropertyData(listingType: ListingType): Promise<{
  success: boolean;
  totalRecords: number;
  totalNzListings: number;
  error?: string;
}> {
  const startTime = Date.now();
  const snapshotDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const collectedAt = new Date().toISOString();

  try {
    console.log(`🔍 Collecting ${listingType} data...`);

    // Fetch data from TradeMe API
    const url = `https://api.trademe.co.nz/v1/localities.json?with_counts=true&listing_type=${listingType}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "NZHousingStats/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status} ${response.statusText}`);
    }

    const allRegions: TradeMeLocalitiesResponse = await response.json();

    // Filter out the "All" locality (LocalityId: 100) - it's empty
    const regions: Region[] = allRegions.filter(
      (region: Region) => region.LocalityId !== 100
    );

    console.log(
      `📊 Processing ${regions.length} valid regions (filtered from ${allRegions.length})`
    );

    // Calculate total NZ listings from suburbs (most accurate)
    let totalNzListings = 0;
    let suburbRecords = 0;

    regions.forEach((region: Region) => {
      region.Districts?.forEach((district: District) => {
        district.Suburbs?.forEach((suburb: Suburb) => {
          if (suburb.Count && suburb.Count > 0) {
            totalNzListings += suburb.Count;
            suburbRecords++;
          }
        });
      });
    });

    console.log(
      `📊 Found ${totalNzListings.toLocaleString()} ${listingType} listings across ${suburbRecords} suburbs`
    );

    // Step 1: Insert snapshot record
    await db.run(sql`
  INSERT INTO snapshots (snapshot_date, collected_at, status, processing_time_ms)
  VALUES (${snapshotDate}, ${collectedAt}, 'in_progress', NULL)
  ON CONFLICT(snapshot_date) DO UPDATE SET
    collected_at = ${collectedAt},
    status = 'in_progress'
`);

    // Get the snapshot ID
    const snapshotResult = (await db.get(sql`
  SELECT id FROM snapshots WHERE snapshot_date = ${snapshotDate}
`)) as any;
    const snapshotId = snapshotResult?.id;

    // Step 2: Get listing type ID
    const listingTypeRecord = (await db.get(sql`
      SELECT id FROM listing_types WHERE code = ${listingType}
    `)) as { id: number } | undefined;

    if (!listingTypeRecord) {
      throw new Error(`Listing type ${listingType} not found in database`);
    }

    const listingTypeId = listingTypeRecord.id;

    // Step 3: Collect suburb listings and ensure location hierarchy exists
    const suburbListings: Array<{
      snapshotId: number;
      listingTypeId: number;
      suburbId: number;
      listingCount: number;
    }> = [];

    let locationsProcessed = 0;

    for (const region of regions) {
      // Ensure region exists
      await db.run(sql`
        INSERT OR IGNORE INTO regions (id, name)
        VALUES (${region.LocalityId}, ${region.Name})
      `);

      for (const district of region.Districts || []) {
        // Ensure district exists
        await db.run(sql`
          INSERT OR IGNORE INTO districts (id, name, region_id)
          VALUES (${district.DistrictId}, ${district.Name}, ${region.LocalityId})
        `);

        for (const suburb of district.Suburbs || []) {
          // Ensure suburb exists
          await db.run(sql`
            INSERT OR IGNORE INTO suburbs (id, name, district_id, region_id)
            VALUES (${suburb.SuburbId}, ${suburb.Name}, ${district.DistrictId}, ${region.LocalityId})
          `);

          // Add suburb listing if it has counts
          if (suburb.Count && suburb.Count > 0) {
            suburbListings.push({
              snapshotId,
              listingTypeId,
              suburbId: suburb.SuburbId, // Use TradeMe ID directly
              listingCount: suburb.Count,
            });
          }

          locationsProcessed++;
        }
      }
    }

    console.log(
      `🏠 Processed ${locationsProcessed} locations, found ${suburbListings.length} suburbs with listings`
    );

    // Step 4: Batch insert suburb listings
    if (suburbListings.length > 0) {
      // Clear existing data for this snapshot/listing type
      await db.run(sql`
        DELETE FROM suburb_listings 
        WHERE snapshot_id = ${snapshotId} AND listing_type_id = ${listingTypeId}
      `);

      // Batch insert new data
      const values = suburbListings
        .map(
          (record) =>
            `(${record.snapshotId}, ${record.listingTypeId}, ${record.suburbId}, ${record.listingCount})`
        )
        .join(", ");

      await db.run(
        sql.raw(`
        INSERT INTO suburb_listings (snapshot_id, listing_type_id, suburb_id, listing_count)
        VALUES ${values}
      `)
      );
    }

    // Step 5: Mark snapshot as completed
    const duration = Date.now() - startTime;
    await db.run(sql`
      UPDATE snapshots 
      SET status = 'completed', processing_time_ms = ${duration}
      WHERE id = ${snapshotId}
    `);

    console.log(
      `✅ Stored ${suburbListings.length.toLocaleString()} suburb listings in ${duration}ms`
    );

    return {
      success: true,
      totalRecords: suburbListings.length,
      totalNzListings,
    };
  } catch (error) {
    console.error("❌ Data collection failed:", error);
    return {
      success: false,
      totalRecords: 0,
      totalNzListings: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get latest snapshots summary
 */
export async function getLatestSnapshots() {
  const results = (await db.all(sql`
    SELECT 
      s.id,
      s.snapshot_date,
      s.collected_at,
      s.status,
      lt.code as listing_type,
      lt.name as listing_name,
      SUM(sl.listing_count) as total_listings,
      COUNT(sl.id) as suburb_count
    FROM snapshots s
    JOIN suburb_listings sl ON s.id = sl.snapshot_id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    GROUP BY s.id, lt.id
    ORDER BY s.snapshot_date DESC, s.collected_at DESC
    LIMIT 10
  `)) as any[];

  // Map to expected property names
  return results.map((snapshot) => ({
    id: snapshot.id,
    snapshotDate: snapshot.snapshot_date,
    listingType: snapshot.listing_type, // Fix: camelCase
    totalNzListings: snapshot.total_listings, // Fix: camelCase
    collectedAt: snapshot.collected_at,
    rawData: JSON.stringify({}), // Placeholder
    status: snapshot.status,
  }));
}

/**
 * Get region totals (calculated from suburbs)
 */
export async function getRegionTotals(listingType: ListingType, limit = 10) {
  const results = (await db.all(sql`
    SELECT 
      r.name as region_name,
      r.id as region_id,        -- Changed from r.trademe_id
      SUM(sl.listing_count) as total_listings,
      COUNT(sl.id) as suburb_count
    FROM suburb_listings sl
    JOIN suburbs s ON sl.suburb_id = s.id
    JOIN regions r ON s.region_id = r.id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    JOIN snapshots snap ON sl.snapshot_id = snap.id
    WHERE lt.code = ${listingType}
      AND snap.id = (
        SELECT MAX(s2.id) FROM snapshots s2
        JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
        JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
        WHERE lt2.code = ${listingType}
      )
    GROUP BY r.id, r.name        -- Changed from r.trademe_id
    ORDER BY total_listings DESC
    LIMIT ${limit}
  `)) as any[];

  return results;
}

/**
 * Get district totals for a region (calculated from suburbs)
 */
export async function getDistrictTotals(
  listingType: ListingType,
  regionId: number,
  limit = 100
) {
  const results = (await db.all(sql`
    SELECT 
      d.name as district_name,
      d.id as district_id,      -- Changed from d.trademe_id
      r.name as region_name,
      SUM(sl.listing_count) as total_listings,
      COUNT(sl.id) as suburb_count
    FROM suburb_listings sl
    JOIN suburbs s ON sl.suburb_id = s.id
    JOIN districts d ON s.district_id = d.id
    JOIN regions r ON s.region_id = r.id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    JOIN snapshots snap ON sl.snapshot_id = snap.id
    WHERE lt.code = ${listingType}
      AND r.id = ${regionId}    -- Changed from r.trademe_id
      AND snap.id = (
        SELECT MAX(s2.id) FROM snapshots s2
        JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
        JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
        WHERE lt2.code = ${listingType}
      )
    GROUP BY d.id, d.name, r.name  -- Changed from d.trademe_id
    ORDER BY total_listings DESC
    LIMIT ${limit}
  `)) as any[];

  return results;
}

/**
 * Get suburb totals for a district
 */
export async function getSuburbTotals(
  listingType: ListingType,
  districtId: number,
  limit = 100
) {
  const results = (await db.all(sql`
    SELECT 
      s.name as suburb_name,
      s.id as suburb_id,        -- Changed from s.trademe_id
      d.name as district_name,
      r.name as region_name,
      sl.listing_count
    FROM suburb_listings sl
    JOIN suburbs s ON sl.suburb_id = s.id
    JOIN districts d ON s.district_id = d.id
    JOIN regions r ON s.region_id = r.id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    JOIN snapshots snap ON sl.snapshot_id = snap.id
    WHERE lt.code = ${listingType}
      AND d.id = ${districtId}  -- Changed from d.trademe_id
      AND snap.id = (
        SELECT MAX(s2.id) FROM snapshots s2
        JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
        JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
        WHERE lt2.code = ${listingType}
      )
    ORDER BY sl.listing_count DESC
    LIMIT ${limit}
  `)) as any[];

  return results;
}

/**
 * Get total listings for a listing type
 */
export async function getTotalsByLocationType(listingType: ListingType) {
  const result = (await db.get(sql`
    SELECT 
      SUM(sl.listing_count) as total,
      COUNT(sl.id) as suburb_count
    FROM suburb_listings sl
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    JOIN snapshots snap ON sl.snapshot_id = snap.id
    WHERE lt.code = ${listingType}
      AND snap.id = (
        SELECT MAX(s2.id) FROM snapshots s2
        JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
        JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
        WHERE lt2.code = ${listingType}
      )
  `)) as { total: number; suburb_count: number } | undefined;

  // Get counts for regions and districts
  const regionCount = await db.get(sql`
    SELECT COUNT(DISTINCT r.id) as count
    FROM suburb_listings sl
    JOIN suburbs s ON sl.suburb_id = s.id
    JOIN regions r ON s.region_id = r.id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    JOIN snapshots snap ON sl.snapshot_id = snap.id
    WHERE lt.code = ${listingType}
      AND snap.id = (
        SELECT MAX(s2.id) FROM snapshots s2
        JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
        JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
        WHERE lt2.code = ${listingType}
      )
  `);

  const districtCount = await db.get(sql`
    SELECT COUNT(DISTINCT d.id) as count
    FROM suburb_listings sl
    JOIN suburbs s ON sl.suburb_id = s.id
    JOIN districts d ON s.district_id = d.id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    JOIN snapshots snap ON sl.snapshot_id = snap.id
    WHERE lt.code = ${listingType}
      AND snap.id = (
        SELECT MAX(s2.id) FROM snapshots s2
        JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
        JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
        WHERE lt2.code = ${listingType}
      )
  `);

  // Get latest snapshot date
  const latestSnapshot = await db.get(sql`
    SELECT s.collected_at
    FROM snapshots s
    JOIN suburb_listings sl ON s.id = sl.snapshot_id
    JOIN listing_types lt ON sl.listing_type_id = lt.id
    WHERE lt.code = ${listingType}
    ORDER BY s.snapshot_date DESC, s.collected_at DESC
    LIMIT 1
  `);

  return {
    total: result?.total || 0,
    regions: (regionCount as any)?.count || 0,
    districts: (districtCount as any)?.count || 0,
    suburbs: result?.suburb_count || 0,
    lastUpdated:
      (latestSnapshot as any)?.collected_at || new Date().toISOString(),
  };
}

/**
 * Get locations with filters - compatibility function for old schema
 */
export async function getLocationsWithFilters(filters: {
  listingType: ListingType;
  locationType: "region" | "district" | "suburb";
  limit?: number;
}) {
  const { listingType, locationType, limit = 1000 } = filters;

  if (locationType === "region") {
    const results = await getRegionTotals(listingType, limit);
    // Map to expected property names
    return results.map((r) => ({
      id: r.region_id,
      regionId: r.region_id,
      regionName: r.region_name,
      districtId: null,
      districtName: null,
      suburbId: null,
      suburbName: null,
      locationType: "region",
      listingCount: r.total_listings,
      snapshotDate: new Date().toISOString().split("T")[0],
      listingType: listingType,
      collectedAt: new Date().toISOString(),
    }));
  }

  if (locationType === "district") {
    const results = (await db.all(sql`
      SELECT 
        d.name as district_name,
        d.id as district_id,
        r.name as region_name,
        r.id as region_id,
        SUM(sl.listing_count) as total_listings,
        COUNT(sl.id) as suburb_count
      FROM suburb_listings sl
      JOIN suburbs s ON sl.suburb_id = s.id
      JOIN districts d ON s.district_id = d.id
      JOIN regions r ON s.region_id = r.id
      JOIN listing_types lt ON sl.listing_type_id = lt.id
      JOIN snapshots snap ON sl.snapshot_id = snap.id
      WHERE lt.code = ${listingType}
        AND snap.id = (
          SELECT MAX(s2.id) FROM snapshots s2
          JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
          JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
          WHERE lt2.code = ${listingType}
        )
      GROUP BY d.id, d.name, r.id, r.name
      ORDER BY total_listings DESC
      LIMIT ${limit}
    `)) as any[];

    // Map to expected property names
    return results.map((d) => ({
      id: d.district_id,
      regionId: d.region_id,
      regionName: d.region_name,
      districtId: d.district_id,
      districtName: d.district_name,
      suburbId: null,
      suburbName: null,
      locationType: "district",
      listingCount: d.total_listings,
      snapshotDate: new Date().toISOString().split("T")[0],
      listingType: listingType,
      collectedAt: new Date().toISOString(),
    }));
  }

  if (locationType === "suburb") {
    const results = (await db.all(sql`
      SELECT 
        s.name as suburb_name,
        s.id as suburb_id,
        d.name as district_name,
        d.id as district_id,
        r.name as region_name,
        r.id as region_id,
        sl.listing_count as listing_count
      FROM suburb_listings sl
      JOIN suburbs s ON sl.suburb_id = s.id
      JOIN districts d ON s.district_id = d.id
      JOIN regions r ON s.region_id = r.id
      JOIN listing_types lt ON sl.listing_type_id = lt.id
      JOIN snapshots snap ON sl.snapshot_id = snap.id
      WHERE lt.code = ${listingType}
        AND snap.id = (
          SELECT MAX(s2.id) FROM snapshots s2
          JOIN suburb_listings sl2 ON s2.id = sl2.snapshot_id
          JOIN listing_types lt2 ON sl2.listing_type_id = lt2.id
          WHERE lt2.code = ${listingType}
        )
      ORDER BY sl.listing_count DESC
      LIMIT ${limit}
    `)) as any[];

    // Map to expected property names
    return results.map((s) => ({
      id: s.suburb_id,
      regionId: s.region_id,
      regionName: s.region_name,
      districtId: s.district_id,
      districtName: s.district_name,
      suburbId: s.suburb_id,
      suburbName: s.suburb_name,
      locationType: "suburb",
      listingCount: s.listing_count,
      snapshotDate: new Date().toISOString().split("T")[0],
      listingType: listingType,
      collectedAt: new Date().toISOString(),
    }));
  }

  return [];
}

/**
 * Get historical snapshots for trend analysis - FIXED VERSION
 */
export async function getHistoricalSnapshots(listingType: ListingType, limit?: number) {
  const results = await db.all(sql`
    WITH historical_data AS (
      -- National totals (for main chart when no region selected)
      SELECT 
        s.id,
        s.snapshot_date,
        s.collected_at,
        lt.code as listing_type,
        NULL as region_id,
        NULL as district_id,
        NULL as suburb_id,
        SUM(sl.listing_count) as total_listings
      FROM snapshots s
      JOIN suburb_listings sl ON s.id = sl.snapshot_id
      JOIN listing_types lt ON sl.listing_type_id = lt.id
      WHERE lt.code = ${listingType}
      GROUP BY s.id, s.snapshot_date, s.collected_at, lt.code
      
      UNION ALL
      
      -- Regional totals (for when region is selected)
      SELECT 
        s.id,
        s.snapshot_date,
        s.collected_at,
        lt.code as listing_type,
        r.id as region_id,
        NULL as district_id,
        NULL as suburb_id,
        SUM(sl.listing_count) as total_listings
      FROM snapshots s
      JOIN suburb_listings sl ON s.id = sl.snapshot_id
      JOIN listing_types lt ON sl.listing_type_id = lt.id
      JOIN suburbs sub ON sl.suburb_id = sub.id
      JOIN regions r ON sub.region_id = r.id
      WHERE lt.code = ${listingType}
      GROUP BY s.id, s.snapshot_date, s.collected_at, lt.code, r.id
      
      UNION ALL
      
      -- District totals (for when district is selected)
      SELECT 
        s.id,
        s.snapshot_date,
        s.collected_at,
        lt.code as listing_type,
        r.id as region_id,
        d.id as district_id,
        NULL as suburb_id,
        SUM(sl.listing_count) as total_listings
      FROM snapshots s
      JOIN suburb_listings sl ON s.id = sl.snapshot_id
      JOIN listing_types lt ON sl.listing_type_id = lt.id
      JOIN suburbs sub ON sl.suburb_id = sub.id
      JOIN districts d ON sub.district_id = d.id
      JOIN regions r ON sub.region_id = r.id
      WHERE lt.code = ${listingType}
      GROUP BY s.id, s.snapshot_date, s.collected_at, lt.code, r.id, d.id
      
      UNION ALL
      
      -- 🆕 Individual suburb data (for when suburb is selected)
      SELECT 
        s.id,
        s.snapshot_date,
        s.collected_at,
        lt.code as listing_type,
        r.id as region_id,
        d.id as district_id,
        sub.id as suburb_id,
        sl.listing_count as total_listings
      FROM snapshots s
      JOIN suburb_listings sl ON s.id = sl.snapshot_id
      JOIN listing_types lt ON sl.listing_type_id = lt.id
      JOIN suburbs sub ON sl.suburb_id = sub.id
      JOIN districts d ON sub.district_id = d.id
      JOIN regions r ON sub.region_id = r.id
      WHERE lt.code = ${listingType}
    )
    SELECT * FROM historical_data
    ORDER BY snapshot_date ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as any[];

  return results;
}
