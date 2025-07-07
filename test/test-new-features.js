#!/usr/bin/env node

// 新機能（キャッシュ、ログ、統計）のテストスクリプト
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'src', 'index.js');

console.log('Testing new features: cache, logging, and statistics...\n');

// Clean up previous test data
try {
  await fs.rm('./test-features', { recursive: true, force: true });
} catch (e) {}
await fs.mkdir('./test-features', { recursive: true });

// Start the server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Test queue
let testQueue = [];
let responseCount = 0;

// 東京駅周辺の小さなエリア
const testArea = {
  minLon: 139.765,
  minLat: 35.679,
  maxLon: 139.768,
  maxLat: 35.682
};

// Wait for server to start
setTimeout(async () => {
  console.log('--- Phase 1: Initial data requests (cache misses) ---');
  
  // Test 1: First building request (cache miss)
  testQueue.push({
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'get_buildings',
      arguments: {
        ...testArea,
        building_type: 'all'
      }
    },
    id: 1,
    description: 'First buildings request (cache miss)'
  });

  // Test 2: First roads request (cache miss)
  testQueue.push({
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'get_roads',
      arguments: {
        ...testArea,
        road_types: ['all']
      }
    },
    id: 2,
    description: 'First roads request (cache miss)'
  });

  // Execute Phase 1
  for (const test of testQueue.slice(0, 2)) {
    console.log(`\n${test.description}...`);
    server.stdin.write(JSON.stringify(test) + '\n');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Wait for completion
  }

  console.log('\n--- Phase 2: Repeated requests (cache hits) ---');
  
  // Test 3: Second building request (cache hit)
  testQueue.push({
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'get_buildings',
      arguments: {
        ...testArea,
        building_type: 'all'
      }
    },
    id: 3,
    description: 'Second buildings request (cache hit)'
  });

  // Test 4: File output with same data (should use cache)
  testQueue.push({
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'get_buildings',
      arguments: {
        ...testArea,
        building_type: 'all',
        output_path: './test-features/cached-buildings.geojson'
      }
    },
    id: 4,
    description: 'Buildings with file output (cache hit)'
  });

  // Execute Phase 2
  for (const test of testQueue.slice(2, 4)) {
    console.log(`\n${test.description}...`);
    server.stdin.write(JSON.stringify(test) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Shorter wait for cache hits
  }

  console.log('\n--- Phase 3: Statistics and monitoring ---');
  
  // Test 5: Get API statistics
  testQueue.push({
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'get_api_stats',
      arguments: {}
    },
    id: 5,
    description: 'API statistics'
  });

  // Test 6: Connection test
  testQueue.push({
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'test_connection',
      arguments: {}
    },
    id: 6,
    description: 'Connection test'
  });

  // Execute Phase 3
  for (const test of testQueue.slice(4, 6)) {
    console.log(`\n${test.description}...`);
    server.stdin.write(JSON.stringify(test) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

}, 1000);

// Handle responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      if (response.result) {
        responseCount++;
        const content = JSON.parse(response.result.content[0].text);
        
        if (response.id === 1 || response.id === 3) {
          // Buildings requests
          console.log(`✓ Response ${response.id}: ${content.summary?.feature_count || 0} buildings`);
          if (response.id === 3) {
            console.log('  → Should be faster due to caching');
          }
        } else if (response.id === 2) {
          // Roads request
          console.log(`✓ Response ${response.id}: ${content.summary?.feature_count || 0} roads`);
        } else if (response.id === 4) {
          // File output
          if (content.status === 'success') {
            console.log(`✓ Response ${response.id}: File saved to ${content.file}`);
            console.log(`  Size: ${content.size}, Features: ${content.feature_count}`);
          }
        } else if (response.id === 5) {
          // Statistics
          console.log('✓ API Statistics:');
          console.log(`  Total requests: ${content.api_statistics?.requests?.total || 0}`);
          console.log(`  Cache hits: ${content.api_statistics?.cache?.hits || 0}`);
          console.log(`  Cache misses: ${content.api_statistics?.cache?.misses || 0}`);
          console.log(`  Cache hit rate: ${content.api_statistics?.cache?.hitRate || '0%'}`);
          console.log(`  Error rate: ${content.api_statistics?.errors?.errorRate || '0%'}`);
          console.log(`  Uptime: ${content.api_statistics?.uptime?.formatted || 'unknown'}`);
          
          if (content.cache_statistics) {
            console.log(`  Cache size: ${content.cache_statistics.size} entries`);
          }
        } else if (response.id === 6) {
          // Connection test
          console.log('✓ Connection test completed');
        }
        
      } else if (response.error) {
        console.error(`✗ Error in response ${response.id}:`, response.error);
      }
    } catch (e) {
      // Ignore parse errors for non-JSON output
    }
  });
});

// Final check and cleanup
setTimeout(async () => {
  console.log('\n--- Final verification ---');
  
  try {
    const files = await fs.readdir('./test-features');
    if (files.length > 0) {
      console.log('Created files:');
      for (const file of files) {
        const stats = await fs.stat(path.join('./test-features', file));
        console.log(`  ✓ ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // Quick validation for GeoJSON files
        if (file.endsWith('.geojson')) {
          const content = await fs.readFile(path.join('./test-features', file), 'utf8');
          const geojson = JSON.parse(content);
          if (geojson.type === 'FeatureCollection') {
            console.log(`    → Valid GeoJSON with ${geojson.features.length} features`);
          }
        }
      }
    } else {
      console.log('No files created');
    }
  } catch (e) {
    console.error('Error checking files:', e.message);
  }
  
  console.log(`\nTest completed. Processed ${responseCount} responses.`);
  console.log('Expected cache behavior:');
  console.log('  - First requests should be cache misses (slower)');
  console.log('  - Repeated requests should be cache hits (faster)');
  console.log('  - Cache hit rate should be > 0%');
  
  server.kill();
  process.exit(0);
}, 30000);