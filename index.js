// working-osm-geojson-mcp.js
// 動作確認済みのOSM GeoJSON MCPサーバー
// 
// このサーバーはOpenStreetMap (OSM) のデータをOverpass API経由で取得し、
// GeoJSON形式で返すMCP (Model Context Protocol) サーバーです。
// 
// 主な機能:
// - 建物データの取得
// - 道路ネットワークの取得
// - アメニティ（施設）データの取得
// - 接続テスト

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import https from 'https';

class OSMGeoJSONServer {
  constructor() {
    // MCPサーバーのインスタンスを作成
    this.server = new Server(
      {
        name: 'osm-geojson-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},  // ツール機能を有効化
        },
      }
    );

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

    // ツールハンドラーの設定
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // 利用可能なツールのリストを返すハンドラー
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_buildings',
          description: '指定した矩形範囲内の建物データをGeoJSON形式で取得します。建物タイプでフィルタリング可能です。',
          inputSchema: {
            type: 'object',
            properties: {
              minLon: { type: 'number', description: '最小経度（西端）' },
              minLat: { type: 'number', description: '最小緯度（南端）' },
              maxLon: { type: 'number', description: '最大経度（東端）' },
              maxLat: { type: 'number', description: '最大緯度（北端）' },
              building_type: {
                type: 'string',
                description: '建物タイプフィルター（オプション）',
                enum: ['residential', 'commercial', 'industrial', 'public', 'all'],
                default: 'all'
              }
            },
            required: ['minLon', 'minLat', 'maxLon', 'maxLat']
          }
        },
        {
          name: 'get_roads',
          description: '指定した矩形範囲内の道路ネットワークをGeoJSON形式で取得します。道路タイプでフィルタリング可能です。',
          inputSchema: {
            type: 'object',
            properties: {
              minLon: { type: 'number', description: '最小経度（西端）' },
              minLat: { type: 'number', description: '最小緯度（南端）' },
              maxLon: { type: 'number', description: '最大経度（東端）' },
              maxLat: { type: 'number', description: '最大緯度（北端）' },
              road_types: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'all']
                },
                description: '道路タイプフィルター（複数選択可）',
                default: ['all']
              }
            },
            required: ['minLon', 'minLat', 'maxLon', 'maxLat']
          }
        },
        {
          name: 'get_amenities',
          description: '指定した矩形範囲内のアメニティ（施設・設備）をGeoJSON形式で取得します。レストラン、病院、学校などのPOI（興味のある地点）データが含まれます。',
          inputSchema: {
            type: 'object',
            properties: {
              minLon: { type: 'number', description: '最小経度（西端）' },
              minLat: { type: 'number', description: '最小緯度（南端）' },
              maxLon: { type: 'number', description: '最大経度（東端）' },
              maxLat: { type: 'number', description: '最大緯度（北端）' },
              amenity_type: {
                type: 'string',
                description: 'アメニティタイプ（例: restaurant, hospital, school, bank, cafe）',
                default: 'all'
              }
            },
            required: ['minLon', 'minLat', 'maxLon', 'maxLat']
          }
        },
        {
          name: 'test_connection',
          description: 'Overpass APIサーバーへの接続をテストします。すべての利用可能なサーバーに対して接続確認を行います。',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    // ツール実行のハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // ツール名に応じて適切なメソッドを呼び出す
      switch (name) {
        case 'test_connection':
          return await this.testConnection();
        case 'get_buildings':
          return await this.getBuildings(args);
        case 'get_roads':
          return await this.getRoads(args);
        case 'get_amenities':
          return await this.getAmenities(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
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
  async queryOverpass(query) {
    let lastError = null;
    
    // 現在のサーバーから順番に試す（ラウンドロビン）
    for (let i = 0; i < this.servers.length; i++) {
      const serverIndex = (this.currentServerIndex + i) % this.servers.length;
      const server = this.servers[serverIndex];
      
      try {
        console.error(`Querying ${server.host}...`);
        const response = await this.httpsRequest(
          server.url,
          query,
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

  // OSMデータをGeoJSONに変換
  // Overpass APIから返されるOSM形式のデータを、
  // 標準的なGeoJSON形式に変換する
  osmToGeoJSON(osmData) {
    const features = [];
    const nodes = {};  // ノードIDと座標のマッピング
    
    if (!osmData.elements) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // ステップ1: すべてのノードを収集
    // ウェイ（道路や建物の輪郭）はノードIDの配列として定義されているため、
    // 先にノードの座標を収集しておく
    osmData.elements.forEach(element => {
      if (element.type === 'node') {
        nodes[element.id] = [element.lon, element.lat];
      }
    });
    
    // ステップ2: 各要素をGeoJSONフィーチャーに変換
    osmData.elements.forEach(element => {
      let geometry = null;
      
      switch (element.type) {
        case 'node':
          // ノードは点（Point）として表現
          if (element.lon !== undefined && element.lat !== undefined) {
            geometry = {
              type: 'Point',
              coordinates: [element.lon, element.lat]
            };
          }
          break;
          
        case 'way':
          // ウェイは線（LineString）または多角形（Polygon）として表現
          if (element.nodes && element.nodes.length > 0) {
            // ノードIDから座標を取得
            const coordinates = element.nodes
              .map(nodeId => nodes[nodeId])
              .filter(coord => coord !== undefined);
            
            if (coordinates.length > 0) {
              // 閉じたウェイ（最初と最後のノードが同じ）かどうか確認
              const isClosed = element.nodes[0] === element.nodes[element.nodes.length - 1];
              
              // 閉じていて、4点以上ある場合はポリゴン（建物など）
              if (isClosed && coordinates.length > 3) {
                geometry = {
                  type: 'Polygon',
                  coordinates: [coordinates]  // GeoJSONのポリゴンは配列の配列
                };
              } else {
                // それ以外は線（道路など）
                geometry = {
                  type: 'LineString',
                  coordinates: coordinates
                };
              }
            }
          }
          break;
          
        // リレーションは現在サポートしていない
        // （複雑な多角形や境界線などに使用される）
      }
      
      // ジオメトリが作成できた場合、フィーチャーとして追加
      if (geometry) {
        features.push({
          type: 'Feature',
          id: `${element.type}/${element.id}`,
          properties: element.tags || {},  // OSMタグをプロパティとして保存
          geometry: geometry
        });
      }
    });
    
    // GeoJSON FeatureCollectionとして返す
    return {
      type: 'FeatureCollection',
      features: features
    };
  }

  // 接続テストメソッド
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
    
    return {
      content: [{
        type: 'text',
        text: results.join('\n')
      }]
    };
  }

  // 建物データ取得メソッド
  async getBuildings(args) {
    const { minLon, minLat, maxLon, maxLat, building_type = 'all' } = args;
    
    // エリアサイズをチェック（大きすぎるとタイムアウトする可能性）
    const area = (maxLon - minLon) * (maxLat - minLat);
    if (area > 0.001) {
      console.error(`警告: 大きなエリア (${area.toFixed(6)} 平方度) が指定されています。より小さなエリアの使用を検討してください。`);
    }
    
    // 建物タイプのフィルター設定
    let buildingFilter = building_type !== 'all' ? `["building"="${building_type}"]` : '["building"]';
    
    // Overpass QLクエリの構築
    // - [out:json]: JSON形式で出力
    // - [timeout:60]: 60秒のタイムアウト
    // - way: ウェイ（建物の輪郭）を検索
    // - out body: 完全なデータを出力
    // - >: 参照されているノードも出力
    // - out skel qt: ノードの基本情報のみ出力（クイック）
    const query = `[out:json][timeout:60];
(
  way${buildingFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
    
    try {
      const osmData = await this.queryOverpass(query);
      const geojson = this.osmToGeoJSON(osmData);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'geojson',
            data: geojson,
            summary: {
              feature_count: geojson.features.length,
              building_type: building_type,
              bbox: [minLon, minLat, maxLon, maxLat]
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            query: query
          }, null, 2)
        }]
      };
    }
  }

  // 道路データ取得メソッド
  async getRoads(args) {
    const { minLon, minLat, maxLon, maxLat, road_types = ['all'] } = args;
    
    // 道路タイプのフィルター設定
    let roadFilter = '';
    if (!road_types.includes('all')) {
      // 複数の道路タイプを指定された場合の処理
      const filters = road_types.map(type => `["highway"="${type}"]`).join('');
      roadFilter = filters;
    } else {
      // すべての道路を取得
      roadFilter = '["highway"]';
    }
    
    const query = `[out:json][timeout:60];
(
  way${roadFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
    
    try {
      const osmData = await this.queryOverpass(query);
      const geojson = this.osmToGeoJSON(osmData);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'geojson',
            data: geojson,
            summary: {
              feature_count: geojson.features.length,
              road_types: road_types,
              bbox: [minLon, minLat, maxLon, maxLat]
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            query: query
          }, null, 2)
        }]
      };
    }
  }

  // アメニティ（施設）データ取得メソッド
  async getAmenities(args) {
    const { minLon, minLat, maxLon, maxLat, amenity_type = 'all' } = args;
    
    // アメニティタイプのフィルター設定
    let amenityFilter = amenity_type !== 'all' ? `["amenity"="${amenity_type}"]` : '["amenity"]';
    
    // アメニティはノード（点）またはウェイ（エリア）として定義される
    const query = `[out:json][timeout:60];
(
  node${amenityFilter}(${minLat},${minLon},${maxLat},${maxLon});
  way${amenityFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
out body;`;
    
    try {
      const osmData = await this.queryOverpass(query);
      const geojson = this.osmToGeoJSON(osmData);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            type: 'geojson',
            data: geojson,
            summary: {
              feature_count: geojson.features.length,
              amenity_type: amenity_type,
              bbox: [minLon, minLat, maxLon, maxLat]
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            query: query
          }, null, 2)
        }]
      };
    }
  }

  // MCPサーバーの起動
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OSM GeoJSON MCPサーバーが起動しました...');
  }
}

// サーバーインスタンスの作成と起動
const server = new OSMGeoJSONServer();
server.run().catch(console.error);