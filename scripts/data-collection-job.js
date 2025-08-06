#!/usr/bin/env node
// scripts\data-collection-job.js

import { config } from 'dotenv';
config({ path: '.env.local' });

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { collectPropertyData } from '../lib/data-collection.js';

const execAsync = promisify(exec);

console.log('🏠 NZ Housing Stats Data Collection Service Starting...');
console.log(`⏰ Will collect data at 5:00 PM daily (NZ time)`);
console.log(`🕐 Started at: ${new Date().toISOString()}`);

// Run at 5:00 PM every day NZ time: '0 17 * * *'
const task = cron.schedule('0 17 * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 Starting daily data collection at ${timestamp}`);
  
  try {
    // Collect houses for sale
    console.log('📊 Collecting HOUSES_TO_BUY data...');
    const buyResult = await collectPropertyData('HOUSES_TO_BUY');
    
    if (buyResult.success) {
      console.log(`✅ HOUSES_TO_BUY: ${buyResult.totalNzListings.toLocaleString()} listings across ${buyResult.totalRecords.toLocaleString()} locations stored`);
      
      // 🆕 Push updated database to GitHub
      console.log('📤 Pushing updated database to GitHub...');
      
      try {
        // Add the database file
        await execAsync('git add data/nzhousingstats.db');
        
        // Commit with timestamp
        const commitMessage = `Daily data update: ${new Date().toISOString().split('T')[0]}`;
        await execAsync(`git commit -m "${commitMessage}"`);
        
        // Push to GitHub
        await execAsync('git push origin main');
        
        console.log('✅ Database successfully pushed to GitHub');
        
      } catch (gitError) {
        console.error('⚠️ Git push failed:', gitError.message);
        console.log('📊 Data collection succeeded, but GitHub sync failed');
      }
      
    } else {
      console.error(`❌ HOUSES_TO_BUY failed: ${buyResult.error}`);
    }

    // Optional: Collect rental data too
    // console.log('📊 Collecting HOUSES_TO_RENT data...');
    // const rentResult = await collectPropertyData('HOUSES_TO_RENT');
    // if (rentResult.success) {
    //   console.log(`✅ HOUSES_TO_RENT: ${rentResult.totalNzListings.toLocaleString()} listings stored`);
    // }

    console.log(`🎉 Daily data collection completed at ${new Date().toISOString()}`);
    console.log(`📈 Next collection scheduled for tomorrow at 5:00 PM NZ time\n`);
    
  } catch (error) {
    console.error('💥 Data collection job failed:', error);
    console.error('🔄 Will retry tomorrow at scheduled time\n');
  }
}, {
  timezone: "Pacific/Auckland"
});

// Start the task
task.start();

// Optional: Add a test run command
if (process.argv.includes('--test')) {
  console.log('🧪 Running test collection now...');
  (async () => {
    try {
      const result = await collectPropertyData('HOUSES_TO_BUY');
      console.log('✅ Test result:', result);
      process.exit(0);
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  })();
}

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down data collection service...');
  task.stop();
  process.exit(0);
});

console.log('✅ Data collection service is running. Press Ctrl+C to stop.');
console.log('💡 Run with --test flag to test collection immediately');