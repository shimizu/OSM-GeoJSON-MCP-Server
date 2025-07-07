# CLAUDE.md

このファイルは、このリポジトリでClaude Code (claude.ai/code)が作業を行う際のガイダンスを提供します。

## プロジェクト概要

OpenStreetMapのデータをOverpass API経由で取得し、GeoJSON形式で返すMCP (Model Context Protocol)サーバーです。モジュラーアーキテクチャを採用し、8つの包括的な地理データ取得ツールを提供しています。

## 主要コンポーネント

- **エントリーポイント**: `src/index.js` - アプリケーション起動点
- **メインサーバー**: `src/server/OSMGeoJSONServer.js` - 核となるMCPサーバー実装
- **ツールモジュール**: `src/tools/` - 各地理データ取得ツールの独立実装
- **共通ユーティリティ**: `src/utils/` - 再利用可能なコンポーネント
- **設定管理**: `src/server/config.js` - サーバー設定の集約
- **データフロー**: Overpass API → OSM XML/JSON → GeoJSON変換 → MCP応答

## 開発コマンド

### サーバー起動
```bash
# メインサーバーを実行
npm start
# または
node src/index.js

# MCP Inspectorでテスト（開発時推奨）
npm run dev
# または
npx @modelcontextprotocol/inspector node src/index.js
```

### テスト
```bash
# シンプルな接続テストを実行
npm run test:simple
# または
node test/simple-test.js

# 詳細なネットワーク診断を実行
npm run test:diagnostic
# または
node test/network-diagnostic.js
```

### 依存関係
```bash
# 依存関係をインストール
npm install
```

## アーキテクチャ詳細

### ディレクトリ構造
```
src/
├── index.js                    # エントリーポイント
├── server/
│   ├── OSMGeoJSONServer.js    # メインサーバークラス
│   └── config.js              # サーバー設定
├── tools/
│   ├── index.js               # ツール統合・エクスポート
│   ├── buildings.js           # 建物取得ツール
│   ├── roads.js               # 道路取得ツール
│   ├── amenities.js           # アメニティ取得ツール
│   ├── waterways.js           # 水域取得ツール
│   ├── greenspaces.js         # 緑地取得ツール
│   ├── railways.js            # 鉄道取得ツール
│   ├── boundaries.js          # 境界線取得ツール
│   └── test_connection.js     # 接続テストツール
└── utils/
    ├── overpass.js            # Overpass API通信
    ├── converter.js           # OSM→GeoJSON変換
    └── validator.js           # 入力検証
```

### MCP統合
- `@modelcontextprotocol/sdk`を使用したMCPプロトコル実装
- 8つのツールを提供:
  - `test_connection`: Overpass API接続テスト
  - `get_buildings`: 建物データ取得
  - `get_roads`: 道路ネットワーク取得
  - `get_amenities`: 施設・アメニティ取得
  - `get_waterways`: 水域・河川データ取得
  - `get_green_spaces`: 緑地・公園データ取得
  - `get_railways`: 鉄道データ取得
  - `get_boundaries`: 境界線データ取得
- すべてのツールはMCP応答形式でラップされたGeoJSONを返す

### ネットワークアーキテクチャ
- **マルチサーバーフォールバック**: 3つのOverpass APIサーバーでラウンドロビン選択
- **IP直接接続**: DNS問題を回避するため直接IPアドレスを使用
- **カスタムHTTPSクライアント**: Node.js `https`モジュールとカスタムヘッダー、タイムアウト処理
- **証明書処理**: IP直接接続用の`rejectUnauthorized: false`

### データ処理
- **OSMからGeoJSONへの変換**: カスタム`osmToGeoJSON()`メソッド
- **ジオメトリ処理**: OSMノード/ウェイをPoint/LineString/Polygonに変換
- **座標マッピング**: ウェイ再構築のためのノードIDと座標のマッピング構築

### エラー処理
- **サーバーフェイルオーバー**: 諦める前にすべてのサーバーを試行
- **レート制限**: 429エラーを検出してバックオフを実装
- **クエリ検証**: タイムアウトを防ぐため境界ボックスサイズをチェック

## 重要な実装メモ

### Overpass API仕様
- クエリ形式: Overpass QL (Query Language)
- タイムアウト: クエリあたり60秒
- 境界ボックス形式: `(minLat,minLon,maxLat,maxLon)`
- エリア制限警告: 0.001平方度以上

