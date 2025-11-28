// simple-test.js
// 最も簡単な接続テスト

import axios from 'axios';
import https from 'https';

async function testMinimalQuery() {
  console.log('Testing minimal Overpass query...\n');

  // SSL証明書検証を無効化（IPアドレス直接接続用）
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  // 最小限のクエリ（Wikiの例に基づく）
  const minimalQuery = '[out:json];out count;';
  
  const servers = [
    { url: 'https://162.55.144.139/api/interpreter', host: 'overpass-api.de' },
    { url: 'https://65.109.112.52/api/interpreter', host: 'lz4.overpass-api.de' },
    { url: 'https://193.219.97.30/api/interpreter', host: 'overpass.kumi.systems' }
  ];

  for (const server of servers) {
    console.log(`\nTesting ${server.url} (Host: ${server.host})...`);
    
    try {
      console.time('Request time');
      
      const response = await axios.post(server.url, minimalQuery, {
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'OSM-MCP/1.0',
          'Host': server.host
        },
        httpsAgent: httpsAgent,
        timeout: 30000,
        validateStatus: (status) => true // すべてのステータスを受け入れる
      });
      
      console.timeEnd('Request time');
      console.log(`Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`✓ SUCCESS for ${server.host}! Response:`, JSON.stringify(response.data, null, 2));
      } else {
        console.log(`✗ Error status for ${server.host}: ${response.status}`);
        console.log(`Response:`, response.data);
      }
      
    } catch (error) {
      console.timeEnd('Request time');
      console.log(`✗ Network error: ${error.message}`);
      
      if (error.code) {
        console.log(`Error code: ${error.code}`);
      }
      
      if (error.response) {
        console.log(`Response status: ${error.response.status}`);
        console.log(`Response headers:`, error.response.headers);
      }
    }
  }
}

// DNS解決のテスト
async function testDNS() {
  console.log('\n\n=== DNS Resolution Test ===\n');
  
  const dns = await import('dns').then(m => m.promises);
  
  const hosts = [
    'overpass-api.de',
    'lz4.overpass-api.de', 
    'overpass.kumi.systems',
    '162.55.144.139',
    '65.109.112.52',
    '193.219.97.30'
  ];
  
  for (const host of hosts) {
    try {
      // IPアドレスの場合はDNS解決をスキップ
      if (host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        console.log(`✓ ${host} is direct IP address`);
      } else {
        const addresses = await dns.resolve4(host);
        console.log(`✓ ${host} resolves to:`, addresses);
      }
    } catch (error) {
      console.log(`✗ ${host} DNS error:`, error.message);
    }
  }
}

// プロキシ設定の確認
function checkProxySettings() {
  console.log('\n\n=== Proxy Settings ===\n');
  
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy'];
  
  let hasProxy = false;
  for (const varName of proxyVars) {
    if (process.env[varName]) {
      console.log(`${varName}: ${process.env[varName]}`);
      hasProxy = true;
    }
  }
  
  if (!hasProxy) {
    console.log('No proxy settings found');
  } else {
    console.log('\nNote: Proxy settings detected. This might affect connections.');
  }
}

// 実行
async function runTests() {
  checkProxySettings();
  await testDNS();
  await testMinimalQuery();
}

runTests().catch(console.error);