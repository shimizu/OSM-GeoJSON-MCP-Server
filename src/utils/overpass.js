// overpass.js
// Overpass API通信ユーティリティ

import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';

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
  async query(queryString) {
    let lastError = null;
    
    // 現在のサーバーから順番に試す（ラウンドロビン）
    for (let i = 0; i < this.servers.length; i++) {
      const serverIndex = (this.currentServerIndex + i) % this.servers.length;
      const server = this.servers[serverIndex];
      
      try {
        console.error(`Querying ${server.host}...`);
        const response = await this.httpsRequest(
          server.url,
          queryString,
          { 'Host': server.host }  // 正しいHostヘッダーを設定（証明書検証のため）
        );
        
        // 成功したサーバーを記憶（次回はこのサーバーから開始）
        this.currentServerIndex = serverIndex;
        
        return response;
      } catch (error) {
        lastError = error;
        console.error(`Failed with ${server.host}: ${error.message}`);
        
        // レート制限（429エラー）の場合は少し待つ
        if (error.message.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 5000));
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

  // ファイルへの直接ダウンロード機能
  async queryToFile(queryString, outputPath) {
    return new Promise(async (resolve, reject) => {
      let lastError = null;
      
      // ディレクトリを作成
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });
      
      // 現在のサーバーから順番に試す
      for (let i = 0; i < this.servers.length; i++) {
        const serverIndex = (this.currentServerIndex + i) % this.servers.length;
        const server = this.servers[serverIndex];
        
        try {
          console.error(`Downloading from ${server.host} to ${outputPath}...`);
          
          const urlObj = new URL(server.url);
          const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
              'Content-Length': Buffer.byteLength(queryString),
              'User-Agent': 'OSM-MCP/1.0',
              'Host': server.host
            },
            rejectUnauthorized: false,
            timeout: 300000  // 5分のタイムアウト
          };
          
          const result = await new Promise((resolveReq, rejectReq) => {
            const req = https.request(options, (res) => {
              if (res.statusCode !== 200) {
                rejectReq(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                return;
              }
              
              const writeStream = createWriteStream(outputPath);
              let downloadedBytes = 0;
              
              res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (downloadedBytes % (1024 * 1024) === 0) {
                  console.error(`Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
                }
              });
              
              res.pipe(writeStream);
              
              writeStream.on('finish', () => {
                const sizeMB = (downloadedBytes / 1024 / 1024).toFixed(2);
                resolveReq({
                  success: true,
                  path: outputPath,
                  size: `${sizeMB} MB`,
                  bytes: downloadedBytes,
                  server: server.host
                });
              });
              
              writeStream.on('error', rejectReq);
            });
            
            req.on('error', rejectReq);
            req.setTimeout(300000);
            req.write(queryString);
            req.end();
          });
          
          // 成功したサーバーを記憶
          this.currentServerIndex = serverIndex;
          resolve(result);
          return;
          
        } catch (error) {
          lastError = error;
          console.error(`Failed with ${server.host}: ${error.message}`);
          
          // レート制限の場合は少し待つ
          if (error.message.includes('429')) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
      
      reject(new Error(`All servers failed. Last error: ${lastError?.message}`));
    });
  }
}