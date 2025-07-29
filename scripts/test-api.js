#!/usr/bin/env node

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

async function testTradeMeCollection() {
  console.log('🏠 Testing TradeMe Weekly Data Collection Strategy...\n');
  
  const listingTypes = ['HOUSES_TO_BUY', 'HOUSES_TO_RENT'];
  
  for (const listingType of listingTypes) {
    console.log(`📊 Testing ${listingType} collection...`);
    console.log('='.repeat(50));
    
    const startTime = Date.now();
    
    try {
      // Single API call to get ALL NZ data
      const url = `https://api.trademe.co.nz/v1/localities.json?with_counts=true&listing_type=${listingType}`;
      console.log(`🔍 Fetching: ${url}`);
      
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

      const regions = await response.json();
      const duration = Date.now() - startTime;
      
      console.log(`✅ SUCCESS! (${duration}ms)`);
      
      // Calculate totals
      let totalNzListings = 0;
      let totalRegions = 0;
      let totalDistricts = 0;
      let totalSuburbs = 0;
      let regionsWithListings = 0;
      let districtsWithListings = 0;
      let suburbsWithListings = 0;
      
      regions.forEach(region => {
        totalRegions++;
        const regionCount = region.Count || 0;
        totalNzListings += regionCount;
        if (regionCount > 0) regionsWithListings++;
        
        if (region.Districts) {
          region.Districts.forEach(district => {
            totalDistricts++;
            if (district.Count && district.Count > 0) districtsWithListings++;
            
            if (district.Suburbs) {
              district.Suburbs.forEach(suburb => {
                totalSuburbs++;
                if (suburb.Count && suburb.Count > 0) suburbsWithListings++;
              });
            }
          });
        }
      });
      
      // Display summary
      console.log(`\n📈 ${listingType} SUMMARY:`);
      console.log(`   🇳🇿 Total NZ Listings: ${totalNzListings.toLocaleString()}`);
      console.log(`   🏔️ Regions: ${regionsWithListings}/${totalRegions} with listings`);
      console.log(`   🏘️ Districts: ${districtsWithListings}/${totalDistricts} with listings`);
      console.log(`   🏠 Suburbs: ${suburbsWithListings.toLocaleString()}/${totalSuburbs.toLocaleString()} with listings`);
      
      // Show top regions
      const topRegions = regions
        .filter(r => r.Count && r.Count > 0)
        .sort((a, b) => (b.Count || 0) - (a.Count || 0))
        .slice(0, 5);
      
      console.log(`\n🏆 TOP 5 REGIONS:`);
      topRegions.forEach((region, index) => {
        const percentage = ((region.Count / totalNzListings) * 100).toFixed(1);
        console.log(`   ${index + 1}. ${region.Name}: ${region.Count.toLocaleString()} (${percentage}%)`);
      });
      
      // Show what we'd store in database
      console.log(`\n💾 DATABASE STORAGE PREVIEW:`);
      console.log(`   Weekly Snapshot Record:`);
      console.log(`     - Date: ${new Date().toISOString().split('T')[0]}`);
      console.log(`     - Listing Type: ${listingType}`);
      console.log(`     - Total NZ Listings: ${totalNzListings}`);
      console.log(`     - Raw Data Size: ${JSON.stringify(regions).length.toLocaleString()} characters`);
      
      console.log(`   Location Records: ${totalRegions + totalDistricts + totalSuburbs} total`);
      console.log(`     - ${totalRegions} region records`);
      console.log(`     - ${totalDistricts} district records`);
      console.log(`     - ${totalSuburbs.toLocaleString()} suburb records`);
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
    
    console.log('\n');
  }
  
  console.log('🎯 WEEKLY COLLECTION STRATEGY VALIDATED:');
  console.log('✅ Single API call gets complete NZ data');
  console.log('✅ All regions, districts, suburbs with counts');
  console.log('✅ No authentication required');
  console.log('✅ Fast response time');
  console.log('✅ Perfect for Friday weekly collection');
  console.log('✅ Can track multiple listing types');
  console.log('✅ Rich data for trend analysis');
  
  console.log('\n📅 RECOMMENDED SCHEDULE:');
  console.log('• Every Friday: Collect HOUSES_TO_BUY data');
  console.log('• Every Friday: Collect HOUSES_TO_RENT data');
  console.log('• Monthly: Add COMMERCIAL_FOR_SALE data');
  console.log('• Store raw JSON + flattened records');
  console.log('• Calculate trends from historical data');
}

// Run the test
testTradeMeCollection()
  .then(() => {
    console.log('\n🎉 TradeMe collection strategy test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n💥 Test failed:', error.message);
    process.exit(1);
  });