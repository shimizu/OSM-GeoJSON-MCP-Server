// converter.js
// OSMからGeoJSONへの変換ユーティリティ

import osmtogeojson from 'osmtogeojson';

// OSMデータをGeoJSONに変換
// Overpass APIから返されるOSM形式のデータを、
// 標準的なGeoJSON形式に変換する
export function osmToGeoJSON(osmData) {
  // osmtogeojsonライブラリを使用して変換
  return osmtogeojson(osmData);
}

// GeoJSONレスポンスを生成
export function createGeoJSONResponse(geojson, summary) {
  return {
    type: 'geojson',
    data: geojson,
    summary: {
      feature_count: geojson.features.length,
      ...summary
    }
  };
}