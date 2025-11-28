// overpass.js
// Overpass API通信ユーティリティ

import https from 'https';
import { QueryCache } from './cache.js';
import { apiLogger } from './logger.js';

export class OverpassClient {
  constructor() {
    // Overpass APIサーバーの設定
    // IPアドレスを直接使用することで、DNS解決の問題を回避
    this.servers = [
      { 
        url: 'https://162.55.144.139/api/interpreter', 
        host: 'overpass-api.de'  // Hostヘッダーに使用
      },
      { 
        url: 'https://65.109.112.52/api/interpreter', 
        host: 'lz4.overpass-api.de' 
      },
      { 
        url: 'https://193.219.97.30/api/interpreter', 
        host: 'overpass.kumi.systems' 
      }
    ];

    // ラウンドロビンで使用するサーバーのインデックス
    this.currentServerIndex = 0;
    
    // キャッシュ機能を初期化
    this.cache = new QueryCache({
      maxSize: 100,
      ttl: 15 * 60 * 1000,  // 15分のTTL
      cleanupInterval: 5 * 60 * 1000  // 5分ごとのクリーンアップ
    });
  }

  // HTTPSリクエストをPromiseでラップした実装
  // Node.jsの標準httpsモジュールを使用してOverpass APIと通信
  httpsRequest(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',  // Overpass APIはプレーンテキストのクエリを受け付ける
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'OSM-MCP/1.0',
          ...headers  // 追加のヘッダー（主にHostヘッダー）
        },
        rejectUnauthorized: false,  // 証明書検証を無効化（IPアドレス直接アクセスのため）
        timeout: 60000  // 60秒のタイムアウト
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        // レスポンスデータを蓄積
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        // レスポンス完了時の処理
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(responseData);
              resolve(parsed);
            } catch (e) {
              reject(new Error(`Failed to parse response: ${e.message}`));
            }
          } else {
            // エラーレスポンスの場合
            reject(new Error(`HTTP ${res.statusCode}: ${responseData.substring(0, 200)}`));
          }
        });
      });

      // エラーハンドリング
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(60000);
      req.write(data);  // クエリデータを送信
      req.end();
    });
  }

  // Overpass APIへのクエリ実行
  // 複数のサーバーを順番に試し、成功するまで繰り返す
  async query(queryString, bypassCache = false, toolName = 'unknown') {
    // キャッシュから取得を試行
    if (!bypassCache) {
      const cachedResult = this.cache.get(queryString);
      if (cachedResult) {
        apiLogger.logCacheHit(toolName, queryString);
        return cachedResult;
      } else {
        apiLogger.logCacheMiss(toolName, queryString);
      }
    }
    
    let lastError = null;
    let requestInfo = null;
    
    // 現在のサーバーから順番に試す（ラウンドロビン）
    for (let i = 0; i < this.servers.length; i++) {
      const serverIndex = (this.currentServerIndex + i) % this.servers.length;
      const server = this.servers[serverIndex];
      
      try {
        requestInfo = apiLogger.logRequestStart(toolName, queryString, server.host);
        
        console.error(`Querying ${server.host}...`);
        const response = await this.httpsRequest(
          server.url,
          queryString,
          { 'Host': server.host }  // 正しいHostヘッダーを設定（証明書検証のため）
        );
        
        // 成功したサーバーを記憶（次回はこのサーバーから開始）
        this.currentServerIndex = serverIndex;
        
        // 結果をキャッシュ
        if (!bypassCache) {
          this.cache.set(queryString, response);
        }
        
        // 成功ログ
        const responseSize = JSON.stringify(response).length;
        apiLogger.logRequestComplete(requestInfo, true, responseSize);
        
        return response;
      } catch (error) {
        lastError = error;
        apiLogger.logError(error, server.host, toolName);
        
        // 失敗ログ
        if (requestInfo) {
          apiLogger.logRequestComplete(requestInfo, false, 0);
        }
        
        console.error(`Failed with ${server.host}: ${error.message}`);
        
        // レート制限（429エラー）の場合は少し待つ
        if (error.message.includes('429')) {
          const backoffTime = Math.min(5000 * Math.pow(2, i), 30000);  // 指数バックオフ（最大30秒）
          console.error(`Rate limited, waiting ${backoffTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
        // 5xx系エラーの場合は短時間待機
        else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
          console.error(`Server error, waiting 2s before retry`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    throw new Error(`All servers failed. Last error: ${lastError?.message}`);
  }

  // 接続テスト
  async testConnection() {
    const results = [];
    const testQuery = '[out:json];out count;';  // 最小限のテストクエリ
    
    for (const server of this.servers) {
      try {
        const response = await this.httpsRequest(
          server.url,
          testQuery,
          { 'Host': server.host }
        );
        
        results.push(`✓ ${server.host} - 接続成功！`);
      } catch (error) {
        results.push(`✗ ${server.host} - エラー: ${error.message}`);
      }
    }
    
    return results;
  }

  // キャッシュ統計情報を取得
  getCacheStats() {
    return this.cache.getStats();
  }

  // API使用統計情報を取得
  getApiStats() {
    return apiLogger.getStats();
  }

  // 詳細統計を出力
  printStats() {
    apiLogger.printDetailedStats();
  }

  // キャッシュをクリア
  clearCache() {
    this.cache.clear();
  }

  // クリーンアップ（メモリリークを防ぐため）
  destroy() {
    this.cache.destroy();
  }

}