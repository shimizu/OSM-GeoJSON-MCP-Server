// buildings.js
// 建物データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { executeGeoJSONQuery } from './download.js';
import osmtogeojson from 'osmtogeojson';

export const buildingsToolSchema = {
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
      },
      limit: {
        type: 'number',
        description: '取得件数の上限（オプション）。1-10000の範囲で指定可能',
        minimum: 1,
        maximum: 10000
      },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス（オプション）。指定するとファイルに保存、指定しないとJSON応答を返す'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getBuildings(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, building_type = 'all', limit, output_path } = args;
  
  // 入力検証（制限値も含む）
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
  // 建物タイプフィルターの検証
  const allowedBuildingTypes = ['residential', 'commercial', 'industrial', 'public', 'all'];
  const filterValidation = validateFilter(building_type, allowedBuildingTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 建物タイプのフィルター設定
  let buildingFilter = building_type !== 'all' ? `["building"="${building_type}"]` : '["building"]';
  
  // 制限値をクエリに適用
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  // Overpass QLクエリの構築（[out:json]はヘルパー関数が追加）
  const query = `[timeout:180][maxsize:1073741824];
(
  way${buildingFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  
  try {
    // ファイル出力が指定されている場合
    if (output_path) {
      if (!output_path.endsWith('.geojson')) {
        throw new Error('ファイル出力は .geojson 形式のみサポートしています。');
      }
      
      const result = await executeGeoJSONQuery(overpassClient, query, output_path);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: '建物データをダウンロードしました',
            file: output_path,
            size: result.size,
            feature_count: result.feature_count,
            limit_applied: normalizedLimit,
            is_truncated: normalizedLimit ? result.feature_count >= normalizedLimit : false,
            building_type: building_type,
            bbox: [minLon, minLat, maxLon, maxLat],
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // 従来の動作：JSONレスポンスを返す
    const osmData = await overpassClient.query(`[out:json];${query}`, false, 'get_buildings');
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      building_type: building_type,
      limit_applied: normalizedLimit,
      is_truncated: normalizedLimit ? geojson.features.length >= normalizedLimit : false,
      bbox: [minLon, minLat, maxLon, maxLat]
    });
    
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
          query: query
        }, null, 2)
      }]
    };
  }
}