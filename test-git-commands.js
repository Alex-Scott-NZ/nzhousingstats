#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Testing Git commands...');

try {
  console.log('1. Testing git status...');
  const { stdout: status } = await execAsync('git status --porcelain');
  console.log('✅ Git status worked');
  
  console.log('2. Testing git add...');
  await execAsync('git add data/nzhousingstats.db');
  console.log('✅ Git add worked');
  
  console.log('3. Testing git commit...');
  const { stdout: commit } = await execAsync('git commit -m "Test from Node.js: $(date)"');
  console.log('✅ Git commit worked:', commit.trim());
  
  console.log('4. Testing git push...');
  const { stdout: push } = await execAsync('git push origin main');
  console.log('✅ Git push worked:', push.trim());
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Command that failed:', error.cmd);
}
