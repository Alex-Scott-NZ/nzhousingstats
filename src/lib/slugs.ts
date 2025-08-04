// src\lib\slugs.ts
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

export function createLocationSlug(
  regionName: string,
  districtName?: string,
  suburbName?: string
): string {
  const parts = [createSlug(regionName)];
  
  if (districtName) {
    parts.push(createSlug(districtName));
  }
  
  if (suburbName) {
    parts.push(createSlug(suburbName));
  }
  
  return parts.join('/');
}

// Reverse lookup functions
export function findLocationBySlug(
  allData: any,
  regionSlug: string,
  districtSlug?: string,
  suburbSlug?: string
) {
  const regions = allData.HOUSES_TO_BUY.regions;
  const districts = allData.HOUSES_TO_BUY.districts;
  const suburbs = allData.HOUSES_TO_BUY.suburbs;

  // Find region
  const region = regions.find((r: any) => 
    createSlug(r.regionName) === regionSlug
  );
  
  if (!region) return null;

  if (!districtSlug) {
    return { region, district: null, suburb: null };
  }

  // Find district
  const district = districts.find((d: any) => 
    d.regionId === region.regionId && 
    createSlug(d.districtName) === districtSlug
  );

  if (!district) return null;

  if (!suburbSlug) {
    return { region, district, suburb: null };
  }

  // Find suburb
  const suburb = suburbs.find((s: any) => 
    s.districtId === district.districtId && 
    createSlug(s.suburbName) === suburbSlug
  );

  return { region, district, suburb };
}