#!/usr/bin/env node

// 統合テストランナー - 全てのテストを順次実行
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// テスト設定
const tests = [
  {
    name: 'Network Connectivity',
    description: 'Basic network and DNS connectivity tests',
    script: 'simple-test.js',
    timeout: 30000,
    critical: true
  },
  {
    name: 'Network Diagnostics',
    description: 'Detailed network diagnostic and server connectivity',
    script: 'network-diagnostic.js',
    timeout: 45000,
    critical: false
  },
  {
    name: 'New Features Test',
    description: 'Cache, logging, and statistics functionality',
    script: 'test-new-features.js',
    timeout: 60000,
    critical: true
  },
  {
    name: 'Download Functionality',
    description: 'File download and conversion features',
    script: 'test-download.js',
    timeout: 30000,
    critical: false
  },
  {
    name: 'Direct Download Test',
    description: 'Direct file output for all tools',
    script: 'test-direct-download.js',
    timeout: 45000,
    critical: false
  },
  {
    name: 'Limit Functionality Test',
    description: 'Test limit parameter functionality across all tools',
    script: 'test-limit-functionality.js',
    timeout: 45000,
    critical: true
  }
];

// カラー出力用の関数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// テスト結果の集計
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

// 個別テストの実行
async function runTest(test) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, test.script);
    
    console.log(`\n${'='.repeat(60)}`);
    colorLog('cyan', `🧪 Running: ${test.name}`);
    colorLog('blue', `📝 ${test.description}`);
    colorLog('yellow', `⏱️  Timeout: ${test.timeout / 1000}s`);
    console.log(`${'='.repeat(60)}\n`);
    
    const startTime = Date.now();
    
    // Node.js プロセスとしてテストを実行
    const testProcess = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: path.dirname(__dirname) // プロジェクトルートディレクトリ
    });
    
    let completed = false;
    
    // タイムアウトハンドラー
    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        colorLog('yellow', `⚠️  Test timed out after ${test.timeout / 1000}s`);
        testProcess.kill('SIGTERM');
        
        setTimeout(() => {
          if (testProcess.pid) {
            testProcess.kill('SIGKILL');
          }
        }, 5000);
        
        resolve({
          success: false,
          duration: Date.now() - startTime,
          error: 'Timeout',
          skipped: false
        });
      }
    }, test.timeout);
    
    // プロセス終了ハンドラー
    testProcess.on('close', (code) => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        const success = code === 0;
        
        if (success) {
          colorLog('green', `✅ Test completed successfully in ${(duration / 1000).toFixed(1)}s`);
        } else {
          colorLog('red', `❌ Test failed with exit code ${code} after ${(duration / 1000).toFixed(1)}s`);
        }
        
        resolve({
          success,
          duration,
          error: success ? null : `Exit code ${code}`,
          skipped: false
        });
      }
    });
    
    // プロセスエラーハンドラー
    testProcess.on('error', (error) => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        colorLog('red', `❌ Test failed to start: ${error.message}`);
        
        resolve({
          success: false,
          duration: Date.now() - startTime,
          error: error.message,
          skipped: false
        });
      }
    });
  });
}

// テスト前の準備
async function setupTests() {
  colorLog('magenta', '🔧 Setting up test environment...');
  
  // テスト用ディレクトリをクリーンアップ/作成
  const testDirs = ['./test-output', './test-data', './test-downloads', './test-features'];
  
  for (const dir of testDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.mkdir(dir, { recursive: true });
      console.log(`  ✓ Cleaned and created ${dir}`);
    } catch (error) {
      console.log(`  ⚠️  Could not setup ${dir}: ${error.message}`);
    }
  }
  
  console.log();
}

