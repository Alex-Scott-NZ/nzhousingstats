#!/usr/bin/env node
// scripts\validate-trademe-api.ts

import type { TradeMeLocalitiesResponse, Region, District, Suburb } from '../lib/types/trademe';

async function validateTradeMeAPI(): Promise<void> {
  console.log('🔍 Validating TradeMe API Data Integrity...\n');
  
  const url = 'https://api.trademe.co.nz/v1/localities.json?with_counts=true&listing_type=HOUSES_TO_BUY';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NZHousingStats/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status} ${response.statusText}`);
    }

    const allRegions: TradeMeLocalitiesResponse = await response.json();
    
    // Filter out the "All" locality (LocalityId: 100)
    const validRegions: Region[] = allRegions.filter((region: Region) => region.LocalityId !== 100);
    const filteredOut: Region[] = allRegions.filter((region: Region) => region.LocalityId === 100);
    
    console.log('🚮 FILTERED OUT:');
    filteredOut.forEach((region: Region) => {
      console.log(`   LocalityId: ${region.LocalityId}, Name: "${region.Name}", Districts: ${region.Districts?.length || 0}`);
    });
    
    console.log(`\n📊 VALID REGIONS: ${validRegions.length} (filtered from ${allRegions.length})\n`);
    
    // Calculate totals at each level
    let regionTotal = 0; // Always 0 since we removed region counts
    let districtTotal = 0; 
    let suburbTotal = 0;
    
    let regionsWithCounts = 0; // Always 0 since we removed region counts
    let districtsWithCounts = 0;
    let suburbsWithCounts = 0;
    
    let totalRegions = validRegions.length;
    let totalDistricts = 0;
    let totalSuburbs = 0;
    
    interface RegionBreakdown {
      name: string;
      localityId: number;
      regionCount: number; // Always 0
      districtSum: number;
      suburbSum: number;
      districts: number;
      suburbsWithListings: number;
    }
    
    const regionBreakdown: RegionBreakdown[] = [];
    
    validRegions.forEach((region: Region) => {
      const regionCount = 0; // We don't trust region counts
      regionTotal += regionCount;
      if (regionCount > 0) regionsWithCounts++;
      
      let regionDistrictTotal = 0;
      let regionSuburbTotal = 0;
      let regionDistrictCount = 0;
      let regionSuburbCount = 0;
      
      if (region.Districts) {
        totalDistricts += region.Districts.length;
        
        region.Districts.forEach((district: District) => {
          const districtCount = district.Count || 0;
          districtTotal += districtCount;
          regionDistrictTotal += districtCount;
          regionDistrictCount++;
          if (districtCount > 0) districtsWithCounts++;
          
          if (district.Suburbs) {
            totalSuburbs += district.Suburbs.length;
            
            district.Suburbs.forEach((suburb: Suburb) => {
              const suburbCount = suburb.Count || 0;
              if (suburbCount > 0) {
                suburbTotal += suburbCount;
                regionSuburbTotal += suburbCount;
                regionSuburbCount++;
                suburbsWithCounts++;
              }
            });
          }
        });
      }
      
      // Store region breakdown for analysis
      regionBreakdown.push({
        name: region.Name,
        localityId: region.LocalityId,
        regionCount,
        districtSum: regionDistrictTotal,
        suburbSum: regionSuburbTotal,
        districts: regionDistrictCount,
        suburbsWithListings: regionSuburbCount
      });
    });
    
    console.log('📈 TOTAL CALCULATIONS:');
    console.log(`   Region level:     ${regionTotal.toLocaleString()} (ignored - unreliable)`);
    console.log(`   District level:   ${districtTotal.toLocaleString()} (${districtsWithCounts}/${totalDistricts} with listings)`);
    console.log(`   Suburb level:     ${suburbTotal.toLocaleString()} (${suburbsWithCounts}/${totalSuburbs} with listings)`);
    
    console.log('\n🔍 DATA INTEGRITY CHECK:');
    if (districtTotal === suburbTotal) {
      console.log('   ✅ Districts and suburbs match perfectly!');
      console.log('   💡 Using suburb data as single source of truth');
    } else {
      console.log('   ❌ District and suburb totals differ!');
      console.log(`   🔧 District: ${districtTotal.toLocaleString()}, Suburb: ${suburbTotal.toLocaleString()}`);
    }
    
    console.log('\n🏆 TOP 10 REGIONS BY SUBURB TOTAL:');
    regionBreakdown
      .sort((a: RegionBreakdown, b: RegionBreakdown) => b.suburbSum - a.suburbSum)
      .slice(0, 10)
      .forEach((region: RegionBreakdown, index: number) => {
        const districtMatch = region.districtSum === region.suburbSum ? '✅' : '❌';
        console.log(`   ${index + 1}. ${region.name}: ${region.suburbSum.toLocaleString()} listings ${districtMatch}`);
        if (region.districtSum !== region.suburbSum) {
          console.log(`      District sum: ${region.districtSum.toLocaleString()}, Suburb sum: ${region.suburbSum.toLocaleString()}`);
        }
      });
    
    // Show Auckland district breakdown
    console.log('\n🏙️ AUCKLAND DISTRICT BREAKDOWN:');
    const auckland = validRegions.find((r: Region) => r.Name === 'Auckland');
    if (auckland && auckland.Districts) {
      console.log(`   Region: ${auckland.Name} (LocalityId: ${auckland.LocalityId})`);
      console.log(`   Region API Total: Not using (unreliable)`);
      
      let aucklandDistrictApiSum = 0;
      let aucklandSuburbSum = 0;
      
      const districtBreakdown = auckland.Districts.map((district: District) => {
        const districtApiCount = district.Count || 0;
        aucklandDistrictApiSum += districtApiCount;
        
        let suburbSum = 0;
        if (district.Suburbs) {
          district.Suburbs.forEach((suburb: Suburb) => {
            if (suburb.Count) suburbSum += suburb.Count;
          });
        }
        aucklandSuburbSum += suburbSum;
        
        return {
          name: district.Name,
          id: district.DistrictId,
          apiCount: districtApiCount,
          suburbSum,
          suburbCount: district.Suburbs?.filter(s => s.Count && s.Count > 0).length || 0
        };
      });
      
      // Sort by suburb sum
      districtBreakdown
        .sort((a, b) => b.suburbSum - a.suburbSum)
        .forEach((district, index) => {
          const match = district.apiCount === district.suburbSum ? '✅' : '❌';
          console.log(`   ${index + 1}. ${district.name}: ${district.suburbSum.toLocaleString()} listings ${match} (ID: ${district.id})`);
          if (district.apiCount !== district.suburbSum) {
            console.log(`      District API: ${district.apiCount.toLocaleString()}, Suburb sum: ${district.suburbSum.toLocaleString()} (${district.suburbCount} suburbs)`);
          }
        });
      
      console.log(`\n   📊 AUCKLAND TOTALS:`);
      console.log(`      Region API:     Not using (unreliable)`);
      console.log(`      District sum:   ${aucklandDistrictApiSum.toLocaleString()}`);
      console.log(`      Suburb sum:     ${aucklandSuburbSum.toLocaleString()} ← Most accurate`);
      console.log(`      District vs Suburb: ${aucklandDistrictApiSum === aucklandSuburbSum ? '✅ Match' : '❌ Mismatch'}`);
    }
    
    // Show Wellington district breakdown
    console.log('\n🏛️ WELLINGTON DISTRICT BREAKDOWN:');
    const wellington = validRegions.find((r: Region) => r.Name === 'Wellington');
    if (wellington && wellington.Districts) {
      console.log(`   Region: ${wellington.Name} (LocalityId: ${wellington.LocalityId})`);
      
      const wellingtonDistrictBreakdown = wellington.Districts.map((district: District) => {
        let suburbSum = 0;
        if (district.Suburbs) {
          district.Suburbs.forEach((suburb: Suburb) => {
            if (suburb.Count) suburbSum += suburb.Count;
          });
        }
        
        return {
          name: district.Name,
          id: district.DistrictId,
          apiCount: district.Count || 0,
          suburbSum,
          suburbCount: district.Suburbs?.filter(s => s.Count && s.Count > 0).length || 0
        };
      });
      
      wellingtonDistrictBreakdown
        .sort((a, b) => b.suburbSum - a.suburbSum)
        .slice(0, 5) // Top 5 districts
        .forEach((district, index) => {
          const match = district.apiCount === district.suburbSum ? '✅' : '❌';
          console.log(`   ${index + 1}. ${district.name}: ${district.suburbSum.toLocaleString()} listings ${match} (${district.suburbCount} suburbs)`);
        });
    }
    
    console.log('\n📊 REGIONS BY SUBURB TOTALS (REGION API IGNORED):');
    regionBreakdown
      .sort((a, b) => b.suburbSum - a.suburbSum)
      .forEach((region: RegionBreakdown) => {
        const districtMatch = region.districtSum === region.suburbSum ? '✅' : '❌';
        console.log(`   ${region.name}: ${region.suburbSum.toLocaleString()} listings ${districtMatch} (${region.suburbsWithListings} suburbs)`);
      });
    
    console.log('\n💾 COLLECTION STRATEGY RECOMMENDATION:');
    console.log(`   ✅ Filter out LocalityId 100 ("All")`);
    console.log(`   ✅ Use SUBURB data as source of truth (${suburbTotal.toLocaleString()} total)`);
    console.log(`   ✅ Store only suburbs with Count > 0 (${suburbsWithCounts.toLocaleString()} records)`);
    console.log(`   ✅ Calculate region/district totals from suburb data`);
    
    // Show the corrected collection numbers
    console.log('\n📊 EXPECTED COLLECTION RESULTS:');
    console.log(`   Total NZ Listings: ${suburbTotal.toLocaleString()}`);
    console.log(`   Regions to store: ${totalRegions}`);
    console.log(`   Districts to store: ${totalDistricts}`);
    console.log(`   Suburbs to store: ${totalSuburbs.toLocaleString()}`);
    console.log(`   Suburb listings to store: ${suburbsWithCounts.toLocaleString()} (sparse data)`);
    
  } catch (error) {
    console.error('❌ API validation failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

validateTradeMeAPI();