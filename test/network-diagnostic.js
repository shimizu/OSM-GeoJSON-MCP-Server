// network-diagnostic.js
// ネットワーク接続の詳細診断

import https from 'https';
import http from 'http';
import net from 'net';
import { URL } from 'url';

// TCPレベルでの接続テスト
async function testTCPConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startTime = Date.now();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      const duration = Date.now() - startTime;
      socket.destroy();
      resolve({ success: true, duration });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    
    socket.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
    
    socket.connect(port, host);
  });
}

// HTTPSリクエストの詳細テスト
async function testHTTPSRequest(url) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const startTime = Date.now();
    
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'OSM-Diagnostic/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      const duration = Date.now() - startTime;
      res.on('data', () => {}); // データを消費
      res.on('end', () => {
        resolve({
          success: true,
          statusCode: res.statusCode,
          headers: res.headers,
          duration
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        code: err.code
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });
    
    req.end();
  });
}

// 他のHTTPSサービスへの接続テスト
async function testOtherServices() {
  console.log('\n=== Testing other HTTPS services ===\n');
  
  const services = [
    'https://www.google.com',
    'https://api.github.com',
    'https://httpbin.org/get',
    'https://www.openstreetmap.org'
  ];
  
  for (const service of services) {
    const result = await testHTTPSRequest(service);
    if (result.success) {
      console.log(`✓ ${service} - Status: ${result.statusCode} (${result.duration}ms)`);
    } else {
      console.log(`✗ ${service} - Error: ${result.error}`);
    }
  }
}

// ポート443への直接接続テスト
async function testPort443() {
  console.log('\n=== Testing TCP port 443 connectivity ===\n');
  
  const hosts = [
    { name: 'overpass-api.de', ip: '162.55.144.139' },
    { name: 'lz4.overpass-api.de', ip: '65.109.112.52' },
    { name: 'overpass.kumi.systems', ip: '193.219.97.30' }
  ];
  
  for (const host of hosts) {
    // ホスト名でテスト
    const hostResult = await testTCPConnection(host.name, 443);
    if (hostResult.success) {
      console.log(`✓ ${host.name}:443 - Connected (${hostResult.duration}ms)`);
    } else {
      console.log(`✗ ${host.name}:443 - ${hostResult.error}`);
    }
    
    // IPアドレスでテスト
    const ipResult = await testTCPConnection(host.ip, 443);
    if (ipResult.success) {
      console.log(`✓ ${host.ip}:443 - Connected (${ipResult.duration}ms)`);
    } else {
      console.log(`✗ ${host.ip}:443 - ${ipResult.error}`);
    }
  }
}

// tracerouteの代替（Node.js実装）
async function simpleTraceroute(host) {
  console.log(`\n=== Checking route to ${host} ===\n`);
  
  // pingテスト（ICMPの代わりにTCPを使用）
  const ports = [80, 443, 8080];
  
  for (const port of ports) {
    const result = await testTCPConnection(host, port);
    console.log(`Port ${port}: ${result.success ? '✓ Open' : `✗ ${result.error}`}`);
  }
}

// curl相当のテスト
async function curlEquivalent() {
  console.log('\n=== Testing with minimal HTTP client ===\n');
  
  const testUrl = 'https://overpass-api.de/api/interpreter';
  const minimalQuery = '[out:json];out count;';
  
  return new Promise((resolve) => {
    const parsedUrl = new URL(testUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(minimalQuery),
        'User-Agent': 'curl/7.64.1'
      },
      timeout: 30000,
      rejectUnauthorized: false // 証明書エラーを無視（デバッグ用）
    };
    
    console.log('Request options:', options);
    
    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log('Headers:', res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response:', data);
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('Request error:', err.message);
      console.log('Error code:', err.code);
      console.log('Error details:', err);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('Request timeout after 30 seconds');
      req.destroy();
    });
    
    req.write(minimalQuery);
    req.end();
  });
}

// システム情報
function showSystemInfo() {
  console.log('=== System Information ===\n');
  console.log('Node.js version:', process.version);
  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);
  console.log('OpenSSL version:', process.versions.openssl);
}

// すべてのテストを実行
async function runDiagnostics() {
  showSystemInfo();
  await testOtherServices();
  await testPort443();
  await simpleTraceroute('overpass-api.de');
  await curlEquivalent();
}

runDiagnostics().catch(console.error);