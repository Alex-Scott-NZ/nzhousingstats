// src\app\page.tsx
import { Suspense } from 'react';
import { getTotalsByLocationType, getLocationsWithFilters, getLatestSnapshots } from '../../lib/data-collection';
import PropertyDashboard from './components/PropertyDashboard';

export default async function HomePage() {
  console.log('🏠 Loading houses data (buy & rent only)...');
  
  // Get data for just HOUSES_TO_BUY and HOUSES_TO_RENT (removed commercial)
  const [housesToBuyData, housesToRentData, snapshots] = await Promise.all([
    // Houses to Buy - get all levels
    Promise.all([
      getTotalsByLocationType('HOUSES_TO_BUY'),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region', limit: 100 }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district', limit: 500 }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb', limit: 1000 })
    ]),
    // Houses to Rent - get all levels  
    Promise.all([
      getTotalsByLocationType('HOUSES_TO_RENT'),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_RENT', locationType: 'region', limit: 100 }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_RENT', locationType: 'district', limit: 500 }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_RENT', locationType: 'suburb', limit: 1000 })
    ]),
    getLatestSnapshots()
  ]);

  // Structure the data for the component (no commercial)
  const allData = {
    HOUSES_TO_BUY: {
      totals: housesToBuyData[0],
      regions: housesToBuyData[1],
      districts: housesToBuyData[2], 
      suburbs: housesToBuyData[3]
    },
    HOUSES_TO_RENT: {
      totals: housesToRentData[0],
      regions: housesToRentData[1],
      districts: housesToRentData[2],
      suburbs: housesToRentData[3]
    }
  };

  console.log('📊 Houses data loaded:', {
    housesToBuy: allData.HOUSES_TO_BUY.totals?.total || 0,
    housesToRent: allData.HOUSES_TO_RENT.totals?.total || 0,
    totalRegions: allData.HOUSES_TO_BUY.regions?.length || 0,
    totalDistricts: allData.HOUSES_TO_BUY.districts?.length || 0,
    totalSuburbs: allData.HOUSES_TO_BUY.suburbs?.length || 0
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🏠 NZ Housing Statistics
          </h1>
          <p className="text-gray-600">
            Real-time property market data across New Zealand
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4">
        <Suspense fallback={<div>Loading...</div>}>
          <PropertyDashboard 
            allData={allData}
            snapshots={snapshots}
          />
        </Suspense>
      </main>
    </div>
  );
}