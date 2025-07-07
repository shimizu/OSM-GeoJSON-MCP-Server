// railways.js
// 鉄道データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';

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
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getRailways(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, railway_type = 'all' } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // 鉄道タイプフィルターの検証
  const allowedRailwayTypes = ['rail', 'subway', 'tram', 'monorail', 'station', 'platform', 'all'];
  const filterValidation = validateFilter(railway_type, allowedRailwayTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 鉄道データのクエリ構築
  let query;
  
  if (railway_type === 'all') {
    query = `[out:json][timeout:60];
(
  way["railway"](${minLat},${minLon},${maxLat},${maxLon});
  node["railway"](${minLat},${minLon},${maxLat},${maxLon});
  relation["railway"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  } else if (railway_type === 'station') {
    // 駅は主にノードとして表現される
    query = `[out:json][timeout:60];
(
  node["railway"="station"](${minLat},${minLon},${maxLat},${maxLon});
  node["public_transport"="station"](${minLat},${minLon},${maxLat},${maxLon});
  way["railway"="station"](${minLat},${minLon},${maxLat},${maxLon});
  way["public_transport"="station"](${minLat},${minLon},${maxLat},${maxLon});
  relation["railway"="station"](${minLat},${minLon},${maxLat},${maxLon});
  relation["public_transport"="station"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;`;
  } else if (railway_type === 'platform') {
    // プラットフォーム
    query = `[out:json][timeout:60];
(
  way["railway"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  way["public_transport"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  node["railway"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  node["public_transport"="platform"](${minLat},${minLon},${maxLat},${maxLon});
  relation["public_transport"="platform"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  } else {
    // 特定の線路タイプ（rail, subway, tram, monorail）
    query = `[out:json][timeout:60];
(
  way["railway"="${railway_type}"](${minLat},${minLon},${maxLat},${maxLon});
  relation["railway"="${railway_type}"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  }
  
  try {
    const osmData = await overpassClient.query(query);
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      railway_type: railway_type,
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