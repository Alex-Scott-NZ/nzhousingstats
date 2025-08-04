// src\app\sitemap.ts
import { MetadataRoute } from 'next'
import { 
  getLocationsWithFilters,
} from '../../lib/data-collection'
import { createSlug } from '../lib/slugs'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://nzhousingstats.madebyalex.dev'
  
  try {
    // Get all location data
    const [regions, districts, suburbs] = await Promise.all([
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'region' }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'district' }),
      getLocationsWithFilters({ listingType: 'HOUSES_TO_BUY', locationType: 'suburb' })
    ])

    const sitemap: MetadataRoute.Sitemap = []

    // Add homepage
    sitemap.push({
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    })

    // Add all regions
    regions.forEach((region) => {
      sitemap.push({
        url: `${baseUrl}/${createSlug(region.regionName)}`,
        lastModified: new Date(region.collectedAt),
        changeFrequency: 'daily',
        priority: 0.9,
      })
    })

    // Add top districts (prioritize by listing count)
    const topDistricts = districts
      .filter(d => (d.listingCount || 0) >= 10) // Only districts with decent listings
      .sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))
      .slice(0, 200) // Increase limit for districts

    topDistricts.forEach((district) => {
      const region = regions.find(r => r.regionId === district.regionId)
      if (region) {
        sitemap.push({
          url: `${baseUrl}/${createSlug(region.regionName)}/${createSlug(district.districtName)}`,
          lastModified: new Date(district.collectedAt),
          changeFrequency: 'daily',
          priority: 0.8,
        })
      }
    })

    // Add top suburbs (prioritize by listing count)
    const topSuburbs = suburbs
      .filter(s => (s.listingCount || 0) >= 5) // Only suburbs with decent listings
      .sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))
      .slice(0, 500) // Increase limit for suburbs

    topSuburbs.forEach((suburb) => {
      const district = districts.find(d => d.districtId === suburb.districtId)
      const region = regions.find(r => r.regionId === suburb.regionId)
      
      if (district && region) {
        sitemap.push({
          url: `${baseUrl}/${createSlug(region.regionName)}/${createSlug(district.districtName)}/${createSlug(suburb.suburbName)}`,
          lastModified: new Date(suburb.collectedAt),
          changeFrequency: 'daily',
          priority: 0.7,
        })
      }
    })

    console.log(`✅ Generated sitemap with ${sitemap.length} URLs`)
    return sitemap

  } catch (error) {
    console.error('❌ Error generating sitemap:', error)
    
    // Return basic sitemap on error
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      }
    ]
  }
}