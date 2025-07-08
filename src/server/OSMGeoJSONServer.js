// OSMGeoJSONServer.js
// メインMCPサーバークラス

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializedNotificationSchema,
  McpError,
  ErrorCode,
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
    // 初期化完了通知のハンドラー
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      // 初期化完了の通知を受信（応答は不要）
      console.error('MCP server initialized and ready');
    });

    // 利用可能なツールのリストを返すハンドラー
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolSchemas
    }));

    // ツール実行のハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        // 引数検証
        if (!args || typeof args !== 'object') {
          throw new McpError(
            ErrorCode.InvalidParams, 
            'Invalid or missing arguments',
            { tool: name, received: typeof args }
          );
        }
        
        return await executeTool(name, this.overpassClient, args);
      } catch (error) {
        // 既にMcpErrorの場合はそのまま再投げ
        if (error instanceof McpError) {
          throw error;
        }
        
        // ネットワークエラー
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new McpError(
            ErrorCode.InternalError,
            'Network connection failed',
            { tool: name, networkError: error.code }
          );
        }
        
        // 検証エラー
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new McpError(
            ErrorCode.InvalidParams,
            error.message,
            { tool: name, args: args }
          );
        }
        
        // タイムアウトエラー
        if (error.message?.includes('timeout')) {
          throw new McpError(
            ErrorCode.RequestTimeout,
            'Request timed out - try reducing search area or adding filters',
            { 
              tool: name, 
              suggestion: 'Reduce bbox size or add more specific filters',
              bbox: args.minLon !== undefined ? [args.minLon, args.minLat, args.maxLon, args.maxLat] : undefined
            }
          );
        }
        
        // その他のエラー
        throw new McpError(
          ErrorCode.InternalError,
          error.message || 'Unknown error occurred',
          { 
            tool: name, 
            errorType: error.constructor.name
          }
        );
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