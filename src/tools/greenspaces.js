// greenspaces.js
// 緑地・公園データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import { executeGeoJSONQuery } from '../utils/file-downloader.js';
import osmtogeojson from 'osmtogeojson';

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

export async function getGreenSpaces(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, green_space_type = 'all', limit, output_path } = args;
  
  // 入力検証（制限値も含む）
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
  // 緑地タイプフィルターの検証
  const allowedGreenSpaceTypes = ['park', 'forest', 'garden', 'farmland', 'grass', 'meadow', 'nature_reserve', 'all'];
  const filterValidation = validateFilter(green_space_type, allowedGreenSpaceTypes);
  if (!filterValidation.isValid) {
    throw new Error(filterValidation.error);
  }
  
  // 制限値をクエリに適用
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  // 緑地データのクエリ構築
  let query;
  const querySettings = `[timeout:180][maxsize:1073741824];`;
  
  if (green_space_type === 'all') {
    query = `${querySettings}
(
  way["leisure"~"^(park|garden|nature_reserve)$"](${minLat},${minLon},${maxLat},${maxLon});
  way["landuse"~"^(forest|farmland|grass|meadow)$"](${minLat},${minLon},${maxLat},${maxLon});
  way["natural"~"^(wood|forest|grassland|scrub)$"](${minLat},${minLon},${maxLat},${maxLon});
  relation["leisure"~"^(park|garden|nature_reserve)$"](${minLat},${minLon},${maxLat},${maxLon});
  relation["landuse"~"^(forest|farmland|grass|meadow)$"](${minLat},${minLon},${maxLat},${maxLon});
  relation["natural"~"^(wood|forest|grassland|scrub)$"](${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
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
    
    query = `${querySettings}
(
  ${wayQueries}
  ${relationQueries}
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
            message: '緑地データをダウンロードしました',
            file: output_path,
            size: result.size,
            feature_count: result.feature_count,
            limit_applied: normalizedLimit,
            is_truncated: normalizedLimit ? result.feature_count >= normalizedLimit : false,
            green_space_type: green_space_type,
            bbox: [minLon, minLat, maxLon, maxLat],
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // 従来の動作：JSONレスポンスを返す
    const osmData = await overpassClient.query(`[out:json]${query}`, false, 'get_green_spaces');
    const geojson = osmtogeojson(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      green_space_type: green_space_type,
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
