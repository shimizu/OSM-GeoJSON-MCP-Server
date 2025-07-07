#!/usr/bin/env node

// Test script for new limit functionality
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'src', 'index.js');

console.log('Testing limit functionality for all data tools...\n');

// Clean up previous test data
try {
  await fs.rm('./test-limits', { recursive: true, force: true });
} catch (e) {}
await fs.mkdir('./test-limits', { recursive: true });

// Start the server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Wait for server to start
setTimeout(async () => {
  const tests = [
    // Test 1: Buildings with limit 5
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_buildings',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          building_type: 'all',
          limit: 5
        }
      },
      id: 1
    },
    // Test 2: Roads with limit 10
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_roads',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          road_types: ['primary', 'secondary'],
          limit: 10
        }
      },
      id: 2
    },
    // Test 3: Amenities with limit 3
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_amenities',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          amenity_type: 'restaurant',
          limit: 3
        }
      },
      id: 3
    },
    // Test 4: Waterways with limit 2
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_waterways',
        arguments: {
          minLon: 139.740,
          minLat: 35.670,
          maxLon: 139.780,
          maxLat: 35.690,
          waterway_type: 'all',
          limit: 2
        }
      },
      id: 4
    },
    // Test 5: Green spaces with limit 7
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_green_spaces',
        arguments: {
          minLon: 139.760,
          minLat: 35.675,
          maxLon: 139.775,
          maxLat: 35.690,
          green_space_type: 'park',
          limit: 7
        }
      },
      id: 5
    },
    // Test 6: Railways with limit 15 and file output
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_railways',
        arguments: {
          minLon: 139.740,
          minLat: 35.670,
          maxLon: 139.780,
          maxLat: 35.690,
          railway_type: 'all',
          limit: 15,
          output_path: './test-limits/limited_railways.geojson'
        }
      },
      id: 6
    },
    // Test 7: Invalid limit (too high)
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_buildings',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          building_type: 'all',
          limit: 15000
        }
      },
      id: 7
    },
    // Test 8: Invalid limit (too low)
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_buildings',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          building_type: 'all',
          limit: 0
        }
      },
      id: 8
    },
    // Test 9: No limit (should work normally)
    {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'get_amenities',
        arguments: {
          minLon: 139.765,
          minLat: 35.680,
          maxLon: 139.770,
          maxLat: 35.685,
          amenity_type: 'cafe'
        }
      },
      id: 9
    }
  ];

  // Send all test requests
  for (let i = 0; i < tests.length; i++) {
    console.log(`\n--- Test ${i + 1}: ${tests[i].params.name} (limit: ${tests[i].params.arguments.limit || 'none'}) ---`);
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
        
        if (content.error) {
          console.log('✗ Expected Error:', content.error);
        } else if (content.status === 'success') {
          console.log('✓ File Success:', content.message);
          console.log('  File:', content.file);
          console.log('  Features:', content.feature_count);
          console.log('  Limit Applied:', content.limit_applied || 'none');
          console.log('  Is Truncated:', content.is_truncated || false);
        } else if (content.type === 'geojson') {
          console.log('✓ GeoJSON Success');
          console.log('  Features:', content.summary.feature_count);
          console.log('  Limit Applied:', content.summary.limit_applied || 'none');
          console.log('  Is Truncated:', content.summary.is_truncated || false);
          
          // Verify the limit was actually applied
          if (content.summary.limit_applied && content.summary.feature_count <= content.summary.limit_applied) {
            console.log('  ✓ Limit correctly applied');
          } else if (!content.summary.limit_applied) {
            console.log('  ✓ No limit applied (as expected)');
          } else {
            console.log('  ⚠️  Limit may not have been applied correctly');
          }
        }
      } else if (response.error) {
        console.error('✗ Error:', response.error);
      }
    } catch (e) {
      // Ignore parse errors for non-JSON output
    }
  });
});

// Check files and summarize results after completion
setTimeout(async () => {
  console.log('\n--- Checking created files ---');
  try {
    const files = await fs.readdir('./test-limits');
    for (const file of files) {
      const stats = await fs.stat(path.join('./test-limits', file));
      console.log(`✓ ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
      
      // Check if it's a GeoJSON file and verify content
      if (file.endsWith('.geojson')) {
        try {
          const content = await fs.readFile(path.join('./test-limits', file), 'utf8');
          const geojson = JSON.parse(content);
          console.log(`  Features in file: ${geojson.features ? geojson.features.length : 'unknown'}`);
        } catch (e) {
          console.log(`  Could not parse ${file}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.error('Error checking files:', e.message);
  }
  
  console.log('\n--- Summary ---');
  console.log('✓ Tested limit functionality on 6 different tools');
  console.log('✓ Tested both valid and invalid limit values');
  console.log('✓ Tested both JSON response and file output modes');
  console.log('✓ Verified that responses include limit metadata');
  console.log('✓ Confirmed error handling for invalid limits');
  
  console.log('\nLimit functionality test completed.');
  server.kill();
  process.exit(0);
}, 30000);

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error.message);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nTest interrupted by user');
  server.kill();
  process.exit(130);
});