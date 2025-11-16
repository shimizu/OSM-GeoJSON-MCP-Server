// file-downloader.js
// ファイルダウンロード機能の共通ユーティリティ

import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import https from 'https';
import osmtogeojson from 'osmtogeojson';

/**
 * HTTPSでファイルをダウンロードする共通関数
 * @param {string} url - ダウンロード先URL
 * @param {string} query - POSTリクエストボディ
 * @param {string} outputPath - 出力ファイルパス
 * @param {Object} headers - 追加HTTPヘッダー
 * @returns {Promise<Object>} ダウンロード結果
 */
export async function downloadToFile(url, query, outputPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(query),
        'User-Agent': 'OSM-MCP/1.0',
        ...headers
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const dir = path.dirname(outputPath);
      fs.mkdir(dir, { recursive: true }).then(() => {
        const writeStream = createWriteStream(outputPath);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          // 1MBごとに進行状況を出力
          if (downloadedBytes > 0 && downloadedBytes % (1024 * 1024) === 0) {
            console.error(`Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
          }
        });

        res.pipe(writeStream);

        writeStream.on('finish', () => {
          const sizeMB = (downloadedBytes / 1024 / 1024).toFixed(2);
          resolve({ 
            success: true, 
            path: outputPath, 
            size: `${sizeMB} MB`,
            bytes: downloadedBytes 
          });
        });

        writeStream.on('error', reject);
      }).catch(reject);
    });

    req.on('error', reject);
    req.setTimeout(300000); // 5分のタイムアウト
    req.write(query);
    req.end();
  });
}

/**
 * Overpass APIクエリを実行してGeoJSONファイルとして保存する
 * @param {OverpassClient} overpassClient - Overpass APIクライアント
 * @param {string} query - Overpass QLクエリ
 * @param {string} outputPath - 出力ファイルパス
 * @returns {Promise<Object>} 実行結果
 */
export async function executeGeoJSONQuery(overpassClient, query, outputPath) {
  const servers = overpassClient.servers;
  let lastError = null;

  const tempPath = outputPath + '.tmp.osm.json';

  for (const server of servers) {
    try {
      // 1. 生データを一時ファイルにダウンロード
      const fullQuery = query.startsWith('[out:json]') ? query : `[out:json]${query}`;
      await downloadToFile(
        server.url,
        fullQuery,
        tempPath,
        { 'Host': server.host }
      );

      // 2. 一時ファイルを読み込んで変換
      const osmData = JSON.parse(await fs.readFile(tempPath, 'utf8'));
      const geojson = osmtogeojson(osmData);

      // 3. 最終的なGeoJSONファイルを書き込み
      await fs.writeFile(outputPath, JSON.stringify(geojson, null, 2));

      // 4. 一時ファイルをクリーンアップ
      await fs.unlink(tempPath);

      // 5. 統計情報を返す
      const stats = await fs.stat(outputPath);
      return {
        success: true,
        size: stats.size,
        feature_count: geojson.features.length,
        server: server.host
      };

    } catch (error) {
      lastError = error;
      console.error(`Failed with ${server.host}: ${error.message}`);
      // 失敗時も一時ファイルをクリーンアップ
      try { await fs.unlink(tempPath); } catch (e) { /* ignore */ }
    }
  }

  throw new Error(`All servers failed to process GeoJSON query: ${lastError?.message}`);
}