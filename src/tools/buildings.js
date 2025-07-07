// buildings.js
// 建物データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';

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
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getBuildings(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, building_type = 'all' } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // 建物タイプフィルターの検証
  const allowedBuildingTypes = ['residential', 'commercial', 'industrial', 'public', 'all'];
  const filterValidation = validateFilter(building_type, allowedBuildingTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 建物タイプのフィルター設定
  let buildingFilter = building_type !== 'all' ? `["building"="${building_type}"]` : '["building"]';
  
  // Overpass QLクエリの構築
  const query = `[out:json][timeout:60];
(
  way${buildingFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  
  try {
    const osmData = await overpassClient.query(query);
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      building_type: building_type,
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