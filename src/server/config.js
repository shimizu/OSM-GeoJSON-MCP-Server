// config.js
// サーバー設定

export const serverConfig = {
  name: 'osm-geojson-server',
  version: '1.0.1',  // バージョンアップ（改善版）
  timeout: 180000,  // 180秒のタイムアウト（Overpass APIベストプラクティス）
  maxAreaSize: 0.001,  // 最大エリアサイズ（平方度）
  maxMemorySize: 1073741824,  // 1GBメモリ制限（Overpass API推奨）
  
  // キャッシュ設定
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 15 * 60 * 1000,  // 15分TTL（規約準拠）
    cleanupInterval: 5 * 60 * 1000
  },
  
  // ログ設定
  logging: {
    enabled: true,
    logLevel: 'info',
    detailedStats: true
  },
  
  // レート制限設定
  rateLimit: {
    enabled: true,
    maxRequestsPerMinute: 60,  // 1秒あたり1リクエスト
    backoffMultiplier: 2,
    maxBackoffTime: 30000
  }
};

export const overpassConfig = {
  servers: [
    { 
      url: 'https://162.55.144.139/api/interpreter', 
      host: 'overpass-api.de',
      priority: 1  // プライマリサーバー
    },
    { 
      url: 'https://65.109.112.52/api/interpreter', 
      host: 'lz4.overpass-api.de',
      priority: 2  // セカンダリサーバー
    },
    { 
      url: 'https://193.219.97.30/api/interpreter', 
      host: 'overpass.kumi.systems',
      priority: 3  // ターシャリサーバー
    }
  ],
  timeout: 180000,  // 180秒（Overpass API推奨）
  userAgent: 'OSM-MCP/1.0',
  
  // クエリ最適化設定
  queryDefaults: {
    timeout: 180,  // クエリ内タイムアウト（秒）
    maxsize: 1073741824  // 1GBメモリ制限
  },
  
  // 接続設定
  connection: {
    rejectUnauthorized: false,  // IP直接接続用
    keepAlive: false,
    connectTimeout: 10000
  }
};