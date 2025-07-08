#!/usr/bin/env node
// mcp-protocol-verification.js
// MCPプロトコル検証スクリプト

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

class MCPProtocolTester {
  constructor() {
    this.serverProcess = null;
    this.responses = [];
    this.errors = [];
  }

  // MCPサーバーを起動
  async startServer() {
    console.log('🚀 MCPサーバーを起動中...');
    
    this.serverProcess = spawn('node', ['src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // エラー出力を監視
    this.serverProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`Server: ${message}`);
    });

    // サーバーの起動を待機
    await sleep(2000);
    
    if (this.serverProcess.killed) {
      throw new Error('サーバーの起動に失敗しました');
    }
    
    console.log('✅ MCPサーバーが起動しました');
  }

  // JSON-RPCメッセージを送信
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      
      let response = '';
      const timeoutId = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

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

  // 各種MCPプロトコルメッセージをテスト
  async testProtocolMessages() {
    console.log('\n🔍 MCPプロトコルメッセージのテスト開始');
    
    const tests = [
      {
        name: 'Ping Request',
        message: {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
          params: {}
        }
      },
      {
        name: 'Initialize Request',
        message: {
          jsonrpc: '2.0',
          id: 2,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'protocol-tester',
              version: '1.0.0'
            }
          }
        }
      },
      {
        name: 'Initialized Notification',
        message: {
          jsonrpc: '2.0',
          method: 'initialized',
          params: {}
        },
        isNotification: true
      },
      {
        name: 'List Tools Request',
        message: {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/list',
          params: {}
        }
      },
      {
        name: 'Call Tool Request',
        message: {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'test_connection',
            arguments: {}
          }
        }
      }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📤 Testing: ${test.name}`);
        console.log(`   Message: ${JSON.stringify(test.message, null, 2)}`);
        
        if (test.isNotification) {
          // 通知の場合は応答を期待しない
          const messageStr = JSON.stringify(test.message) + '\n';
          this.serverProcess.stdin.write(messageStr);
          console.log(`✅ Notification sent successfully`);
          
          this.responses.push({
            test: test.name,
            request: test.message,
            response: 'notification sent',
            success: true
          });
        } else {
          const response = await this.sendMessage(test.message);
          console.log(`✅ Response: ${JSON.stringify(response, null, 2)}`);
          
          this.responses.push({
            test: test.name,
            request: test.message,
            response: response,
            success: true
          });
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        this.errors.push({
          test: test.name,
          request: test.message,
          error: error.message,
          success: false
        });
      }
    }
  }

  // テスト結果の分析
  analyzeResults() {
    console.log('\n📊 テスト結果の分析');
    console.log('='.repeat(50));
    
    console.log(`\n✅ 成功したテスト: ${this.responses.length}件`);
    this.responses.forEach(result => {
      console.log(`   - ${result.test}`);
    });
    
    console.log(`\n❌ 失敗したテスト: ${this.errors.length}件`);
    this.errors.forEach(error => {
      console.log(`   - ${error.test}: ${error.error}`);
    });

    console.log('\n🔍 MCPプロトコル準拠状況:');
    
    // 必須ハンドラーのチェック
    const requiredHandlers = ['ping', 'initialize', 'initialized'];
    const supportedHandlers = this.responses.map(r => r.request.method);
    
    requiredHandlers.forEach(handler => {
      const supported = supportedHandlers.includes(handler);
      console.log(`   - ${handler}: ${supported ? '✅ サポート済み' : '❌ 未サポート'}`);
    });

    // エラーパターンの分析
    const methodNotFoundErrors = this.errors.filter(e => 
      e.error.includes('Method not found') || e.error.includes('-32601')
    );
    
    if (methodNotFoundErrors.length > 0) {
      console.log('\n⚠️  Method not found エラーが発生したメソッド:');
      methodNotFoundErrors.forEach(error => {
        console.log(`   - ${error.request.method}`);
      });
    }
  }

  // クリーンアップ
  cleanup() {
    if (this.serverProcess && !this.serverProcess.killed) {
      console.log('\n🧹 サーバープロセスを終了中...');
      this.serverProcess.kill();
    }
  }
}

// メイン実行
async function main() {
  const tester = new MCPProtocolTester();
  
  try {
    await tester.startServer();
    await tester.testProtocolMessages();
    tester.analyzeResults();
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  } finally {
    tester.cleanup();
  }
}

// Ctrl+Cでのクリーンアップ
process.on('SIGINT', () => {
  console.log('\n\n🛑 テストを中断中...');
  process.exit(0);
});

main().catch(console.error);