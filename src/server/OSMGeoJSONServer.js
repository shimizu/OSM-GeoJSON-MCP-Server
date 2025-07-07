// OSMGeoJSONServer.js
// メインMCPサーバークラス

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { OverpassClient } from '../utils/overpass.js';
import { toolSchemas, executeTool } from '../tools/index.js';

export class OSMGeoJSONServer {
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

    // Overpass APIクライアントを初期化
    this.overpassClient = new OverpassClient();

    // ツールハンドラーの設定
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // 利用可能なツールのリストを返すハンドラー
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolSchemas
    }));

    // ツール実行のハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        return await executeTool(name, this.overpassClient, args);
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              tool: name,
              args: args
            }, null, 2)
          }]
        };
      }
    });
  }

  // MCPサーバーの起動
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OSM GeoJSON MCPサーバーが起動しました...');
  }
}