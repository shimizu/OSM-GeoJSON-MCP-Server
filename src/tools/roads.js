// roads.js
// 道路データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';

export const roadsToolSchema = {
  name: 'get_roads',
  description: '指定した矩形範囲内の道路ネットワークをGeoJSON形式で取得します。道路タイプでフィルタリング可能です。',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      road_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'all']
        },
        description: '道路タイプフィルター（複数選択可）',
        default: ['all']
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getRoads(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, road_types = ['all'] } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // 道路タイプフィルターの検証
  const allowedRoadTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'all'];
  const filterValidation = validateFilter(road_types, allowedRoadTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 道路タイプのフィルター設定
  let roadFilter = '';
  if (!road_types.includes('all')) {
    // 複数の道路タイプを指定された場合の処理
    const filters = road_types.map(type => `["highway"="${type}"]`).join('');
    roadFilter = filters;
  } else {
    // すべての道路を取得
    roadFilter = '["highway"]';
  }
  
  const query = `[out:json][timeout:60];
(
  way${roadFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  
  try {
    const osmData = await overpassClient.query(query);
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      road_types: road_types,
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