#!/usr/bin/env node

// osm-download-mcp.js
// OpenStreetMapデータをファイルにダウンロードするMCPサーバー
// レスポンスをトークン化せず、直接ファイルに保存します

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';

class OSMDownloadServer {
  constructor() {
    this.server = new Server(
      {
        name: 'osm-download-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Overpass APIサーバー設定
    this.servers = [
      { url: 'https://162.55.144.139/api/interpreter', host: 'overpass-api.de' },
      { url: 'https://65.109.112.52/api/interpreter', host: 'lz4.overpass-api.de' },
      { url: 'https://193.219.97.30/api/interpreter', host: 'overpass.kumi.systems' }
    ];

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
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
                description: '保存先ファイルパス（例: ./data/tokyo_buildings.json）'
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
        },
        {
          name: 'download_area_buildings',
          description: '指定エリアの建物データをダウンロード（簡易版）',
          inputSchema: {
            type: 'object',
            properties: {
              minLon: { type: 'number' },
              minLat: { type: 'number' },
              maxLon: { type: 'number' },
              maxLat: { type: 'number' },
              output_path: {
                type: 'string',
                description: '保存先ファイルパス'
              }
            },
            required: ['minLon', 'minLat', 'maxLon', 'maxLat', 'output_path']
          }
        },
        {
          name: 'download_area_all',
          description: '指定エリアの全データをダウンロード（建物、道路、POIなど）',
          inputSchema: {
            type: 'object',
            properties: {
              minLon: { type: 'number' },
              minLat: { type: 'number' },
              maxLon: { type: 'number' },
              maxLat: { type: 'number' },
              output_path: {
                type: 'string',
                description: '保存先ファイルパス'
              }
            },
            required: ['minLon', 'minLat', 'maxLon', 'maxLat', 'output_path']
          }
        },
        {
          name: 'convert_to_geojson',
          description: 'ダウンロード済みのOSMファイルをGeoJSONに変換',
          inputSchema: {
            type: 'object',
            properties: {
              input_path: {
                type: 'string',
                description: 'OSMデータファイルのパス'
              },
              output_path: {
                type: 'string',
                description: 'GeoJSON出力ファイルのパス'
              }
            },
            required: ['input_path', 'output_path']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'download_osm_data':
          return await this.downloadOSMData(args);
        case 'download_area_buildings':
          return await this.downloadAreaBuildings(args);
        case 'download_area_all':
          return await this.downloadAreaAll(args);
        case 'convert_to_geojson':
          return await this.convertToGeoJSON(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  // ストリーミングでファイルにダウンロード
  async downloadToFile(url, query, outputPath, headers = {}) {
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
          'User-Agent': 'OSM-Download-MCP/1.0',
          ...headers
        },
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        // ディレクトリを作成
        const dir = path.dirname(outputPath);
        fs.mkdir(dir, { recursive: true }).then(() => {
          const writeStream = createWriteStream(outputPath);
          let downloadedBytes = 0;

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (downloadedBytes % (1024 * 1024) === 0) { // 1MBごとに進捗報告
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

  async downloadOSMData(args) {
    const { query, output_path, format = 'json' } = args;
    
    // クエリの先頭に出力形式を追加
    const fullQuery = format === 'json' ? 
      (query.startsWith('[out:json]') ? query : `[out:json];${query}`) :
      (query.startsWith('[out:xml]') ? query : `[out:xml];${query}`);
    
    console.error(`Downloading OSM data to ${output_path}...`);
    
    // サーバーを順番に試す
    let lastError = null;
    for (const server of this.servers) {
      try {
        const result = await this.downloadToFile(
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

  async downloadAreaBuildings(args) {
    const { minLon, minLat, maxLon, maxLat, output_path } = args;
    
    const query = `[out:json][timeout:180];
(
  way["building"](${minLat},${minLon},${maxLat},${maxLon});
  relation["building"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
    
    return await this.downloadOSMData({ query, output_path, format: 'json' });
  }

  async downloadAreaAll(args) {
    const { minLon, minLat, maxLon, maxLat, output_path } = args;
    
    // すべてのデータを取得する包括的なクエリ
    const query = `[out:json][timeout:300];
(
  node(${minLat},${minLon},${maxLat},${maxLon});
  way(${minLat},${minLon},${maxLat},${maxLon});
  relation(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
    
    return await this.downloadOSMData({ query, output_path, format: 'json' });
  }

  async convertToGeoJSON(args) {
    const { input_path, output_path } = args;
    
    try {
      // ファイルを読み込み
      const data = await fs.readFile(input_path, 'utf8');
      const osmData = JSON.parse(data);
      
      // GeoJSONに変換
      const geojson = this.osmToGeoJSON(osmData);
      
      // ファイルに保存
      await fs.mkdir(path.dirname(output_path), { recursive: true });
      await fs.writeFile(output_path, JSON.stringify(geojson, null, 2));
      
      const stats = await fs.stat(output_path);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: 'GeoJSONに変換しました',
            input_file: input_path,
            output_file: output_path,
            size: `${sizeMB} MB`,
            feature_count: geojson.features.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            message: error.message
          }, null, 2)
        }]
      };
    }
  }

  // OSMデータをGeoJSONに変換（前のコードと同じ）
  osmToGeoJSON(osmData) {
    const features = [];
    const nodes = {};
    
    if (!osmData.elements) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // ノードを収集
    osmData.elements.forEach(element => {
      if (element.type === 'node') {
        nodes[element.id] = [element.lon, element.lat];
      }
    });
    
    // フィーチャーを作成
    osmData.elements.forEach(element => {
      let geometry = null;
      
      switch (element.type) {
        case 'node':
          if (element.lon !== undefined && element.lat !== undefined) {
            geometry = {
              type: 'Point',
              coordinates: [element.lon, element.lat]
            };
          }
          break;
          
        case 'way':
          if (element.nodes && element.nodes.length > 0) {
            const coordinates = element.nodes
              .map(nodeId => nodes[nodeId])
              .filter(coord => coord !== undefined);
            
            if (coordinates.length > 0) {
              const isClosed = element.nodes[0] === element.nodes[element.nodes.length - 1];
              
              if (isClosed && coordinates.length > 3) {
                geometry = {
                  type: 'Polygon',
                  coordinates: [coordinates]
                };
              } else {
                geometry = {
                  type: 'LineString',
                  coordinates: coordinates
                };
              }
            }
          }
          break;
      }
      
      if (geometry) {
        features.push({
          type: 'Feature',
          id: `${element.type}/${element.id}`,
          properties: element.tags || {},
          geometry: geometry
        });
      }
    });
    
    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OSM Download MCP サーバーが起動しました...');
  }
}

const server = new OSMDownloadServer();
server.run().catch(console.error);