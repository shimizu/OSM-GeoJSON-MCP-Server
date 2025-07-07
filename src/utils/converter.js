// converter.js
// OSMからGeoJSONへの変換ユーティリティ

// OSMデータをGeoJSONに変換
// Overpass APIから返されるOSM形式のデータを、
// 標準的なGeoJSON形式に変換する
export function osmToGeoJSON(osmData) {
  const features = [];
  const nodes = {};  // ノードIDと座標のマッピング
  
  if (!osmData.elements) {
    return { type: 'FeatureCollection', features: [] };
  }
  
  // ステップ1: すべてのノードを収集
  // ウェイ（道路や建物の輪郭）はノードIDの配列として定義されているため、
  // 先にノードの座標を収集しておく
  osmData.elements.forEach(element => {
    if (element.type === 'node') {
      nodes[element.id] = [element.lon, element.lat];
    }
  });
  
  // ステップ2: 各要素をGeoJSONフィーチャーに変換
  osmData.elements.forEach(element => {
    let geometry = null;
    
    switch (element.type) {
      case 'node':
        // ノードは点（Point）として表現
        if (element.lon !== undefined && element.lat !== undefined) {
          geometry = {
            type: 'Point',
            coordinates: [element.lon, element.lat]
          };
        }
        break;
        
      case 'way':
        // ウェイは線（LineString）または多角形（Polygon）として表現
        if (element.nodes && element.nodes.length > 0) {
          // ノードIDから座標を取得
          const coordinates = element.nodes
            .map(nodeId => nodes[nodeId])
            .filter(coord => coord !== undefined);
          
          if (coordinates.length > 0) {
            // 閉じたウェイ（最初と最後のノードが同じ）かどうか確認
            const isClosed = element.nodes[0] === element.nodes[element.nodes.length - 1];
            
            // 閉じていて、4点以上ある場合はポリゴン（建物など）
            if (isClosed && coordinates.length > 3) {
              geometry = {
                type: 'Polygon',
                coordinates: [coordinates]  // GeoJSONのポリゴンは配列の配列
              };
            } else {
              // それ以外は線（道路など）
              geometry = {
                type: 'LineString',
                coordinates: coordinates
              };
            }
          }
        }
        break;
        
      case 'relation':
        // リレーションの基本的な処理
        // 現在は単純なマルチポリゴンのみサポート
        geometry = convertRelationToGeometry(element, nodes);
        break;
    }
    
    // ジオメトリが作成できた場合、フィーチャーとして追加
    if (geometry) {
      features.push({
        type: 'Feature',
        id: `${element.type}/${element.id}`,
        properties: element.tags || {},  // OSMタグをプロパティとして保存
        geometry: geometry
      });
    }
  });
  
  // GeoJSON FeatureCollectionとして返す
  return {
    type: 'FeatureCollection',
    features: features
  };
}

// リレーションをジオメトリに変換（基本的なマルチポリゴン対応）
function convertRelationToGeometry(relation, nodes) {
  if (!relation.members || relation.members.length === 0) {
    return null;
  }

  // マルチポリゴン（境界線など）の場合
  if (relation.tags && relation.tags.type === 'multipolygon') {
    const outerRings = [];
    const innerRings = [];
    
    for (const member of relation.members) {
      if (member.type === 'way' && member.nodes) {
        const coordinates = member.nodes
          .map(nodeId => nodes[nodeId])
          .filter(coord => coord !== undefined);
        
        if (coordinates.length > 3) {
          if (member.role === 'outer') {
            outerRings.push(coordinates);
          } else if (member.role === 'inner') {
            innerRings.push(coordinates);
          }
        }
      }
    }
    
    if (outerRings.length > 0) {
      // 単純なマルチポリゴン（内側のリングは無視）
      if (outerRings.length === 1) {
        return {
          type: 'Polygon',
          coordinates: [outerRings[0], ...innerRings]
        };
      } else {
        return {
          type: 'MultiPolygon',
          coordinates: outerRings.map(ring => [ring])
        };
      }
    }
  }
  
  // その他のリレーション（境界線など）
  if (relation.tags && relation.tags.boundary) {
    const allCoordinates = [];
    
    for (const member of relation.members) {
      if (member.type === 'way' && member.nodes) {
        const coordinates = member.nodes
          .map(nodeId => nodes[nodeId])
          .filter(coord => coord !== undefined);
        
        if (coordinates.length > 1) {
          allCoordinates.push(...coordinates);
        }
      }
    }
    
    if (allCoordinates.length > 1) {
      return {
        type: 'LineString',
        coordinates: allCoordinates
      };
    }
  }
  
  return null;
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