import { downloadToFile, executeGeoJSONQuery } from '../utils/file-downloader.js';

export const downloadOSMDataSchema = {
  name: 'download_osm_data',
  description: 'OpenStreetMapデータをダウンロードしてファイルに保存します。大きなデータも扱えます。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Overpass QLクエリ'
      },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス（例: ./data/tokyo_buildings.geojson）'
      },
      format: {
        type: 'string',
        enum: ['json', 'xml'],
        default: 'json',
        description: '出力形式'
      }
    },
    required: ['query', 'output_path']
  }
};

export const downloadAreaBuildingsSchema = {
  name: 'download_area_buildings',
  description: '指定エリアの建物データをダウンロード（簡易版）',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat', 'output_path']
  }
};

export const downloadAreaAllSchema = {
  name: 'download_area_all',
  description: '指定エリアの全データをダウンロード（建物、道路、POIなど）',
  inputSchema: {
    type: 'object',
    properties: {
      minLon: { type: 'number', description: '最小経度（西端）' },
      minLat: { type: 'number', description: '最小緯度（南端）' },
      maxLon: { type: 'number', description: '最大経度（東端）' },
      maxLat: { type: 'number', description: '最大緯度（北端）' },
      output_path: {
        type: 'string',
        description: '保存先ファイルパス'
      }
    },
    required: ['minLon', 'minLat', 'maxLon', 'maxLat', 'output_path']
  }
};


export async function downloadOSMData(overpassClient, args) {
  const { query, output_path, format = 'json' } = args;
  
  const fullQuery = format === 'json' ? 
    (query.startsWith('[out:json]') ? query : `[out:json];${query}`) :
    (query.startsWith('[out:xml]') ? query : `[out:xml];${query}`);
  
  console.error(`Downloading OSM data to ${output_path}...`);
  
  const servers = overpassClient.servers;
  let lastError = null;
  
  for (const server of servers) {
    try {
      const result = await downloadToFile(
        server.url,
        fullQuery,
        output_path,
        { 'Host': server.host }
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: `データをダウンロードしました`,
            file: output_path,
            size: result.size,
            server: server.host
          }, null, 2)
        }]
      };
    } catch (error) {
      lastError = error;
      console.error(`Failed with ${server.host}: ${error.message}`);
    }
  }
  
  throw new Error(`All servers failed: ${lastError?.message}`);
}

export async function downloadAreaBuildings(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, output_path } = args;
  
  const query = `[out:json][timeout:180];
(
  way["building"](${minLat},${minLon},${maxLat},${maxLon});
  relation["building"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  
  return await downloadOSMData(overpassClient, { query, output_path, format: 'json' });
}

export async function downloadAreaAll(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, output_path } = args;
  
  const query = `[out:json][timeout:300];
(
  node(${minLat},${minLon},${maxLat},${maxLon});
  way(${minLat},${minLon},${maxLat},${maxLon});
  relation(${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
  
  return await downloadOSMData(overpassClient, { query, output_path, format: 'json' });
}