#!/usr/bin/env node

/**
 * Script to add or update a provider in the database
 * Usage: node scripts/add-provider.js
 */

require('dotenv').config();
const providerRepository = require('../src/repositories/providerRepository');
const { encrypt } = require('../src/utils/encryption');
const { createPool, closePool } = require('../src/config/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  try {
    console.log('===========================================');
    console.log('Add/Update Provider');
    console.log('===========================================\n');

    // Initialize database
    createPool();

    // Get provider details
    const name = await question('Provider name (e.g., truebiz): ');
    const displayName = await question('Display name (e.g., TrueBiz Web Presence): ');
    const apiBaseUrl = await question('API Base URL (e.g., https://ae.truebiz.io/api/v1): ');
    const apiKey = await question('API Key: ');
    const priority = parseInt(await question('Priority (lower = higher priority, default 100): ') || '100', 10);
    const rateLimit = parseInt(await question('Rate limit (requests/minute, default 60): ') || '60', 10);
    const timeout = parseInt(await question('Timeout (ms, default 10000): ') || '10000', 10);
    const enabled = (await question('Enabled? (y/n, default y): ') || 'y').toLowerCase() === 'y';

    console.log('\nEncrypting API key...');
    const apiKeyEncrypted = encrypt(apiKey);

    console.log('Saving to database...');
    const provider = await providerRepository.upsert({
      name,
      displayName,
      apiBaseUrl,
      apiKeyEncrypted,
      enabled,
      priority,
      rateLimit,
      timeout,
      config: {}
    });

    console.log('\n===========================================');
    console.log('Provider saved successfully!');
    console.log('===========================================');
    console.log(`ID: ${provider.id}`);
    console.log(`Name: ${provider.name}`);
    console.log(`Display Name: ${provider.display_name}`);
    console.log(`Enabled: ${provider.enabled}`);
    console.log(`Priority: ${provider.priority}`);
    console.log('\nRestart your application to load the new provider.');

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await closePool();
  }
}

main();
