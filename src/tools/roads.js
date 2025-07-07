// roads.js
// 道路データ取得ツール

import { validateCommonInputs, validateFilter } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';
import fs from 'fs/promises';
import osmtogeojson from 'osmtogeojson';

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

export async function getRoads(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, road_types = ['all'], limit, output_path } = args;
  
  // 入力検証（制限値も含む）
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
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
  
  // 制限値をクエリに適用
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  const query = `[out:json][timeout:180][maxsize:1073741824];
(
  way${roadFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  
  try {
    // ファイル出力が指定されている場合
    if (output_path) {
      const result = await overpassClient.queryToFile(query, output_path);
      
      // OSMデータをGeoJSONに変換する場合
      if (output_path.endsWith('.geojson')) {
        const osmData = JSON.parse(await fs.readFile(output_path, 'utf8'));
        const geojson = osmtogeojson(osmData);
        await fs.writeFile(output_path, JSON.stringify(geojson, null, 2));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: '道路データをダウンロードしました',
              file: output_path,
              size: result.size,
              feature_count: geojson.features.length,
              road_types: road_types,
              bbox: [minLon, minLat, maxLon, maxLat],
              server: result.server
            }, null, 2)
          }]
        };
      }
      
      // OSM形式のまま保存
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: '道路データをダウンロードしました（OSM形式）',
            file: output_path,
            size: result.size,
            road_types: road_types,
            bbox: [minLon, minLat, maxLon, maxLat],
            server: result.server
          }, null, 2)
        }]
      };
    }
    
    // 従来の動作：JSONレスポンスを返す
    const osmData = await overpassClient.query(query, false, 'get_roads');
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