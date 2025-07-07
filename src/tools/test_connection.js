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
    
    return {
      content: [{
        type: 'text',
        text: results.join('\n')
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Connection test failed: ${error.message}`
      }]
    };
  }
}