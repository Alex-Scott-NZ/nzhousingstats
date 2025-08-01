#!/usr/bin/env node
// scripts\test-data-collection.js

import { config } from 'dotenv';
config({ path: '.env.local' });

// Import from the TypeScript file
import { collectPropertyData } from '../lib/data-collection.ts';

async function testCollection() {
  console.log('🧪 Testing data collection...\n');
  
  try {
    const result = await collectPropertyData('HOUSES_TO_BUY');
    
    if (result.success) {
      console.log('🎉 Collection successful!');
      console.log(`📊 Total NZ listings: ${result.totalNzListings.toLocaleString()}`);
      console.log(`💾 Records stored: ${result.totalRecords.toLocaleString()}`);
      console.log('\n💡 Now check Drizzle Studio to see your data!');
    } else {
      console.log('❌ Collection failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testCollection();