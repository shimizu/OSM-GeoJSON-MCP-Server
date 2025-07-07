// amenities.js
// アメニティ（施設）データ取得ツール

import { validateCommonInputs } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { handleQueryWithOptionalFile } from '../utils/file-handler.js';

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
      output_path: {
        type: 'string',
        description: '保存先ファイルパス（オプション）。指定するとファイルに保存、指定しないとJSON応答を返す'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getAmenities(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, amenity_type = 'all', output_path } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // アメニティタイプのフィルター設定
  let amenityFilter = amenity_type !== 'all' ? `["amenity"="${amenity_type}"]` : '["amenity"]';
  
  // アメニティはノード（点）またはウェイ（エリア）として定義される
  const query = `[out:json][timeout:60];
(
  node${amenityFilter}(${minLat},${minLon},${maxLat},${maxLon});
  way${amenityFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
out body;`;
  
  try {
    return await handleQueryWithOptionalFile({
      overpassClient,
      query,
      output_path,
      dataType: 'アメニティ',
      metadata: {
        amenity_type: amenity_type,
        bbox: [minLon, minLat, maxLon, maxLat]
      },
      processResponse: (osmData) => {
        const geojson = osmToGeoJSON(osmData);
        
        const response = createGeoJSONResponse(geojson, {
          amenity_type: amenity_type,
          bbox: [minLon, minLat, maxLon, maxLat]
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }]
        };
      }
    });
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