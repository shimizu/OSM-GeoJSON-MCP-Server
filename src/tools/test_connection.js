// test_connection.js
// 接続テストツール

export const testConnectionToolSchema = {
  name: 'test_connection',
  description: 'Overpass APIサーバーへの接続をテストします。すべての利用可能なサーバーに対して接続確認を行います。',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export async function testConnection(overpassClient) {
  try {
    const results = await overpassClient.testConnection();
    
    const response = {
      type: 'connection_test',
      results: results,
      summary: {
        total_servers: results.length,
        successful_connections: results.filter(r => r.includes('✓')).length,
        failed_connections: results.filter(r => r.includes('✗')).length
      }
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };
  } catch (error) {
    const response = {
      type: 'connection_test',
      error: error.message,
      summary: {
        total_servers: 0,
        successful_connections: 0,
        failed_connections: 0
      }
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };
  }
}