// テスト後のクリーンアップ
async function cleanupTests() {
  colorLog('magenta', '🧹 Cleaning up test environment...');
  
  // 空のテストディレクトリを削除
  const testDirs = ['./test-output', './test-data', './test-downloads', './test-features'];
  
  for (const dir of testDirs) {
    try {
      const files = await fs.readdir(dir);
      if (files.length === 0) {
        await fs.rmdir(dir);
        console.log(`  ✓ Removed empty directory ${dir}`);
      } else {
        console.log(`  📁 Kept ${dir} (${files.length} files)`);
      }
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  }
  
  console.log();
}

// 最終レポートの表示
function showFinalReport() {
  console.log(`\n${'='.repeat(60)}`);
  colorLog('bright', '📊 TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  console.log(`Total tests: ${testResults.total}`);
  colorLog('green', `Passed: ${testResults.passed}`);
  colorLog('red', `Failed: ${testResults.failed}`);
  colorLog('yellow', `Skipped: ${testResults.skipped}`);
  
  const successRate = testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0;
  console.log(`Success rate: ${successRate}%`);
  
  console.log(`\n📋 Detailed Results:`);
  testResults.details.forEach((result, index) => {
    const test = tests[index];
    const status = result.skipped ? '⏭️  SKIPPED' : (result.success ? '✅ PASSED' : '❌ FAILED');
    const duration = `(${(result.duration / 1000).toFixed(1)}s)`;
    
    console.log(`  ${status} ${test.name} ${duration}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  // 総合結果
  console.log(`\n${'='.repeat(60)}`);
  if (testResults.failed === 0) {
    colorLog('green', '🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
  } else {
    const criticalFailed = testResults.details.some((result, index) => 
      !result.success && tests[index].critical
    );
    
    if (criticalFailed) {
      colorLog('red', '💥 CRITICAL TESTS FAILED - System may not be working properly');
    } else {
      colorLog('yellow', '⚠️  Some non-critical tests failed - System should still be functional');
    }
  }
  console.log(`${'='.repeat(60)}\n`);
}

// メイン実行関数
async function runAllTests() {
  const startTime = Date.now();
  
  console.log('🚀 OSM GeoJSON MCP Server - Test Suite');
  console.log('==========================================\n');
  
  await setupTests();
  
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  const skipNonCritical = args.includes('--critical-only');
  const verboseMode = args.includes('--verbose');
  
  if (skipNonCritical) {
    colorLog('yellow', '⚡ Running critical tests only');
  }
  
  // 各テストを順次実行
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    testResults.total++;
    
    // 非クリティカルテストをスキップする場合
    if (skipNonCritical && !test.critical) {
      colorLog('yellow', `⏭️  Skipping non-critical test: ${test.name}`);
      testResults.skipped++;
      testResults.details.push({
        success: false,
        duration: 0,
        error: null,
        skipped: true
      });
      continue;
    }
    
    const result = await runTest(test);
    testResults.details.push(result);
    
    if (result.success) {
      testResults.passed++;
    } else {
      testResults.failed++;
      
      // クリティカルテストが失敗した場合の早期終了オプション
      if (test.critical && args.includes('--fail-fast')) {
        colorLog('red', '\n💥 Critical test failed - stopping execution (--fail-fast mode)');
        break;
      }
    }
    
    // テスト間に短い待機時間を設ける
    if (i < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await cleanupTests();
  
  const totalDuration = Date.now() - startTime;
  console.log(`\n⏱️  Total execution time: ${(totalDuration / 1000).toFixed(1)}s`);
  
  showFinalReport();
  
  // 終了コードの設定
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  colorLog('red', `💥 Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  colorLog('red', `💥 Unhandled rejection: ${reason}`);
  process.exit(1);
});

// SIGINT (Ctrl+C) ハンドリング
process.on('SIGINT', () => {
  colorLog('yellow', '\n🛑 Test execution interrupted by user');
  process.exit(130);
});

// ヘルプメッセージ
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧪 OSM GeoJSON MCP Server Test Suite

Usage: node test/index.js [options]

Options:
  --critical-only    Run only critical tests
  --fail-fast        Stop execution on first critical test failure  
  --verbose          Enable verbose output
  --help, -h         Show this help message

Test Categories:
  Critical:   Essential functionality tests (connectivity, core features)
  Standard:   Additional validation tests (downloads, diagnostics)

Exit Codes:
  0: All tests passed
  1: One or more tests failed
  130: Interrupted by user (Ctrl+C)
`);
  process.exit(0);
}

// 実行開始
runAllTests().catch((error) => {
  colorLog('red', `💥 Test suite failed to start: ${error.message}`);
  process.exit(1);
});