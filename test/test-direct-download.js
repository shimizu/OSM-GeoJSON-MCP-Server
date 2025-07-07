#!/usr/bin/env node

// Test script for direct download functionality
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'src', 'index.js');

console.log('Testing direct download functionality for all tools...\n');

// Clean up previous test data
try {
  await fs.rm('./test-downloads', { recursive: true, force: true });
} catch (e) {}
await fs.mkdir('./test-downloads', { recursive: true });

// Start the server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Wait for server to start
setTimeout(async () => {
  const tests = [
    // Test 1: Buildings with file output (.geojson)
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_buildings',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          building_type: 'all',
          output_path: './test-downloads/buildings.geojson'
        }
      },
      id: 1
    },
    // Test 2: Roads with file output (.json)
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_roads',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          road_types: ['primary', 'secondary'],
          output_path: './test-downloads/roads.json'
        }
      },
      id: 2
    },
    // Test 3: Amenities without file output (traditional response)
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_amenities',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          amenity_type: 'restaurant'
        }
      },
      id: 3
    },
    // Test 4: Railways with file output
    {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_railways',
        arguments: {
          minLon: 139.740,
          minLat: 35.670,
          maxLon: 139.780,
          maxLat: 35.690,
          railway_type: 'station',
          output_path: './test-downloads/stations.geojson'
        }
      },
      id: 4
    }
  ];

  // Send all test requests
  for (let i = 0; i < tests.length; i++) {
    console.log(`\n--- Test ${i + 1}: ${tests[i].params.name} ---`);
    server.stdin.write(JSON.stringify(tests[i]) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait between requests
  }
}, 1000);

// Handle responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      if (response.result) {
        const content = JSON.parse(response.result.content[0].text);
        if (content.status === 'success') {
          console.log('✓ Success:', content.message);
          if (content.file) {
            console.log('  File:', content.file);
            console.log('  Size:', content.size);
            if (content.feature_count !== undefined) {
              console.log('  Features:', content.feature_count);
            }
          }
        } else if (content.type === 'geojson') {
          console.log('✓ Success: Received GeoJSON response');
          console.log('  Features:', content.summary.feature_count);
        }
      } else if (response.error) {
        console.error('✗ Error:', response.error);
      }
    } catch (e) {
      // Ignore parse errors for non-JSON output
    }
  });
});

// Check files after completion
setTimeout(async () => {
  console.log('\n--- Checking created files ---');
  try {
    const files = await fs.readdir('./test-downloads');
    for (const file of files) {
      const stats = await fs.stat(path.join('./test-downloads', file));
      console.log(`✓ ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    }
  } catch (e) {
    console.error('Error checking files:', e.message);
  }
  
  console.log('\nTest completed.');
  server.kill();
  process.exit(0);
}, 15000);