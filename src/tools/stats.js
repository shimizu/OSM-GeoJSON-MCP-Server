// stats.js
// API統計情報取得ツール

export const statsToolSchema = {
  name: 'get_api_stats',
  description: 'API使用統計情報とキャッシュ状況を取得します。モニタリングとデバッグに使用します。',
  inputSchema: {
    type: 'object',
    properties: {
      reset: {
        type: 'boolean',
        description: '統計をリセットするかどうか（オプション）',
        default: false
      }
    }
  }
};

export async function getApiStats(overpassClient, args = {}) {
  const { reset = false } = args;
  
  try {
    // API統計情報を取得
    const apiStats = overpassClient.getApiStats();
    const cacheStats = overpassClient.getCacheStats();
    
    // リセットが要求された場合
    if (reset) {
      // 注意: 実際のリセット機能は管理者権限が必要
      console.error('Stats reset requested (admin only feature)');
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      api_statistics: apiStats,
      cache_statistics: cacheStats,
      server_status: {
        name: 'osm-geojson-server',
        version: '1.0.1',
        uptime: apiStats.uptime
      },
      compliance_info: {
        user_agent: 'OSM-MCP/1.0',
        rate_limiting: 'enabled',
        caching: 'enabled (15min TTL)',
        overpass_api_compliance: 'full'
      }
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }
}