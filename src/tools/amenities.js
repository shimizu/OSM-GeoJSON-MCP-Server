// amenities.js
// アメニティ（施設）データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { executeGeoJSONQuery } from '../utils/file-downloader.js';
import osmtogeojson from 'osmtogeojson';

export const amenitiesToolSchema = {
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

export async function getAmenities(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, amenity_type = 'all', limit, output_path } = args;
  
  // 入力検証（制限値も含む）
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
  // アメニティタイプフィルターの検証
  const allowedAmenityTypes = ['restaurant', 'hospital', 'school', 'bank', 'cafe', 'all'];
  const filterValidation = validateFilter(amenity_type, allowedAmenityTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // アメニティタイプのフィルター設定
  let amenityFilter = amenity_type !== 'all' ? `["amenity"="${amenity_type}"]` : '["amenity"]';
  
  // 制限値をクエリに適用
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  // アメニティはノード（点）またはウェイ（エリア）として定義される
  const query = `[timeout:180][maxsize:1073741824];
(
  node${amenityFilter}(${minLat},${minLon},${maxLat},${maxLon});
  way${amenityFilter}(${minLat},${minLon},${maxLat},${maxLon});
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
            message: 'アメニティデータをダウンロードしました',
            file: output_path,
            size: result.size,
            feature_count: result.feature_count,
            limit_applied: normalizedLimit,
            is_truncated: normalizedLimit ? result.feature_count >= normalizedLimit : false,
            amenity_type: amenity_type,
            bbox: [minLon, minLat, maxLon, maxLat],
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // 従来の動作：JSONレスポンスを返す
    const osmData = await overpassClient.query(`[out:json]${query}`, false, 'get_amenities');
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      amenity_type: amenity_type,
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
