import fs from 'fs/promises';
import path from 'path';
import osmtogeojson from 'osmtogeojson';

export const convertToGeoJSONSchema = {
  name: 'convert_to_geojson',
  description: 'ダウンロード済みのOSMファイルをGeoJSONに変換',
  inputSchema: {
    type: 'object',
    properties: {
      input_path: {
        type: 'string',
        description: 'OSMデータファイルのパス'
      },
      output_path: {
        type: 'string',
        description: 'GeoJSON出力ファイルのパス'
      }
    },
    required: ['input_path', 'output_path']
  }
};

export async function convertToGeoJSON(overpassClient, args) {
  const { input_path, output_path } = args;
  
  try {
    const data = await fs.readFile(input_path, 'utf8');
    const osmData = JSON.parse(data);
    
    const geojson = osmtogeojson(osmData);
    
    await fs.mkdir(path.dirname(output_path), { recursive: true });
    await fs.writeFile(output_path, JSON.stringify(geojson, null, 2));
    
    const stats = await fs.stat(output_path);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'success',
          message: 'GeoJSONに変換しました',
          input_file: input_path,
          output_file: output_path,
          size: `${sizeMB} MB`,
          feature_count: geojson.features.length
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'error',
          message: error.message
        }, null, 2)
      }]
    };
  }
}