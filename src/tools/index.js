// index.js
// ツール統合・エクスポート

import { buildingsToolSchema, getBuildings } from './buildings.js';
import { roadsToolSchema, getRoads } from './roads.js';
import { amenitiesToolSchema, getAmenities } from './amenities.js';
import { testConnectionToolSchema, testConnection } from './test_connection.js';
import { waterwaysToolSchema, getWaterways } from './waterways.js';
import { greenspacesToolSchema, getGreenSpaces } from './greenspaces.js';
import { railwaysToolSchema, getRailways } from './railways.js';
import { downloadOSMDataSchema, downloadAreaBuildingsSchema, downloadAreaAllSchema, downloadOSMData, downloadAreaBuildings, downloadAreaAll } from './download.js';
import { convertToGeoJSONSchema, convertToGeoJSON } from './convert.js';

// すべてのツールスキーマをエクスポート
export const toolSchemas = [
  buildingsToolSchema,
  roadsToolSchema,
  amenitiesToolSchema,
  testConnectionToolSchema,
  waterwaysToolSchema,
  greenspacesToolSchema,
  railwaysToolSchema,
  downloadOSMDataSchema,
  downloadAreaBuildingsSchema,
  downloadAreaAllSchema,
  convertToGeoJSONSchema
];

// ツール実行関数のマッピング
export const toolHandlers = {
  'get_buildings': getBuildings,
  'get_roads': getRoads,
  'get_amenities': getAmenities,
  'test_connection': testConnection,
  'get_waterways': getWaterways,
  'get_green_spaces': getGreenSpaces,
  'get_railways': getRailways,
  'download_osm_data': downloadOSMData,
  'download_area_buildings': downloadAreaBuildings,
  'download_area_all': downloadAreaAll,
  'convert_to_geojson': convertToGeoJSON
};

// ツール実行のディスパッチャー
export async function executeTool(toolName, overpassClient, args) {
  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  
  return await handler(overpassClient, args);
}