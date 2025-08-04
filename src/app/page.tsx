// src\app\page.tsx
import { Suspense } from 'react';
import { 
  getTotalsByLocationType, 
  getLocationsWithFilters, 
  getLatestSnapshots,
  getHistoricalSnapshots  
} from '../../lib/data-collection';
import PropertyDashboard from './components/PropertyDashboard';

export default async function HomePage() {
  console.log('🏠 Loading houses to buy data and trends...');
  
  // Get data for just HOUSES_TO_BUY plus historical trends
  const [housesToBuyData, snapshots, historicalData] = await Promise.all([
    // Houses to Buy - get all levels (REMOVE LIMITS)
    Promise.all([
      getTotalsByLocationType('HOUSES_TO_BUY'),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region' }), // No limit
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district' }), // No limit
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb' }) // No limit
    ]),
    getLatestSnapshots(),
    getHistoricalSnapshots('HOUSES_TO_BUY') // No limit - get all historical data
  ]);

  // Structure the data for the component (only HOUSES_TO_BUY)
  const allData = {
    HOUSES_TO_BUY: {
      totals: housesToBuyData[0],
      regions: housesToBuyData[1],
      districts: housesToBuyData[2], 
      suburbs: housesToBuyData[3]
    },
    // Empty placeholder for rent data (keeps component structure intact)
    HOUSES_TO_RENT: {
      totals: { total: 0, regions: 0, districts: 0, suburbs: 0, lastUpdated: new Date().toISOString() },
      regions: [],
      districts: [],
      suburbs: []
    }
  };

  // 🔍 COMPREHENSIVE DEBUGGING LOGS
  console.log('📊 Data Loading Summary:', {
    housesToBuy: allData.HOUSES_TO_BUY.totals?.total || 0,
    totalRegions: allData.HOUSES_TO_BUY.regions?.length || 0,
    totalDistricts: allData.HOUSES_TO_BUY.districts?.length || 0,
    totalSuburbs: allData.HOUSES_TO_BUY.suburbs?.length || 0,
    historicalDataPoints: historicalData.length || 0,
    snapshotCount: snapshots.length || 0
  });

  console.log('📊 Historical Data Breakdown:', {
    totalRecords: historicalData.length,
    firstRecord: historicalData[0],
    lastRecord: historicalData[historicalData.length - 1],
    fieldNames: historicalData[0] ? Object.keys(historicalData[0]) : [],
    
    // Count by type
    nationalRecords: historicalData.filter(h => h.region_id === null && h.district_id === null).length,
    regionalRecords: historicalData.filter(h => h.region_id !== null && h.district_id === null).length,
    districtRecords: historicalData.filter(h => h.district_id !== null).length,
    
    // Sample records
    sampleNational: historicalData.filter(h => h.region_id === null && h.district_id === null),
    sampleRegional: historicalData.filter(h => h.region_id !== null && h.district_id === null).slice(0, 3),
    sampleDistrict: historicalData.filter(h => h.district_id !== null).slice(0, 3),
  });

  console.log('📊 Sample Region Data:', {
    firstFewRegions: allData.HOUSES_TO_BUY.regions?.slice(0, 3).map(r => ({
      id: r.regionId,
      name: r.regionName,
      listings: r.listingCount
    })),
    regionIds: allData.HOUSES_TO_BUY.regions?.slice(0, 10).map(r => r.regionId),
  });

  console.log('📊 Historical vs Current ID Comparison:', {
    currentRegionIds: [...new Set(allData.HOUSES_TO_BUY.regions?.map(r => r.regionId) || [])].sort(),
    historicalRegionIds: [...new Set(historicalData.filter(h => h.region_id !== null).map(h => h.region_id))].sort(),
    
    currentDistrictIds: [...new Set(allData.HOUSES_TO_BUY.districts?.map(d => d.districtId) || [])].slice(0, 10).sort(),
    historicalDistrictIds: [...new Set(historicalData.filter(h => h.district_id !== null).map(h => h.district_id))].slice(0, 10).sort(),
  });

  // Check for specific region trends
  const aucklandRegionId = allData.HOUSES_TO_BUY.regions?.find(r => r.regionName?.toLowerCase().includes('auckland'))?.regionId;
  if (aucklandRegionId) {
    const aucklandHistorical = historicalData.filter(h => h.region_id === aucklandRegionId);
    console.log('📊 Auckland Region Example:', {
      regionId: aucklandRegionId,
      currentListings: allData.HOUSES_TO_BUY.regions?.find(r => r.regionId === aucklandRegionId)?.listingCount,
      historicalRecords: aucklandHistorical.length,
      historicalData: aucklandHistorical,
    });
  }

  // Check for any data mismatches
  const hasRegionalHistoricalData = historicalData.some(h => h.region_id !== null && h.district_id === null);
  const hasDistrictHistoricalData = historicalData.some(h => h.district_id !== null);
  
  console.log('📊 Data Validation:', {
    hasRegionalHistoricalData,
    hasDistrictHistoricalData,
    expectedRegionalRecords: (allData.HOUSES_TO_BUY.regions?.length || 0) * 2, // Should be regions × snapshots
    actualRegionalRecords: historicalData.filter(h => h.region_id !== null && h.district_id === null).length,
    expectedDistrictRecords: (allData.HOUSES_TO_BUY.districts?.length || 0) * 2, // Should be districts × snapshots  
    actualDistrictRecords: historicalData.filter(h => h.district_id !== null).length,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 px-4">
        <Suspense fallback={<div>Loading...</div>}>
          <PropertyDashboard 
            allData={allData}
            snapshots={snapshots}
            historicalData={historicalData}  
          />
        </Suspense>
      </main>
    </div>
  );
}