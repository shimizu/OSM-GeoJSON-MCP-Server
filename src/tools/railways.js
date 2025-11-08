// railways.js
// 鉄道データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { executeGeoJSONQuery } from './download.js';
import osmtogeojson from 'osmtogeojson';

export const railwaysToolSchema = {
  name: 'get_railways',
  description: '指定した矩形範囲内の鉄道データをGeoJSON形式で取得します。鉄道線路、駅、地下鉄、トラムなどの交通インフラが含まれます。',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      railway_type: {
        type: 'string',
        description: '鉄道タイプフィルター（オプション）',
        enum: ['rail', 'subway', 'tram', 'monorail', 'station', 'platform', 'all'],
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

export async function getRailways(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, railway_type = 'all', limit, output_path } = args;
  
  // 入力検証（制限値も含む）
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
  // 鉄道タイプフィルターの検証
  const allowedRailwayTypes = ['rail', 'subway', 'tram', 'monorail', 'station', 'platform', 'all'];
  const filterValidation = validateFilter(railway_type, allowedRailwayTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 制限値をクエリに適用
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  // 鉄道データのクエリ構築
  let query;
  const querySettings = `[timeout:180][maxsize:1073741824];`;
  
  if (railway_type === 'all') {
    query = `${querySettings}
(
  way["railway"](${minLat},${minLon},${maxLat},${maxLon});
  node["railway"](${minLat},${minLon},${maxLat},${maxLon});
  relation["railway"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  } else if (railway_type === 'station') {
    // 駅は主にノードとして表現される
    query = `${querySettings}
(
  node["railway"="station"](${minLat},${minLon},${maxLat},${maxLon});
  node["public_transport"="station"](${minLat},${minLon},${maxLat},${maxLon});
  way["railway"="station"](${minLat},${minLon},${maxLat},${maxLon});
  way["public_transport"="station"](${minLat},${minLon},${maxLat},${maxLon});
  relation["railway"="station"](${minLat},${minLon},${maxLat},${maxLon});
  relation["public_transport"="station"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}`;
  } else if (railway_type === 'platform') {
    // プラットフォーム
    query = `${querySettings}
(
  way["railway"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  way["public_transport"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  node["railway"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  node["public_transport"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  relation["public_transport"="platform"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  } else {
    // 特定の線路タイプ（rail, subway, tram, monorail）
    query = `${querySettings}
(
  way["railway"="${railway_type}"](${minLat},${minLon},${maxLat},${maxLon});
  relation["railway"="${railway_type}"](${minLat},${minLon},${maxLat},${maxLon});
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
            message: '鉄道データをダウンロードしました',
            file: output_path,
            size: result.size,
            feature_count: result.feature_count,
            limit_applied: normalizedLimit,
            is_truncated: normalizedLimit ? result.feature_count >= normalizedLimit : false,
            railway_type: railway_type,
            bbox: [minLon, minLat, maxLon, maxLat],
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // 従来の動作：JSONレスポンスを返す
    const osmData = await overpassClient.query(`[out:json]${query}`, false, 'get_railways');
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      railway_type: railway_type,
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
