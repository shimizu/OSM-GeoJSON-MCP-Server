#!/usr/bin/env node

// Test script for download functionality
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'src', 'index.js');

console.log('Testing download functionality...\n');

// Start the server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Wait for server to start
setTimeout(() => {
  // Test get_buildings with file output
  const testDownload = {
    jsonrpc: '2.0',
    method: 'call_tool',
    params: {
      name: 'get_buildings',
      arguments: {
        minLon: 139.7,
        minLat: 35.65,
        maxLon: 139.71,
        maxLat: 35.66,
        building_type: 'all',
        output_path: './test-data/test-buildings.json'
      }
    },
    id: 1
  };

  server.stdin.write(JSON.stringify(testDownload) + '\n');

  // Test convert_to_geojson
  setTimeout(() => {
    const testConvert = {
      jsonrpc: '2.0',
      method: 'call_tool',
      params: {
        name: 'convert_to_geojson',
        arguments: {
          input_path: './test-data/test-buildings.json',
          output_path: './test-data/test-buildings.geojson'
        }
      },
      id: 2
    };

    server.stdin.write(JSON.stringify(testConvert) + '\n');
  }, 5000);

  // Test listing tools
  const listTools = {
    jsonrpc: '2.0',
    method: 'list_tools',
    params: {},
    id: 3
  };

  server.stdin.write(JSON.stringify(listTools) + '\n');
}, 1000);

// Handle responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      if (response.result) {
        console.log('Response:', JSON.stringify(response.result, null, 2));
      } else if (response.error) {
        console.error('Error:', response.error);
      }
    } catch (e) {
      // Ignore parse errors for non-JSON output
    }
  });
});

// Clean exit after 10 seconds
setTimeout(() => {
  console.log('\nTest completed.');
  server.kill();
  process.exit(0);
}, 10000);