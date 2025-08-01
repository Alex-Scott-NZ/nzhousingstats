// src\app\page.tsx
import { Suspense } from 'react';
import { 
  getTotalsByLocationType, 
  getLocationsWithFilters, 
  getLatestSnapshots,
  getHistoricalSnapshots  // Add this import
} from '../../lib/data-collection';
import PropertyDashboard from './components/PropertyDashboard';

export default async function HomePage() {
  console.log('🏠 Loading houses to buy data and trends...');
  
  // Get data for just HOUSES_TO_BUY plus historical trends
  const [housesToBuyData, snapshots, historicalData] = await Promise.all([
    // Houses to Buy - get all levels
    Promise.all([
      getTotalsByLocationType('HOUSES_TO_BUY'),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region', limit: 100 }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district', limit: 500 }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb', limit: 1000 })
    ]),
    getLatestSnapshots(),
    getHistoricalSnapshots('HOUSES_TO_BUY', 28) // Last 28 days of data
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

  console.log('📊 Houses data loaded:', {
    housesToBuy: allData.HOUSES_TO_BUY.totals?.total || 0,
    housesToRent: 0, // Disabled for now
    totalRegions: allData.HOUSES_TO_BUY.regions?.length || 0,
    totalDistricts: allData.HOUSES_TO_BUY.districts?.length || 0,
    totalSuburbs: allData.HOUSES_TO_BUY.suburbs?.length || 0,
    historicalDataPoints: historicalData.length || 0 // Add this
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🏠 NZ Housing Statistics
          </h1>
          <p className="text-gray-600">
            Real-time property market data across New Zealand - Houses for Sale
          </p>
        </div>
      </header>

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