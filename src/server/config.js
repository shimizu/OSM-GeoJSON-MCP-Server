// config.js
// サーバー設定

export const serverConfig = {
  name: 'osm-geojson-server',
  version: '1.0.0',
  timeout: 60000,  // 60秒のタイムアウト
  maxAreaSize: 0.001  // 最大エリアサイズ（平方度）
};

export const overpassConfig = {
  servers: [
    { 
      url: 'https://162.55.144.139/api/interpreter', 
      host: 'overpass-api.de'
    },
    { 
      url: 'https://65.109.112.52/api/interpreter', 
      host: 'lz4.overpass-api.de'
    },
    { 
      url: 'https://193.219.97.30/api/interpreter', 
      host: 'overpass.kumi.systems'
    }
  ],
  timeout: 60000,
  userAgent: 'OSM-MCP/1.0'
};