### GeoJSON出力形式
すべてのツールは構造化された応答を返します:
```json
{
  "type": "geojson",
  "data": { /* GeoJSON FeatureCollection */ },
  "summary": {
    "feature_count": number,
    "bbox": [minLon, minLat, maxLon, maxLat],
    /* タイプ固有のフィールド */
  }
}
```

### ネットワーク設定
- **サーバー**: IPアドレス付きの3つのハードコードされたOverpass APIサーバー
- **ヘッダー**: 証明書検証用のカスタムHostヘッダー
- **タイムアウト**: APIリクエストは60秒
- **User-Agent**: "OSM-MCP/1.0"

## 開発ガイドライン

### 新ツールの追加
1. `src/tools/`に新しいファイルを作成（例: `newfeature.js`）
2. ツールスキーマと実装関数をエクスポート
3. `src/tools/index.js`にインポート・登録
4. 共通ユーティリティ（validation、conversion）を使用
5. 既存パターンに従ったエラーハンドリングを実装

### コードパターン
```javascript
// 新ツールのテンプレート
import { validateCommonInputs } from '../utils/validator.js';
import { osmToGeoJSON, createGeoJSONResponse } from '../utils/converter.js';

export const newToolSchema = {
  name: 'get_new_feature',
  description: '説明...',
  inputSchema: { /* スキーマ定義 */ }
};

export async function getNewFeature(overpassClient, args) {
  validateCommonInputs(args);
  const query = `/* Overpass QLクエリ */`;
  
  try {
    const osmData = await overpassClient.query(query);
    const geojson = osmToGeoJSON(osmData);
    const response = createGeoJSONResponse(geojson, { /* サマリー */ });
    
    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }] };
  }
}
```
4. エラーハンドリング付きのMCP形式応答を返す

### テスト手順
1. `test_connection`ツールでAPI接続を確認
2. 最初は小さな境界ボックスでテスト（0.005° × 0.005°）
3. インタラクティブテストにはMCP Inspectorを使用（`npm run dev`）
4. 成功とエラーの両方のケースをチェック

### モジュール間の関係
- **OverpassClient** (`utils/overpass.js`): すべてのツールで共有
- **converter.js**: OSM→GeoJSON変換とレスポンス生成
- **validator.js**: 共通の入力検証ロジック
- **tools/index.js**: ツールの統合と実行ディスパッチ

### パフォーマンス考慮事項
- 大きな境界ボックスはタイムアウトを引き起こす
- 建物クエリは道路クエリより高コスト
- リレーション処理（境界線など）は複雑
- クエリの複雑さとエリアサイズのバランスを考慮

## 利用可能なツール詳細

### 基本ツール
- `test_connection`: API接続テスト
- `get_buildings`: 建物データ（住宅、商業、工業、公共）
- `get_roads`: 道路ネットワーク（高速道路〜住宅街）
- `get_amenities`: 施設・POI（レストラン、病院、学校など）

### 新規追加ツール
- `get_waterways`: 水域（川、湖、運河、貯水池など）
- `get_green_spaces`: 緑地（公園、森林、農地、草地など）
- `get_railways`: 鉄道（線路、駅、地下鉄、トラムなど）
- `get_boundaries`: 境界線（国境、都道府県境、市区町村境など）

## トラブルシューティング

### よくある問題
1. **座標エラー**: `minLat >= maxLat`のような順序間違い（正しくは南→北）
2. **接続失敗**: `npm run test:diagnostic`で詳細診断
3. **タイムアウト**: 境界ボックスサイズを縮小またはフィルター追加
4. **空の結果**: 座標順序とエリアカバレッジを確認
5. **レート制限**: リクエスト間の待機、指数バックオフの実装

### デバッグツール
- `npm run test:simple`: 基本的な接続テスト
- `npm run test:diagnostic`: 包括的なネットワーク分析
- `npm run dev`: MCP Inspectorでインタラクティブテスト

### モジュール別のデバッグ
- **overpass.js**: サーバー接続とフェイルオーバー
- **converter.js**: OSMデータ変換とジオメトリ処理
- **validator.js**: 入力検証とエラーメッセージ
- **各ツール**: 特定のOverpass QLクエリとフィルター