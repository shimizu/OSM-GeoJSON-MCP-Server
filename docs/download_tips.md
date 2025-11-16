# MCPサーバーでの外部APIデータ取得時のトークン消費最適化ガイド

## 概要

MCP（Model Context Protocol）サーバーで外部APIからデータを取得する場合、APIレスポンスを直接LLM（Large Language Model）に渡すと、大量のトークンを消費してしまう問題があります。このプロジェクトでは、データをファイルに保存し、LLMにはファイルパスとメタデータのみを返すことで、この問題を解決しています。

## 問題点：直接レスポンス返却時のトークン消費

### 従来の問題
- APIから取得した大量の地理データ（例: GeoJSON）をLLMのレスポンスとして直接返す
- データサイズが大きい場合（数MB以上）、LLMのコンテキストウィンドウを圧迫
- トークンコストの急増（例: 1MBのJSONデータ = 約25万トークン）
- LLMの応答遅延やエラー発生のリスク

### 具体例
```javascript
// 問題のある実装例
const apiResponse = await fetchExternalAPI();
return {
  content: [{
    type: 'text',
    text: JSON.stringify(apiResponse, null, 2)  // 巨大なデータを直接返す
  }]
};
```

## 解決策：ファイル保存 + メタデータ返却

### アプローチ
1. APIレスポンスをファイルに保存
2. LLMにはファイルパスと要約情報（メタデータ）のみを返す
3. 大容量データをLLMのコンテキスト外に保持

### 実装パターン

#### 1. ダウンロード専用ツール
```javascript
// src/tools/download.js の実装例
export async function downloadOSMData(overpassClient, args) {
  const { query, output_path, format = 'json' } = args;
  
  const fullQuery = format === 'json' ? 
    (query.startsWith('[out:json]') ? query : `[out:json];${query}`) :
    (query.startsWith('[out:xml]') ? query : `[out:xml];${query}`);
  
  const servers = overpassClient.servers;
  let lastError = null;
  
  for (const server of servers) {
    try {
      // utils/file-downloader.jsのdownloadToFileを使用
      const result = await downloadToFile(
        server.url,
        fullQuery,
        output_path,
        { 'Host': server.host }
      );
      
      // LLMにはメタデータのみを返す
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: 'データをダウンロードしました',
            file: output_path,           // ファイルパス
            size: result.size,           // ファイルサイズ
            server: server.host          // 使用したサーバー
          }, null, 2)
        }]
      };
    } catch (error) {
      lastError = error;
    }
  }
  
  throw new Error(`All servers failed: ${lastError?.message}`);
}
```

#### 2. オプションのファイル出力機能
```javascript
// src/tools/buildings.js の実装例
export async function getBuildings(overpassClient, args) {
  const { minLon, minLat, maxLon, maxLat, building_type = 'all', limit, output_path } = args;
  
  // 入力検証とクエリ構築
  const validation = validateCommonInputs(args);
  const normalizedLimit = validation.normalizedLimit;
  
  let buildingFilter = building_type !== 'all' ? `["building"="${building_type}"]` : '["building"]';
  const outStatement = normalizedLimit ? `out body ${normalizedLimit};` : 'out body;';
  
  const query = `[timeout:180][maxsize:1073741824];
(
  way${buildingFilter}(${minLat},${minLon},${maxLat},${maxLon});
);
${outStatement}
>;
out skel qt;`;
  
  if (output_path) {
    // ファイル保存モード：utils/file-downloader.jsのexecuteGeoJSONQueryを使用
    if (!output_path.endsWith('.geojson')) {
      throw new Error('ファイル出力は .geojson 形式のみサポートしています。');
    }
    
    const result = await executeGeoJSONQuery(overpassClient, query, output_path);
    
    // メタデータのみを返す
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'success',
          message: '建物データをダウンロードしました',
          file: output_path,
          size: result.size,
          feature_count: result.feature_count,  // 地物数
          limit_applied: normalizedLimit,
          is_truncated: normalizedLimit ? result.feature_count >= normalizedLimit : false,
          building_type: building_type,
          bbox: [minLon, minLat, maxLon, maxLat],    // 境界ボックス
          server: result.server
        }, null, 2)
      }]
    };
  } else {
    // 従来モード：データを直接返す
    const osmData = await overpassClient.query(`[out:json];${query}`, false, 'get_buildings');
    const geojson = osmToGeoJSON(osmData);
    
    const response = createGeoJSONResponse(geojson, {
      building_type: building_type,
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
  }
}
```

## 技術的詳細

