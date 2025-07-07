// waterways.js
// 水域・河川データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { handleQueryWithOptionalFile } from '../utils/file-handler.js';

export const waterwaysToolSchema = {
  name: 'get_waterways',
  description: '指定した矩形範囲内の水域・河川データをGeoJSON形式で取得します。川、湖、海、運河などの水域情報が含まれます。',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      waterway_type: {
        type: 'string',
        description: '水域タイプフィルター（オプション）',
        enum: ['river', 'stream', 'canal', 'lake', 'reservoir', 'pond', 'all'],
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

export async function getWaterways(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, waterway_type = 'all', output_path } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // 水域タイプフィルターの検証
  const allowedWaterwayTypes = ['river', 'stream', 'canal', 'lake', 'reservoir', 'pond', 'all'];
  const filterValidation = validateFilter(waterway_type, allowedWaterwayTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 水域データのクエリ構築
  // waterway: 河川、運河など（線形）
  // natural=water: 湖、池など（面）
  let query;
  
  if (waterway_type === 'all') {
    query = `[out:json][timeout:60];
(
  way["waterway"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
  relation["waterway"](${minLat},${minLon},${maxLat},${maxLon});
  relation["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  } else if (['lake', 'reservoir', 'pond'].includes(waterway_type)) {
    // 湖、貯水池、池は natural=water で検索
    query = `[out:json][timeout:60];
(
  way["natural"="water"]["water"="${waterway_type}"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"="water"][!"water"](${minLat},${minLon},${maxLat},${maxLon});
  relation["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  } else {
    // 河川、運河など
    query = `[out:json][timeout:60];
(
  way["waterway"="${waterway_type}"](${minLat},${minLon},${maxLat},${maxLon});
  relation["waterway"="${waterway_type}"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  }
  
  try {
    return await handleQueryWithOptionalFile({
      overpassClient,
      query,
      output_path,
      dataType: '水域',
      metadata: {
        waterway_type: waterway_type,
        bbox: [minLon, minLat, maxLon, maxLat]
      },
      processResponse: (osmData) => {
        const geojson = osmToGeoJSON(osmData);
        
        const response = createGeoJSONResponse(geojson, {
          waterway_type: waterway_type,
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