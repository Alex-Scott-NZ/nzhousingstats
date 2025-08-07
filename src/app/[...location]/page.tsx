// src\app\[...location]\page.tsx
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getLocationsWithFilters,
  getTotalsByLocationType,
  getHistoricalSnapshots,
  getLatestSnapshots,
} from "../../../lib/data-collection";
import { findLocationBySlug, createSlug } from "../../lib/slugs";
import PropertyDashboard from "../components/PropertyDashboard";
import StructuredData from "../components/StructuredData";

interface Props {
  params: Promise<{ location: string[] }>;
}

interface StaticParam {
  location: string[];
}

// 🚀 OPTIMIZATION: Cache data to avoid duplicate fetching
let dataCache: {
  data: any;
  timestamp: number;
  key: string;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedData(cacheKey: string) {
  const now = Date.now();
  
  // Return cached data if it's fresh and matches the key
  if (dataCache && 
      dataCache.key === cacheKey && 
      (now - dataCache.timestamp) < CACHE_DURATION) {
    console.log(`📊 Using cached data for ${cacheKey}`);
    return dataCache.data;
  }

  console.log(`📊 Fetching fresh data for ${cacheKey}`);
  const fetchStart = Date.now();
  
  // Fetch fresh data
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

  const data = {
    housesToBuyData,
    snapshots,
    historicalData,
    allData: {
      HOUSES_TO_BUY: {
        totals: housesToBuyData[0],
        regions: housesToBuyData[1],
        districts: housesToBuyData[2],
        suburbs: housesToBuyData[3],
      },
    }
  };

  // Cache the data
  dataCache = {
    data,
    timestamp: now,
    key: cacheKey
  };

  console.log(`📊 Data fetch completed in ${Date.now() - fetchStart}ms`);
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const metadataStart = Date.now();
  const { location } = await params;
  const [regionSlug, districtSlug, suburbSlug] = location || [];
  
  // ✅ EARLY RETURN: Filter out Next.js static assets
  if (location && location.length > 0) {
    const firstSegment = location[0];
    if (firstSegment === '_next' || 
        firstSegment.includes('.css') || 
        firstSegment.includes('.js') || 
        firstSegment.includes('.map') ||
        firstSegment.includes('.ico') ||
        firstSegment.includes('.png') ||
        firstSegment.includes('.jpg') ||
        firstSegment.includes('.svg')) {
      return { title: 'Not Found' };
    }
  }
  
  // Create cache key (same for metadata and page)
  const cacheKey = location?.join('/') || 'root';
  console.log(`🔍 Generating metadata for: ${cacheKey}`);

  try {
    const { allData } = await getCachedData(cacheKey);

    const slugStart = Date.now();
    const locationData = findLocationBySlug(
      allData,
      regionSlug,
      districtSlug,
      suburbSlug
    );
    console.log(`📊 Metadata slug lookup: ${Date.now() - slugStart}ms`);

    if (!locationData) {
      console.log(`❌ Location not found: ${cacheKey}`);
      return { title: "Location Not Found" };
    }

    const { region, district, suburb } = locationData;
    const urlPath = location.join("/");

    console.log(`📊 Total metadata generation: ${Date.now() - metadataStart}ms`);

    // Generate metadata based on location level
    if (suburb) {
      const listingCount = suburb.listingCount || 0;
      return {
        title: `${
          suburb.suburbName
        } Property Listings - ${listingCount.toLocaleString()} Houses for Sale`,
        description: `Current property market data for ${suburb.suburbName}, ${
          district.districtName
        }, ${
          region.regionName
        }. View ${listingCount.toLocaleString()} house listings and market trends.`,
        alternates: {
          canonical: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
        },
        openGraph: {
          title: `${
            suburb.suburbName
          } Property Listings - ${listingCount.toLocaleString()} Houses`,
          description: `Current property market data for ${
            suburb.suburbName
          }, ${
            district.districtName
          }. ${listingCount.toLocaleString()} houses for sale.`,
          url: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
          siteName: "NZ Housing Stats",
          locale: "en_NZ",
          type: "website",
          images: [
            {
              url: "https://nzhousingstats.madebyalex.dev/og-image.jpg",
              width: 1200,
              height: 630,
              alt: `${suburb.suburbName} Property Listings Dashboard`,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: `${suburb.suburbName} Property Listings`,
          description: `${listingCount.toLocaleString()} houses for sale in ${
            suburb.suburbName
          }`,
          images: ["https://nzhousingstats.madebyalex.dev/og-image.jpg"],
        },
      };
    } else if (district) {
      const listingCount = district.listingCount || 0;
      return {
        title: `${
          district.districtName
        } Property Listings - ${listingCount.toLocaleString()} Houses for Sale`,
        description: `Current property market data for ${
          district.districtName
        }, ${
          region.regionName
        }. View ${listingCount.toLocaleString()} house listings, market trends, and suburb breakdowns.`,
        alternates: {
          canonical: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
        },
        openGraph: {
          title: `${
            district.districtName
          } Property Listings - ${listingCount.toLocaleString()} Houses`,
          description: `Current property market data for ${
            district.districtName
          }, ${
            region.regionName
          }. ${listingCount.toLocaleString()} houses for sale.`,
          url: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
          siteName: "NZ Housing Stats",
          locale: "en_NZ",
          type: "website",
          images: [
            {
              url: "https://nzhousingstats.madebyalex.dev/og-image.jpg",
              width: 1200,
              height: 630,
              alt: `${district.districtName} Property Listings Dashboard`,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: `${district.districtName} Property Listings`,
          description: `${listingCount.toLocaleString()} houses for sale in ${
            district.districtName
          }`,
          images: ["https://nzhousingstats.madebyalex.dev/og-image.jpg"],
        },
      };
    } else {
      const listingCount = region.listingCount || 0;
      return {
        title: `${
          region.regionName
        } Property Listings - ${listingCount.toLocaleString()} Houses for Sale`,
        description: `Current property market data for ${
          region.regionName
        }, New Zealand. View ${listingCount.toLocaleString()} house listings, market trends, and district breakdowns.`,
        alternates: {
          canonical: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
        },
        openGraph: {
          title: `${
            region.regionName
          } Property Listings - ${listingCount.toLocaleString()} Houses`,
          description: `Current property market data for ${
            region.regionName
          }, New Zealand. ${listingCount.toLocaleString()} houses for sale.`,
          url: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
          siteName: "NZ Housing Stats",
          locale: "en_NZ",
          type: "website",
          images: [
            {
              url: "https://nzhousingstats.madebyalex.dev/og-image.jpg",
              width: 1200,
              height: 630,
              alt: `${region.regionName} Property Listings Dashboard`,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: `${region.regionName} Property Listings`,
          description: `${listingCount.toLocaleString()} houses for sale in ${
            region.regionName
          }`,
          images: ["https://nzhousingstats.madebyalex.dev/og-image.jpg"],
        },
      };
    }
  } catch (error) {
    console.error(`❌ Metadata generation failed for ${cacheKey}:`, error);
    return { title: "Location Not Found" };
  }
}

export default async function LocationPage({ params }: Props) {
  const pageStart = Date.now();
  const { location } = await params;
  const [regionSlug, districtSlug, suburbSlug] = location || [];
  
  // ✅ EARLY RETURN: Filter out Next.js static assets
  if (location && location.length > 0) {
    const firstSegment = location[0];
    
    // Block Next.js static assets
    if (firstSegment === '_next' || 
        firstSegment.includes('.css') || 
        firstSegment.includes('.js') || 
        firstSegment.includes('.map') ||
        firstSegment.includes('.ico') ||
        firstSegment.includes('.png') ||
        firstSegment.includes('.jpg') ||
        firstSegment.includes('.svg')) {
      notFound(); // Return 404 immediately without database queries
    }
  }
  
  const cacheKey = location?.join('/') || 'root';
  console.log(`🏠 Loading location page: ${cacheKey}`);

  try {
    // 🚀 Use cached data (no duplicate fetching!)
    const { allData, snapshots, historicalData } = await getCachedData(cacheKey);

    // Add HOUSES_TO_RENT placeholder
    const fullData = {
      ...allData,
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

    const slugStart = Date.now();
    const locationData = findLocationBySlug(
      allData,
      regionSlug,
      districtSlug,
      suburbSlug
    );
    console.log(`📊 Page slug lookup: ${Date.now() - slugStart}ms`);

    if (!locationData) {
      console.log(`❌ Location not found: ${cacheKey}`);
      notFound();
    }

    const { region, district, suburb } = locationData;
    const listingCount =
      suburb?.listingCount ||
      district?.listingCount ||
      region?.listingCount ||
      0;

    console.log(`📊 Total location page generation: ${Date.now() - pageStart}ms`);

    return (
      <div className="min-h-screen bg-gray-50">
        <StructuredData
          region={region}
          district={district}
          suburb={suburb}
          listingCount={listingCount}
        />
        
          <Suspense fallback={<div>Loading...</div>}>
            <PropertyDashboard
              allData={fullData}
              snapshots={snapshots}
              historicalData={historicalData}
              initialRegionId={region.regionId}
              initialDistrictId={district?.districtId}
              initialSuburbId={suburb?.suburbId}
            />
          </Suspense>
        
      </div>
    );
  } catch (error) {
    console.error(`❌ Location page error for ${cacheKey}:`, error);
    notFound();
  }
}

export const revalidate = 300; 

// export async function generateStaticParams(): Promise<StaticParam[]> {
//   const staticStart = Date.now();
//   console.log('📊 Generating static params...');
  
//   try {
//     const [regions, districts, suburbs] = await Promise.all([
//       getLocationsWithFilters({
//         listingType: "HOUSES_TO_BUY",
//         locationType: "region",
//       }),
//       getLocationsWithFilters({
//         listingType: "HOUSES_TO_BUY",
//         locationType: "district",
//       }),
//       getLocationsWithFilters({
//         listingType: "HOUSES_TO_BUY",
//         locationType: "suburb",
//       }),
//     ]);

//     const params: StaticParam[] = [];

//     // Generate ALL region paths (there aren't that many)
//     regions.forEach((region) => {
//       params.push({
//         location: [createSlug(region.regionName)],
//       });
//     });

//     // Generate district paths - prioritize major areas
//     const majorDistricts = districts
//       .filter((d) => (d.listingCount || 0) >= 10)
//       .sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))
//       .slice(0, 100);

//     majorDistricts.forEach((district) => {
//       const region = regions.find((r) => r.regionId === district.regionId);
//       if (region) {
//         params.push({
//           location: [
//             createSlug(region.regionName),
//             createSlug(district.districtName),
//           ],
//         });
//       }
//     });

//     // Generate suburb paths - only major suburbs
//     const majorSuburbs = suburbs
//       .filter((s) => (s.listingCount || 0) >= 5)
//       .sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))
//       .slice(0, 200);

//     majorSuburbs.forEach((suburb) => {
//       const district = districts.find(
//         (d) => d.districtId === suburb.districtId
//       );
//       const region = regions.find((r) => r.regionId === suburb.regionId);

//       if (district && region) {
//         params.push({
//           location: [
//             createSlug(region.regionName),
//             createSlug(district.districtName),
//             createSlug(suburb.suburbName),
//           ],
//         });
//       }
//     });

//     console.log(
//       `📊 Generated ${params.length} static params in ${Date.now() - staticStart}ms`
//     );
//     return params;
//   } catch (error) {
//     console.error("❌ Error generating static params:", error);
//     return [];
//   }
// }