### ストリーミング保存の実装
```javascript
// src/utils/file-downloader.js の実装
export async function downloadToFile(url, query, outputPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(query),
        'User-Agent': 'OSM-MCP/1.0',
        ...headers
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      // ディレクトリ作成
      const dir = path.dirname(outputPath);
      fs.mkdir(dir, { recursive: true }).then(() => {
        const writeStream = createWriteStream(outputPath);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          // 1MBごとに進行状況を出力
          if (downloadedBytes > 0 && downloadedBytes % (1024 * 1024) === 0) {
            console.error(`Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
          }
        });

        // ストリーミングでファイル書き込み
        res.pipe(writeStream);
        
        writeStream.on('finish', () => {
          const sizeMB = (downloadedBytes / 1024 / 1024).toFixed(2);
          resolve({ 
            success: true, 
            path: outputPath, 
            size: `${sizeMB} MB`,
            bytes: downloadedBytes 
          });
        });

        writeStream.on('error', reject);
      }).catch(reject);
    });
    
    req.on('error', reject);
    req.setTimeout(300000); // 5分のタイムアウト
    req.write(query);
    req.end();
  });
}
```

### メタデータの設計
```javascript
// 効果的なメタデータ構造
const metadata = {
  status: 'success',           // 処理結果
  message: '説明文',           // 人間可読メッセージ
  file: './path/to/file',      // ファイルパス
  size: '1.23 MB',             // ファイルサイズ
  feature_count: 456,          // データ件数（該当する場合）
  bbox: [minLon, minLat, maxLon, maxLat],  // 空間範囲
  server: 'overpass-api.de',   // データソース
  timestamp: '2025-01-01T00:00:00Z'  // 処理時刻
};
```

## 利点

### 1. トークン消費の大幅削減
- 大容量データをLLMコンテキストから除外
- メタデータのみで十分な情報提供
- コスト削減：最大90%以上のトークン節約可能

### 2. パフォーマンス向上
- LLMの応答速度向上（コンテキストが軽量）
- 大容量データでも安定動作
- メモリ使用量の最適化

### 3. 柔軟なデータ活用
- ファイルとして後続処理可能
- 必要に応じてデータを再読み込み
- 分析ツールとの連携が容易

### 4. エラー耐性向上
- 巨大データによるLLMエラーを回避
- タイムアウトリスクの低減
- デバッグ情報の簡素化

## 他の開発者への実装アドバイス

### 1. ツール設計の指針
- **ダウンロード専用ツール**: 大容量データを扱う場合に推奨
- **オプション機能**: 既存ツールにファイル出力オプションを追加
- **ハイブリッドアプローチ**: 小容量は直接返却、大容量はファイル保存

### 2. 実装時の考慮点
```javascript
// 推奨パターン
function createToolResponse(data, metadata) {
  if (shouldSaveToFile(data)) {
    // ファイル保存
    const filePath = await saveToFile(data);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          file: filePath,
          ...metadata
        })
      }]
    };
  } else {
    // 直接返却
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data)
      }]
    };
  }
}
```

### 3. 閾値の設定
- **データサイズ**: 1MB以上でファイル保存推奨
- **件数**: 1000件以上の地物データでファイル保存
- **ユーザーの選択**: `output_path` パラメータで制御

### 4. セキュリティと信頼性
- ファイルパスの検証（ディレクトリトラバーサル防止）
- 適切なエラーハンドリング
- 一時ファイルのクリーンアップ
- ファイル権限の適切設定

### 5. ユーザー体験の向上
- 明確なメッセージ（「データを保存しました」）
- ファイルパスの表示
- サイズと件数の情報提供
- 後続処理の案内


## 6. LLMからMCPツールを使用するフロー

このプロジェクトのMCPサーバーは、LLM（Large Language Model）がツールを呼び出すことで、OpenStreetMap（OSM）のGeoJSONデータをダウンロードし、ファイルとして保存することができます。以下に、そのフローを説明します。

### フロー概要

1. **LLMのクエリ**: LLMがユーザーのクエリに基づいて、MCPサーバーのツールを呼び出す。例えば、「指定したエリアのOSMデータをダウンロードしてGeoJSONファイルとして保存せよ」というクエリ。

2. **ツール呼び出し**: LLMはMCPプロトコルを通じて、サーバーのツール（例: `download_osm_geojson`）を呼び出し、パラメータ（例: 緯度経度範囲やエリア名）を渡す。

3. **データダウンロード**: ツールが実行され、OpenStreetMap APIや関連サービスから指定されたエリアのデータを取得。データはGeoJSON形式で取得される。

4. **ファイル保存**: 取得したGeoJSONデータが、指定されたパス（例: `/path/to/output.geojson`）にファイルとして保存される。

5. **応答**: LLMはツールの実行結果を受け取り、ユーザーに結果を報告。例えば、「データが正常にダウンロードされ、ファイルに保存されました」と応答。

### 使用例

- **データ取得ツール**: `get_buildings`, `get_roads`, `get_amenities`等
  - パラメータ: `minLon`, `minLat`, `maxLon`, `maxLat` (境界ボックス), `output_path` (出力ファイルパス・オプション)
  - 結果: 指定エリア内のデータがGeoJSONとして保存、またはJSON応答として返却

- **専用ダウンロードツール**: `download_osm_data`, `download_area_all`
  - パラメータ: `query` (Overpass QL) または境界ボックス, `output_path` (出力ファイルパス・必須)
  - 結果: ダウンロードしたデータをファイル保存、メタデータを応答として返却

このフローにより、LLMは直接コードを書かずにOSMデータを扱うことができます。


## まとめ

このプロジェクトのアプローチにより、MCPサーバーでの大容量データ取得時のトークン消費問題を効果的に解決しています。外部APIからのデータ取得を伴うMCPツール開発時には、以下の原則を適用してください：

1. **データサイズを評価**: 大容量データの場合はファイル保存を検討
2. **メタデータを設計**: ファイルパスと要約情報を効果的に提供
3. **オプション機能**: ユーザーが選択できる柔軟性を提供
4. **パフォーマンス最適化**: ストリーミング処理で効率化

この手法により、LLMとの統合がスムーズになり、コスト効果の高いMCPサーバーを構築できます。
