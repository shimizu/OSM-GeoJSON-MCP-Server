// file-handler.js
// ファイル出力処理の共通ユーティリティ

import fs from 'fs/promises';
import osmtogeojson from 'osmtogeojson';

/**
 * ツールの実行結果をファイルに保存するか、JSONレスポンスとして返すかを処理する
 * @param {Object} params - パラメータオブジェクト
 * @param {Object} params.overpassClient - Overpass APIクライアント
 * @param {string} params.query - Overpass QLクエリ
 * @param {string} params.output_path - 出力ファイルパス（オプション）
 * @param {string} params.dataType - データタイプ（例: '建物', '道路'）
 * @param {Object} params.metadata - 追加のメタデータ
 * @param {Function} params.processResponse - レスポンス処理関数
 * @returns {Object} MCP形式のレスポンス
 */
export async function handleQueryWithOptionalFile(params) {
  const {
    overpassClient,
    query,
    output_path,
    dataType,
    metadata,
    processResponse
  } = params;
  
  // ファイル出力が指定されている場合
  if (output_path) {
    const result = await overpassClient.queryToFile(query, output_path);
    
    // OSMデータをGeoJSONに変換する場合
    if (output_path.endsWith('.geojson')) {
      const osmData = JSON.parse(await fs.readFile(output_path, 'utf8'));
      const geojson = osmtogeojson(osmData);
      await fs.writeFile(output_path, JSON.stringify(geojson, null, 2));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: `${dataType}データをダウンロードしました`,
            file: output_path,
            size: result.size,
            feature_count: geojson.features.length,
            ...metadata,
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // OSM形式のまま保存
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'success',
          message: `${dataType}データをダウンロードしました（OSM形式）`,
          file: output_path,
          size: result.size,
          ...metadata,
          server: result.server
        }, null, 2)
      }]
    };
  }
  
  // 従来の動作：JSONレスポンスを返す
  const osmData = await overpassClient.query(query);
  return processResponse(osmData);
}