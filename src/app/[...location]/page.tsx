// src\app\[...location]\page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { 
  getLocationsWithFilters, 
  getTotalsByLocationType, 
  getHistoricalSnapshots,
  getLatestSnapshots 
} from '../../../lib/data-collection';
import { findLocationBySlug, createSlug } from '../../lib/slugs';
import PropertyDashboard from '../components/PropertyDashboard';
import StructuredData from '../components/StructuredData';

interface Props {
  params: Promise<{ location: string[] }> // ✅ Updated to Promise
}

// Add proper type for static params
interface StaticParam {
  location: string[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params; // ✅ Await params
  const [regionSlug, districtSlug, suburbSlug] = location || [];
  
  try {
    // Get all data to find the location
    const [housesToBuyData] = await Promise.all([
      Promise.all([
        getTotalsByLocationType('HOUSES_TO_BUY'),
        getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region' }),
        getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district' }),
        getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb' })
      ])
    ]);

    const allData = {
      HOUSES_TO_BUY: {
        totals: housesToBuyData[0],
        regions: housesToBuyData[1],
        districts: housesToBuyData[2],
        suburbs: housesToBuyData[3]
      }
    };

    const locationData = findLocationBySlug(allData, regionSlug, districtSlug, suburbSlug);
    
    if (!locationData) {
      return { title: 'Location Not Found' };
    }

    const { region, district, suburb } = locationData;
    const urlPath = location.join('/'); // ✅ Use awaited location
    
    // Generate metadata based on location level
    if (suburb) {
      const listingCount = suburb.listingCount || 0;
      return {
        title: `${suburb.suburbName} Property Listings - ${listingCount.toLocaleString()} Houses for Sale`,
        description: `Current property market data for ${suburb.suburbName}, ${district.districtName}, ${region.regionName}. View ${listingCount.toLocaleString()} house listings and market trends.`,
        alternates: {
          canonical: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
        },
        openGraph: {
          title: `${suburb.suburbName} Property Listings - ${listingCount.toLocaleString()} Houses`,
          description: `Current property market data for ${suburb.suburbName}, ${district.districtName}. ${listingCount.toLocaleString()} houses for sale.`,
          url: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
          siteName: 'NZ Housing Stats',
          locale: 'en_NZ',
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${suburb.suburbName} Property Listings`,
          description: `${listingCount.toLocaleString()} houses for sale in ${suburb.suburbName}`,
        }
      };
    } else if (district) {
      const listingCount = district.listingCount || 0;
      return {
        title: `${district.districtName} Property Listings - ${listingCount.toLocaleString()} Houses for Sale`,
        description: `Current property market data for ${district.districtName}, ${region.regionName}. View ${listingCount.toLocaleString()} house listings, market trends, and suburb breakdowns.`,
        alternates: {
          canonical: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
        },
        openGraph: {
          title: `${district.districtName} Property Listings - ${listingCount.toLocaleString()} Houses`,
          description: `Current property market data for ${district.districtName}, ${region.regionName}. ${listingCount.toLocaleString()} houses for sale.`,
          url: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
          siteName: 'NZ Housing Stats',
          locale: 'en_NZ',
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${district.districtName} Property Listings`,
          description: `${listingCount.toLocaleString()} houses for sale in ${district.districtName}`,
        }
      };
    } else {
      const listingCount = region.listingCount || 0;
      return {
        title: `${region.regionName} Property Listings - ${listingCount.toLocaleString()} Houses for Sale`,
        description: `Current property market data for ${region.regionName}, New Zealand. View ${listingCount.toLocaleString()} house listings, market trends, and district breakdowns.`,
        alternates: {
          canonical: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
        },
        openGraph: {
          title: `${region.regionName} Property Listings - ${listingCount.toLocaleString()} Houses`,
          description: `Current property market data for ${region.regionName}, New Zealand. ${listingCount.toLocaleString()} houses for sale.`,
          url: `https://nzhousingstats.madebyalex.dev/${urlPath}`,
          siteName: 'NZ Housing Stats',
          locale: 'en_NZ',
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${region.regionName} Property Listings`,
          description: `${listingCount.toLocaleString()} houses for sale in ${region.regionName}`,
        }
      };
    }
  } catch (error) {
    return { title: 'Location Not Found' };
  }
}

export default async function LocationPage({ params }: Props) {
  const { location } = await params; // ✅ Await params
  const [regionSlug, districtSlug, suburbSlug] = location || [];
  
  try {
    // Get all data
    const [housesToBuyData, snapshots, historicalData] = await Promise.all([
      Promise.all([
        getTotalsByLocationType('HOUSES_TO_BUY'),
        getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region' }),
        getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district' }),
        getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb' })
      ]),
      getLatestSnapshots(),
      getHistoricalSnapshots('HOUSES_TO_BUY')
    ]);

    const allData = {
      HOUSES_TO_BUY: {
        totals: housesToBuyData[0],
        regions: housesToBuyData[1],
        districts: housesToBuyData[2],
        suburbs: housesToBuyData[3]
      },
      HOUSES_TO_RENT: {
        totals: { total: 0, regions: 0, districts: 0, suburbs: 0, lastUpdated: new Date().toISOString() },
        regions: [],
        districts: [],
        suburbs: []
      }
    };

    const locationData = findLocationBySlug(allData, regionSlug, districtSlug, suburbSlug);
    
    if (!locationData) {
      notFound();
    }

    const { region, district, suburb } = locationData;
    const listingCount = suburb?.listingCount || district?.listingCount || region?.listingCount || 0;

    return (
      <div className="min-h-screen bg-gray-50">
        <StructuredData 
          region={region}
          district={district}
          suburb={suburb}
          listingCount={listingCount}
        />
        <main className="max-w-7xl mx-auto py-6 px-4">
          <Suspense fallback={<div>Loading...</div>}>
            <PropertyDashboard 
              allData={allData}
              snapshots={snapshots}
              historicalData={historicalData}
              initialRegionId={region.regionId}
              initialDistrictId={district?.districtId}
              initialSuburbId={suburb?.suburbId}
            />
          </Suspense>
        </main>
      </div>
    );
  } catch (error) {
    console.error('Error loading location page:', error);
    notFound();
  }
}

export async function generateStaticParams(): Promise<StaticParam[]> {
  try {
    const [regions, districts, suburbs] = await Promise.all([
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region' }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district' }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb' })
    ]);
    
    const params: StaticParam[] = [];
    
    // Generate ALL region paths (there aren't that many)
    regions.forEach((region) => {
      params.push({
        location: [createSlug(region.regionName)]
      });
    });
    
    // Generate district paths - prioritize major areas
    const majorDistricts = districts
      .filter(d => (d.listingCount || 0) >= 10) // Only districts with decent listings
      .sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))
      .slice(0, 100); // Top 100 districts
      
    majorDistricts.forEach((district) => {
      const region = regions.find(r => r.regionId === district.regionId);
      if (region) {
        params.push({
          location: [createSlug(region.regionName), createSlug(district.districtName)]
        });
      }
    });
    
    // Generate suburb paths - only major suburbs
    const majorSuburbs = suburbs
      .filter(s => (s.listingCount || 0) >= 5) // Only suburbs with decent listings
      .sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))
      .slice(0, 200); // Top 200 suburbs
      
    majorSuburbs.forEach((suburb) => {
      const district = districts.find(d => d.districtId === suburb.districtId);
      const region = regions.find(r => r.regionId === suburb.regionId);
      
      if (district && region) {
        params.push({
          location: [
            createSlug(region.regionName), 
            createSlug(district.districtName), 
            createSlug(suburb.suburbName)
          ]
        });
      }
    });
    
    console.log(`📊 Generated ${params.length} static params for pre-rendering`);
    return params;
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}