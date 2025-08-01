// lib\types\trademe.ts

/**
 * TradeMe API Response Types - Simplified for Weekly Data Collection
 */

/**
 * Suburb with property listing count
 */
export interface Suburb {
  SuburbId: number;
  Name: string;
  Count?: number; // Optional - some suburbs may have no listings
}

/**
 * District containing suburbs
 */
export interface District {
  DistrictId: number;
  Name: string;
  Suburbs: Suburb[];
  Count?: number; // Optional - some districts may have no listings
}

/**
 * Region containing districts
 */
export interface Region {
  LocalityId: number;
  Name: string;
  Districts: District[];
  // Count?: number; // This is unrelaible and doesn't match the totals from district and suburb
}

/**
 * Complete API response - array of all NZ regions
 */
export type TradeMeLocalitiesResponse = Region[];

/**
 * Supported listing types
 */
export type ListingType = 
  | 'HOUSES_TO_BUY'
  | 'HOUSES_TO_RENT'
  | 'COMMERCIAL_FOR_SALE'
  | 'COMMERCIAL_FOR_LEASE'
  | 'FLATMATES_WANTED'
  | 'RURAL'
  | 'RETIREMENT_VILLAGES'
  | 'LIFESTYLE';

/**
 * Weekly snapshot for database storage
 * One record per listing type per week
 */
export interface WeeklySnapshot {
  id?: number;
  snapshotDate: string; // ISO date (YYYY-MM-DD)
  listingType: ListingType;
  totalNzListings: number; // Calculated sum of all region counts
  collectedAt: string; // ISO timestamp
  rawData: string; // JSON.stringify of the full API response
}

/**
 * Flattened location data for easy querying
 * One record per location per week
 */
export interface LocationSnapshot {
  id?: number;
  snapshotDate: string; // Links to WeeklySnapshot
  listingType: ListingType;
  
  // Location info
  regionId: number;
  regionName: string;
  districtId?: number;
  districtName?: string;
  suburbId?: number;
  suburbName?: string;
  
  locationType: 'region' | 'district' | 'suburb';
  listingCount: number | null;
  collectedAt: string;
}

/**
 * Data collection result
 */
export interface CollectionResult {
  success: boolean;
  snapshotDate: string;
  listingType: ListingType;
  totalNzListings: number;
  totalRecords: number;
  durationMs: number;
  error?: string;
}