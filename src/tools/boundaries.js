// boundaries.js
// 境界線データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';

export const boundariesToolSchema = {
  name: 'get_boundaries',
  description: '指定した矩形範囲内の境界線データをGeoJSON形式で取得します。国境、都道府県境、市区町村境などの行政境界が含まれます。',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      admin_level: {
        type: 'string',
        description: '行政レベルフィルター（オプション）',
        enum: ['2', '4', '6', '7', '8', '9', '10', 'all'],
        default: 'all'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getBoundaries(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, admin_level = 'all' } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // 行政レベルフィルターの検証
  const allowedAdminLevels = ['2', '4', '6', '7', '8', '9', '10', 'all'];
  const filterValidation = validateFilter(admin_level, allowedAdminLevels);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 境界線データのクエリ構築
  // 行政レベルの説明:
  // 2: 国境
  // 4: 都道府県境（日本では都道府県）
  // 6: 郡境
  // 7: 市区境
  // 8: 市区町村境
  // 9: 町・字境
  // 10: その他の小さな区画
  
  let query;
  
  if (admin_level === 'all') {
    query = `[out:json][timeout:60];
(
  relation["boundary"="administrative"](${minLat},${minLon},${maxLat},${maxLon});
  way["boundary"="administrative"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  } else {
    query = `[out:json][timeout:60];
(
  relation["boundary"="administrative"]["admin_level"="${admin_level}"](${minLat},${minLon},${maxLat},${maxLon});
  way["boundary"="administrative"]["admin_level"="${admin_level}"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  }
  
  try {
    const osmData = await overpassClient.query(query);
    const geojson = osmToGeoJSON(osmData);
    
    // 行政レベルの説明を追加
    const adminLevelDescriptions = {
      '2': '国境',
      '4': '都道府県境',
      '6': '郡境',
      '7': '市区境',
      '8': '市区町村境',
      '9': '町・字境',
      '10': 'その他の小区画',
      'all': 'すべての行政境界'
    };
    
    const response = createGeoJSONResponse(geojson, {
      admin_level: admin_level,
      admin_level_description: adminLevelDescriptions[admin_level] || admin_level,
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