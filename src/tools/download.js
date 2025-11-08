import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import https from 'https';
import osmtogeojson from 'osmtogeojson';

export const downloadOSMDataSchema = {
  name: 'download_osm_data',
  description: 'OpenStreetMapデータをダウンロードしてファイルに保存します。大きなデータも扱えます。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Overpass QLクエリ'
      },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス（例: ./data/tokyo_buildings.geojson）'
      },
      format: {
        type: 'string',
        enum: ['json', 'xml'],
        default: 'json',
        description: '出力形式'
      }
    },
    required: ['query', 'output_path']
  }
};

export const downloadAreaBuildingsSchema = {
  name: 'download_area_buildings',
  description: '指定エリアの建物データをダウンロード（簡易版）',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat', 'output_path']
  }
};

export const downloadAreaAllSchema = {
  name: 'download_area_all',
  description: '指定エリアの全データをダウンロード（建物、道路、POIなど）',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat', 'output_path']
  }
};

// ファイルにダウンロードする共通関数
async function downloadToFile(url, query, outputPath, headers = {}) {
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

// GeoJSONクエリを実行してファイル出力する関数
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

export async function downloadOSMData(overpassClient, args) {
  const { query, output_path, format = 'json' } = args;
  
  const fullQuery = format === 'json' ? 
    (query.startsWith('[out:json]') ? query : `[out:json];${query}`) :
    (query.startsWith('[out:xml]') ? query : `[out:xml];${query}`);
  
  console.error(`Downloading OSM data to ${output_path}...`);
  
  const servers = overpassClient.servers;
  let lastError = null;
  
  for (const server of servers) {
    try {
      const result = await downloadToFile(
        server.url,
        fullQuery,
        output_path,
        { 'Host': server.host }
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: `データをダウンロードしました`,
            file: output_path,
            size: result.size,
            server: server.host
          }, null, 2)
        }]
      };
    } catch (error) {
      lastError = error;
      console.error(`Failed with ${server.host}: ${error.message}`);
    }
  }
  
  throw new Error(`All servers failed: ${lastError?.message}`);
}

export async function downloadAreaBuildings(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, output_path } = args;
  
  const query = `[out:json][timeout:180];
(
  way["building"](${minLat},${minLon},${maxLat},${maxLon});
  relation["building"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  
  return await downloadOSMData(overpassClient, { query, output_path, format: 'json' });
}

export async function downloadAreaAll(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, output_path } = args;
  
  const query = `[out:json][timeout:300];
(
  node(${minLat},${minLon},${maxLat},${maxLon});
  way(${minLat},${minLon},${maxLat},${maxLon});
  relation(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  
  return await downloadOSMData(overpassClient, { query, output_path, format: 'json' });
}