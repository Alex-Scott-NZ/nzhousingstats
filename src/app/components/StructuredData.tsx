// src\app\components\StructuredData.tsx
import { createSlug } from '../../lib/slugs';

interface LocationStructuredDataProps {
  region: any;
  district?: any;
  suburb?: any;
  listingCount: number;
}

interface HomepageStructuredDataProps {
  totalListings: number;
  totalRegions: number;
  totalDistricts: number;
  totalSuburbs: number;
  lastUpdated: string;
}

type StructuredDataProps = LocationStructuredDataProps | HomepageStructuredDataProps;

// Type guard functions
function isHomepageProps(props: StructuredDataProps): props is HomepageStructuredDataProps {
  return 'totalListings' in props;
}

function isLocationProps(props: StructuredDataProps): props is LocationStructuredDataProps {
  return 'region' in props;
}

export default function StructuredData(props: StructuredDataProps) {
  // Check if this is homepage data
  if (isHomepageProps(props)) {
    const { totalListings, totalRegions, totalDistricts, totalSuburbs, lastUpdated } = props;
    
    const homepageStructuredData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "NZ Housing Stats",
      "description": "New Zealand property market data and trends tracker",
      "url": "https://nzhousingstats.madebyalex.dev/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://nzhousingstats.madebyalex.dev/{search_term_string}"
        },
        "query-input": "required name=search_term_string"
      },
      "mainEntity": {
        "@type": "Dataset",
        "name": "New Zealand Property Listings Data",
        "description": `Comprehensive property market data for New Zealand covering ${totalListings.toLocaleString()} current listings across ${totalRegions} regions, ${totalDistricts} districts, and ${totalSuburbs} suburbs.`,
        "url": "https://nzhousingstats.madebyalex.dev/",
        "temporalCoverage": new Date().toISOString().split('T')[0],
        "spatialCoverage": {
          "@type": "Place",
          "name": "New Zealand",
          "addressCountry": "NZ"
        },
        "variableMeasured": [
          {
            "@type": "PropertyValue",
            "name": "Property Listings Count",
            "value": totalListings,
            "unitText": "listings"
          },
          {
            "@type": "PropertyValue", 
            "name": "Geographic Coverage",
            "value": `${totalRegions} regions, ${totalDistricts} districts, ${totalSuburbs} suburbs`
          }
        ],
        "dateModified": lastUpdated,
        "publisher": {
          "@type": "Organization",
          "name": "NZ Housing Stats",
          "url": "https://nzhousingstats.madebyalex.dev/"
        }
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "New Zealand Property Data",
            "item": "https://nzhousingstats.madebyalex.dev/"
          }
        ]
      }
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageStructuredData) }}
      />
    );
  }

  // Location page structured data (existing logic)
  if (isLocationProps(props)) {
    const { region, district, suburb, listingCount } = props;
    const locationName = suburb?.suburbName || district?.districtName || region?.regionName;
    
    // Use your existing createSlug function for consistency
    const urlPath = [
      region.regionName,
      district?.districtName,
      suburb?.suburbName
    ]
      .filter(Boolean)
      .map(name => createSlug(name))
      .join('/');
    
    const locationStructuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": `${locationName} Property Listings`,
      "description": `Current property market data for ${locationName}, New Zealand. ${listingCount.toLocaleString()} houses for sale.`,
      "url": `https://nzhousingstats.madebyalex.dev/${urlPath}`,
      "about": {
        "@type": "Place",
        "name": locationName,
        "addressCountry": "NZ",
        "addressRegion": region.regionName,
        ...(district && { "addressLocality": district.districtName }),
      },
      "mainEntity": {
        "@type": "Dataset",
        "name": `${locationName} Property Listings Data`,
        "description": `Real estate market data for ${locationName} showing ${listingCount.toLocaleString()} current property listings`,
        "temporalCoverage": new Date().toISOString().split('T')[0],
        "spatialCoverage": {
          "@type": "Place",
          "name": locationName,
          "addressCountry": "NZ",
          "addressRegion": region.regionName
        },
        "variableMeasured": {
          "@type": "PropertyValue",
          "name": "Property Listings Count",
          "value": listingCount,
          "unitText": "listings"
        }
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "New Zealand",
            "item": "https://nzhousingstats.madebyalex.dev/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": region.regionName,
            "item": `https://nzhousingstats.madebyalex.dev/${createSlug(region.regionName)}`
          },
          ...(district ? [{
            "@type": "ListItem",
            "position": 3,
            "name": district.districtName,
            "item": `https://nzhousingstats.madebyalex.dev/${createSlug(region.regionName)}/${createSlug(district.districtName)}`
          }] : []),
          ...(suburb ? [{
            "@type": "ListItem",
            "position": district ? 4 : 3,
            "name": suburb.suburbName,
            "item": `https://nzhousingstats.madebyalex.dev/${urlPath}`
          }] : [])
        ]
      }
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(locationStructuredData) }}
      />
    );
  }

  // Fallback - should never reach here with proper typing
  return null;
}