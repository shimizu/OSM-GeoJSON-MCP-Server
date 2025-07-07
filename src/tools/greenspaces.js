// greenspaces.js
// 緑地・公園データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';

export const greenspacesToolSchema = {
  name: 'get_green_spaces',
  description: '指定した矩形範囲内の緑地・公園データをGeoJSON形式で取得します。公園、森林、農地、庭園などの緑地情報が含まれます。',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      green_space_type: {
        type: 'string',
        description: '緑地タイプフィルター（オプション）',
        enum: ['park', 'forest', 'garden', 'farmland', 'grass', 'meadow', 'nature_reserve', 'all'],
        default: 'all'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat']
  }
};

export async function getGreenSpaces(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, green_space_type = 'all' } = args;
  
  // 入力検証
  validateCommonInputs(args);
  
  // 緑地タイプフィルターの検証
  const allowedGreenSpaceTypes = ['park', 'forest', 'garden', 'farmland', 'grass', 'meadow', 'nature_reserve', 'all'];
  const filterValidation = validateFilter(green_space_type, allowedGreenSpaceTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 緑地データのクエリ構築
  let query;
  
  if (green_space_type === 'all') {
    query = `[out:json][timeout:60];
(
  way["leisure"~"^(park|garden|nature_reserve)$"](${minLat},${minLon},${maxLat},${maxLon});
  way["landuse"~"^(forest|farmland|grass|meadow)$"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"~"^(wood|forest|grassland|scrub)$"](${minLat},${minLon},${maxLat},${maxLon});
  relation["leisure"~"^(park|garden|nature_reserve)$"](${minLat},${minLon},${maxLat},${maxLon});
  relation["landuse"~"^(forest|farmland|grass|meadow)$"](${minLat},${minLon},${maxLat},${maxLon});
  relation["natural"~"^(wood|forest|grassland|scrub)$"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  } else {
    // 特定の緑地タイプで検索
    let filters = [];
    
    switch (green_space_type) {
      case 'park':
        filters = ['["leisure"="park"]'];
        break;
      case 'forest':
        filters = ['["landuse"="forest"]', '["natural"="wood"]', '["natural"="forest"]'];
        break;
      case 'garden':
        filters = ['["leisure"="garden"]'];
        break;
      case 'farmland':
        filters = ['["landuse"="farmland"]'];
        break;
      case 'grass':
        filters = ['["landuse"="grass"]', '["natural"="grassland"]'];
        break;
      case 'meadow':
        filters = ['["landuse"="meadow"]'];
        break;
      case 'nature_reserve':
        filters = ['["leisure"="nature_reserve"]'];
        break;
    }
    
    const wayQueries = filters.map(filter => `way${filter}(${minLat},${minLon},${maxLat},${maxLon});`).join('\n  ');
    const relationQueries = filters.map(filter => `relation${filter}(${minLat},${minLon},${maxLat},${maxLon});`).join('\n  ');
    
    query = `[out:json][timeout:60];
(
  ${wayQueries}
  ${relationQueries}
);
out body;
>;
out skel qt;`;
  }
  
  try {
    const osmData = await overpassClient.query(query);
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      green_space_type: green_space_type,
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