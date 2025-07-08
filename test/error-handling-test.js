#!/usr/bin/env node
// error-handling-test.js
// エラーハンドリング機能テスト

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

class ErrorHandlingTester {
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
      console.log(`Server: ${message}`);
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
      }, 10000);

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

  async testErrorHandling() {
    console.log('\n🔍 エラーハンドリングテスト開始');
    
    const tests = [
      {
        name: 'Invalid Arguments (null)',
        message: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'get_buildings',
            arguments: null
          }
        },
        expectedError: 'InvalidParams'
      },
      {
        name: 'Invalid Arguments (string)',
        message: {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'get_buildings',
            arguments: 'invalid'
          }
        },
        expectedError: 'InvalidParams'
      },
      {
        name: 'Missing Required Parameters',
        message: {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'get_buildings',
            arguments: {
              minLon: 139.7
              // missing required parameters
            }
          }
        },
        expectedError: 'InvalidParams'
      },
      {
        name: 'Invalid Coordinate Order',
        message: {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'get_buildings',
            arguments: {
              minLon: 139.8,
              minLat: 35.7,
              maxLon: 139.7,  // maxLon < minLon
              maxLat: 35.8
            }
          }
        },
        expectedError: 'InvalidParams'
      },
      {
        name: 'Unknown Tool',
        message: {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        },
        expectedError: 'InternalError'
      }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📤 Testing: ${test.name}`);
        
        const response = await this.sendMessage(test.message);
        
        if (response.error) {
          console.log(`✅ Expected error received: ${response.error.code} - ${response.error.message}`);
          if (response.error.data) {
            console.log(`   Data: ${JSON.stringify(response.error.data, null, 2)}`);
          }
          
          this.testResults.push({
            test: test.name,
            success: true,
            error: response.error,
            expectedError: test.expectedError
          });
        } else {
          console.log(`❌ Expected error but got success: ${JSON.stringify(response.result)}`);
          this.testResults.push({
            test: test.name,
            success: false,
            error: 'No error received',
            expectedError: test.expectedError
          });
        }
        
      } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        this.testResults.push({
          test: test.name,
          success: false,
          error: error.message,
          expectedError: test.expectedError
        });
      }
    }
  }

  analyzeResults() {
    console.log('\n📊 エラーハンドリングテスト結果');
    console.log('='.repeat(50));
    
    const successCount = this.testResults.filter(r => r.success).length;
    const totalCount = this.testResults.length;
    
    console.log(`\n✅ 成功したテスト: ${successCount}/${totalCount}`);
    console.log(`❌ 失敗したテスト: ${totalCount - successCount}/${totalCount}`);
    
    console.log('\n📋 詳細結果:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.test}`);
      if (result.error && typeof result.error === 'object') {
        console.log(`      Error Code: ${result.error.code}`);
        console.log(`      Message: ${result.error.message}`);
      }
    });
  }

  cleanup() {
    if (this.serverProcess && !this.serverProcess.killed) {
      console.log('\n🧹 サーバープロセスを終了中...');
      this.serverProcess.kill();
    }
  }
}

async function main() {
  const tester = new ErrorHandlingTester();
  
  try {
    await tester.startServer();
    await tester.testErrorHandling();
    tester.analyzeResults();
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  } finally {
    tester.cleanup();
  }
}

process.on('SIGINT', () => {
  console.log('\n\n🛑 テストを中断中...');
  process.exit(0);
});

main().catch(console.error);