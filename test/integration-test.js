#!/usr/bin/env node
// integration-test.js
// Phase 5: 統合テストと検証 - 実際の使用シナリオでの動作確認

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

class IntegrationTester {
  constructor() {
    this.serverProcess = null;
    this.testResults = [];
  }

  async startServer() {
    console.log('🚀 MCPサーバーを起動中...');
    
    this.serverProcess = spawn('node', ['src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.serverProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (!message.includes('MCP server initialized and ready')) {
        console.log(`Server: ${message}`);
      }
    });

    await sleep(2000);
    
    if (this.serverProcess.killed) {
      throw new Error('サーバーの起動に失敗しました');
    }
    
    console.log('✅ MCPサーバーが起動しました');
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      
      let response = '';
      const timeoutId = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 30000); // 30秒のタイムアウト

      const onData = (data) => {
        response += data.toString();
        try {
          const lines = response.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            const parsed = JSON.parse(lines[lines.length - 1]);
            clearTimeout(timeoutId);
            this.serverProcess.stdout.removeListener('data', onData);
            resolve(parsed);
          }
        } catch (e) {
          // まだ完全なJSONではない場合は継続
        }
      };

      this.serverProcess.stdout.on('data', onData);
      this.serverProcess.stdin.write(messageStr);
    });
  }

  async runIntegrationTests() {
    console.log('\n🔍 Phase 5: 統合テストと検証開始');
    console.log('実際の使用シナリオでの動作確認を実施します');
    
    // 1. 初期化シーケンスのテスト
    await this.testInitializationSequence();
    
    // 2. 実際のデータ取得テスト
    await this.testRealDataRetrieval();
    
    // 3. エラーハンドリングの統合テスト
    await this.testIntegratedErrorHandling();
    
    // 4. パフォーマンステスト
    await this.testPerformance();
    
    // 5. ツール機能の包括テスト
    await this.testAllTools();
  }

  async testInitializationSequence() {
    console.log('\n📋 1. 初期化シーケンステスト');
    
    try {
      // Initialize
      const initResponse = await this.sendMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'integration-tester', version: '1.0.0' }
        }
      });
      
      console.log('✅ Initialize成功');
      
      // Initialized notification
      const messageStr = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialized',
        params: {}
      }) + '\n';
      this.serverProcess.stdin.write(messageStr);
      
      console.log('✅ Initialized notification送信成功');
      
      // Tools list
      const toolsResponse = await this.sendMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });
      
      const toolCount = toolsResponse.result.tools.length;
      console.log(`✅ ツールリスト取得成功: ${toolCount}個のツール`);
      
      this.testResults.push({
        category: 'Initialization',
        test: 'Full initialization sequence',
        success: true,
        details: `${toolCount} tools available`
      });
      
    } catch (error) {
      console.log(`❌ 初期化エラー: ${error.message}`);
      this.testResults.push({
        category: 'Initialization',
        test: 'Full initialization sequence',
        success: false,
        error: error.message
      });
    }
  }

  async testRealDataRetrieval() {
    console.log('\n🌍 2. 実際のデータ取得テスト');
    
    // 小さな範囲でテスト（東京駅周辺の狭いエリア）
    const tokyoStationArea = {
      minLon: 139.765,
      minLat: 35.680,
      maxLon: 139.770,
      maxLat: 35.685
    };
    
    const dataTests = [
      { name: 'get_buildings', args: { ...tokyoStationArea, limit: 10 } },
      { name: 'get_roads', args: { ...tokyoStationArea, limit: 10 } },
      { name: 'get_amenities', args: { ...tokyoStationArea, limit: 10 } },
      { name: 'test_connection', args: {} }
    ];
    
    for (const test of dataTests) {
      try {
        console.log(`  📤 Testing: ${test.name}`);
        
        const response = await this.sendMessage({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: test.name,
            arguments: test.args
          }
        });
        
        if (response.result && response.result.content) {
          const content = JSON.parse(response.result.content[0].text);
          if (test.name === 'test_connection') {
            console.log(`  ✅ ${test.name}: 接続テスト成功`);
          } else if (content.data && content.data.features) {
            console.log(`  ✅ ${test.name}: ${content.data.features.length}件のデータ取得成功`);
          } else {
            console.log(`  ✅ ${test.name}: レスポンス形式正常`);
          }
          
          this.testResults.push({
            category: 'Data Retrieval',
            test: test.name,
            success: true,
            details: content.summary || 'Response received'
          });
        } else {
          throw new Error('Invalid response format');
        }
        
      } catch (error) {
        console.log(`  ❌ ${test.name}: ${error.message}`);
        this.testResults.push({
          category: 'Data Retrieval',
          test: test.name,
          success: false,
          error: error.message
        });
      }
    }
  }

  async testIntegratedErrorHandling() {
    console.log('\n⚠️  3. エラーハンドリング統合テスト');
    
    const errorTests = [
      {
        name: 'Invalid tool name',
        params: { name: 'nonexistent_tool', arguments: {} },
        expectedCode: -32603
      },
      {
        name: 'Invalid coordinates',
        params: { 
          name: 'get_buildings', 
          arguments: { minLon: 180, minLat: 90, maxLon: -180, maxLat: -90 }
        },
        expectedCode: -32603
      }
    ];
    
    for (const test of errorTests) {
      try {
        console.log(`  📤 Testing: ${test.name}`);
        
        const response = await this.sendMessage({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: test.params
        });
        
        if (response.error && response.error.code === test.expectedCode) {
          console.log(`  ✅ ${test.name}: 期待通りのエラー (${response.error.code})`);
          this.testResults.push({
            category: 'Error Handling',
            test: test.name,
            success: true,
            details: `Error code: ${response.error.code}`
          });
        } else {
          throw new Error(`Expected error ${test.expectedCode}, got success or different error`);
        }
        
      } catch (error) {
        console.log(`  ❌ ${test.name}: ${error.message}`);
        this.testResults.push({
          category: 'Error Handling',
          test: test.name,
          success: false,
          error: error.message
        });
      }
    }
  }

  async testPerformance() {
    console.log('\n⚡ 4. パフォーマンステスト');
    
    try {
      const startTime = Date.now();
      
      // 複数のリクエストを並行実行
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(this.sendMessage({
          jsonrpc: '2.0',
          id: Date.now() + i,
          method: 'tools/call',
          params: {
            name: 'test_connection',
            arguments: {}
          }
        }));
      }
      
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const successCount = responses.filter(r => r.result).length;
      console.log(`  ✅ 並行処理テスト: ${successCount}/3成功, ${duration}ms`);
      
      this.testResults.push({
        category: 'Performance',
        test: 'Concurrent requests',
        success: successCount === 3,
        details: `${successCount}/3 requests, ${duration}ms`
      });
      
    } catch (error) {
      console.log(`  ❌ パフォーマンステスト: ${error.message}`);
      this.testResults.push({
        category: 'Performance',
        test: 'Concurrent requests',
        success: false,
        error: error.message
      });
    }
  }

  async testAllTools() {
    console.log('\n🛠️  5. 全ツール機能テスト');
    
    const allTools = [
      'get_buildings',
      'get_roads', 
      'get_amenities',
      'get_waterways',
      'get_green_spaces',
      'get_railways',
      'test_connection',
      'get_api_stats'
    ];
    
    const testArea = {
      minLon: 139.765,
      minLat: 35.680,
      maxLon: 139.770,
      maxLat: 35.685,
      limit: 5
    };
    
    let successCount = 0;
    
    for (const toolName of allTools) {
      try {
        const args = toolName === 'test_connection' || toolName === 'get_api_stats' 
          ? {} 
          : testArea;
          
        const response = await this.sendMessage({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        });
        
        if (response.result) {
          console.log(`  ✅ ${toolName}: 正常動作`);
          successCount++;
        } else {
          console.log(`  ❌ ${toolName}: エラー応答`);
        }
        
      } catch (error) {
        console.log(`  ❌ ${toolName}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 全ツールテスト結果: ${successCount}/${allTools.length}成功`);
    
    this.testResults.push({
      category: 'Tool Coverage',
      test: 'All tools functional test',
      success: successCount === allTools.length,
      details: `${successCount}/${allTools.length} tools working`
    });
  }

  generateReport() {
    console.log('\n📊 Phase 5 統合テスト結果レポート');
    console.log('='.repeat(60));
    
    const categories = [...new Set(this.testResults.map(r => r.category))];
    let totalSuccess = 0;
    let totalTests = 0;
    
    categories.forEach(category => {
      const categoryTests = this.testResults.filter(r => r.category === category);
      const categorySuccess = categoryTests.filter(r => r.success).length;
      
      console.log(`\n🏷️  ${category}`);
      console.log(`   成功: ${categorySuccess}/${categoryTests.length}`);
      
      categoryTests.forEach(test => {
        const status = test.success ? '✅' : '❌';
        console.log(`   ${status} ${test.test}`);
        if (test.details) console.log(`      詳細: ${test.details}`);
        if (test.error) console.log(`      エラー: ${test.error}`);
      });
      
      totalSuccess += categorySuccess;
      totalTests += categoryTests.length;
    });
    
    console.log('\n🎯 総合結果');
    console.log(`   成功率: ${totalSuccess}/${totalTests} (${Math.round(totalSuccess/totalTests*100)}%)`);
    
    return {
      totalSuccess,
      totalTests,
      successRate: Math.round(totalSuccess/totalTests*100),
      details: this.testResults
    };
  }

  cleanup() {
    if (this.serverProcess && !this.serverProcess.killed) {
      console.log('\n🧹 サーバープロセスを終了中...');
      this.serverProcess.kill();
    }
  }
}

async function main() {
  const tester = new IntegrationTester();
  
  try {
    await tester.startServer();
    await tester.runIntegrationTests();
    const report = tester.generateReport();
    
    // 結果の評価
    if (report.successRate >= 90) {
      console.log('\n🎉 統合テスト成功！MCPプロトコル準拠の実装が完了しました。');
      process.exit(0);
    } else {
      console.log('\n⚠️  統合テストで問題が検出されました。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 統合テスト実行エラー:', error.message);
    process.exit(1);
  } finally {
    tester.cleanup();
  }
}

process.on('SIGINT', () => {
  console.log('\n\n🛑 統合テストを中断中...');
  process.exit(0);
});

main().catch(console.error);