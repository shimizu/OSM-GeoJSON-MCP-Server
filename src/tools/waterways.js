// waterways.js
// 水域・河川データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { executeGeoJSONQuery } from '../utils/file-downloader.js';
import osmtogeojson from 'osmtogeojson';

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

export async function getWaterways(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, waterway_type = 'all', limit, output_path } = args;
  
  // 入力検証（制限値も含む）
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
  // 水域タイプフィルターの検証
  const allowedWaterwayTypes = ['river', 'stream', 'canal', 'lake', 'reservoir', 'pond', 'all'];
  const filterValidation = validateFilter(waterway_type, allowedWaterwayTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 制限値をクエリに適用
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  // 水域データのクエリ構築
  // waterway: 河川、運河など（線形）
  // natural=water: 湖、池など（面）
  let query;
  const querySettings = `[timeout:180][maxsize:1073741824];`;
  
  if (waterway_type === 'all') {
    query = `${querySettings}
(
  way["waterway"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
  relation["waterway"](${minLat},${minLon},${maxLat},${maxLon});
  relation["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  } else if (['lake', 'reservoir', 'pond'].includes(waterway_type)) {
    // 湖、貯水池、池は natural=water で検索
    query = `${querySettings}
(
  way["natural"="water"]["water"="${waterway_type}"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"="water"][!"water"](${minLat},${minLon},${maxLat},${maxLon});
  relation["natural"="water"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  } else {
    // 河川、運河など
    query = `${querySettings}
(
  way["waterway"="${waterway_type}"](${minLat},${minLon},${maxLat},${maxLon});
  relation["waterway"="${waterway_type}"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  }
  
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
            message: '水域データをダウンロードしました',
            file: output_path,
            size: result.size,
            feature_count: result.feature_count,
            limit_applied: normalizedLimit,
            is_truncated: normalizedLimit ? result.feature_count >= normalizedLimit : false,
            waterway_type: waterway_type,
            bbox: [minLon, minLat, maxLon, maxLat],
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // 従来の動作：JSONレスポンスを返す
    const osmData = await overpassClient.query(`[out:json]${query}`, false, 'get_waterways');
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      waterway_type: waterway_type,
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
