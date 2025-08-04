// src\app\page.tsx
import { Metadata } from "next";
import { Suspense } from "react";
import {
  getTotalsByLocationType,
  getLocationsWithFilters,
  getLatestSnapshots,
  getHistoricalSnapshots,
} from "../../lib/data-collection";
import PropertyDashboard from "./components/PropertyDashboard";
import HomepageStructuredData from "./components/StructuredData";

export const metadata: Metadata = {
  title: "NZ Housing Stats - New Zealand Property Market Data & Trends",
  description:
    "Track New Zealand property market trends with real-time house listing data across all regions, districts, and suburbs. Updated daily with comprehensive market insights.",
  alternates: {
    canonical: "https://nzhousingstats.madebyalex.dev/",
  },
  openGraph: {
    title: "NZ Housing Stats - Property Market Data",
    description:
      "Real-time New Zealand property market data and trends across all regions.",
    url: "https://nzhousingstats.madebyalex.dev/",
    siteName: "NZ Housing Stats",
    locale: "en_NZ",
    type: "website",
    images: [
      // ✅ Add the images back here
      {
        url: "https://nzhousingstats.madebyalex.dev/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Property Listings Tracker Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NZ Housing Stats",
    description: "Real-time New Zealand property market data and trends",
    images: ["https://nzhousingstats.madebyalex.dev/og-image.jpg"], // ✅ Add the image back here
  },
};

export default async function HomePage() {
  console.log("🏠 Loading property market data...");

  try {
    // Get data for HOUSES_TO_BUY plus historical trends
    const [housesToBuyData, snapshots, historicalData] = await Promise.all([
      Promise.all([
        getTotalsByLocationType("HOUSES_TO_BUY"),
        getLocationsWithFilters({
          listingType: "HOUSES_TO_BUY",
          locationType: "region",
        }),
        getLocationsWithFilters({
          listingType: "HOUSES_TO_BUY",
          locationType: "district",
        }),
        getLocationsWithFilters({
          listingType: "HOUSES_TO_BUY",
          locationType: "suburb",
        }),
      ]),
      getLatestSnapshots(),
      getHistoricalSnapshots("HOUSES_TO_BUY"),
    ]);

    // Structure the data for the component
    const allData = {
      HOUSES_TO_BUY: {
        totals: housesToBuyData[0],
        regions: housesToBuyData[1],
        districts: housesToBuyData[2],
        suburbs: housesToBuyData[3],
      },
      // Empty placeholder for rent data (keeps component structure intact)
      HOUSES_TO_RENT: {
        totals: {
          total: 0,
          regions: 0,
          districts: 0,
          suburbs: 0,
          lastUpdated: new Date().toISOString(),
        },
        regions: [],
        districts: [],
        suburbs: [],
      },
    };

    // Quick data summary for monitoring
    console.log("✅ Data loaded successfully:", {
      totalListings: allData.HOUSES_TO_BUY.totals?.total || 0,
      regions: allData.HOUSES_TO_BUY.regions?.length || 0,
      districts: allData.HOUSES_TO_BUY.districts?.length || 0,
      suburbs: allData.HOUSES_TO_BUY.suburbs?.length || 0,
      historicalRecords: historicalData.length || 0,
    });

    return (
      <div className="min-h-screen bg-gray-50">
        <HomepageStructuredData
          totalListings={allData.HOUSES_TO_BUY.totals?.total || 0}
          totalRegions={allData.HOUSES_TO_BUY.regions?.length || 0}
          totalDistricts={allData.HOUSES_TO_BUY.districts?.length || 0}
          totalSuburbs={allData.HOUSES_TO_BUY.suburbs?.length || 0}
          lastUpdated={
            allData.HOUSES_TO_BUY.totals?.lastUpdated ||
            new Date().toISOString()
          }
        />
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
  } catch (error) {
    console.error("❌ Error loading homepage data:", error);

    // Return error fallback
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Unable to Load Property Data
          </h1>
          <p className="text-gray-600">
            We're experiencing technical difficulties. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}
