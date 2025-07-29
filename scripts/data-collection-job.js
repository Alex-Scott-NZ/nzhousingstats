#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

import cron from 'node-cron';
import { collectPropertyData } from '../lib/data-collection.ts';

console.log('🏠 NZ Housing Stats Data Collection Service Starting...');
console.log(`⏰ Will collect data every 15 minutes`);
console.log(`🕐 Started at: ${new Date().toISOString()}`);

// Run every 15 minutes: '*/15 * * * *'
// For production, you might want: '0 */6 * * *' (every 6 hours)
cron.schedule('*/15 * * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 Starting data collection at ${timestamp}`);
  
  try {
    // Collect houses for sale
    const buyResult = await collectPropertyData('HOUSES_TO_BUY');
    if (buyResult.success) {
      console.log(`✅ HOUSES_TO_BUY: ${buyResult.totalNzListings.toLocaleString()} listings, ${buyResult.totalRecords.toLocaleString()} records stored`);
    } else {
      console.error(`❌ HOUSES_TO_BUY failed: ${buyResult.error}`);
    }

    // Collect rentals (optional - you might want less frequent)
    const rentResult = await collectPropertyData('HOUSES_TO_RENT');
    if (rentResult.success) {
      console.log(`✅ HOUSES_TO_RENT: ${rentResult.totalNzListings.toLocaleString()} listings, ${rentResult.totalRecords.toLocaleString()} records stored`);
    } else {
      console.error(`❌ HOUSES_TO_RENT failed: ${rentResult.error}`);
    }

    console.log(`🎉 Data collection completed at ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('💥 Data collection job failed:', error);
  }
}, {
  scheduled: true,
  timezone: "Pacific/Auckland" // NZ timezone
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down data collection service...');
  process.exit(0);
});

console.log('✅ Data collection service is running. Press Ctrl+C to stop.');