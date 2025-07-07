# CLAUDE.md

このファイルは、このリポジトリでClaude Code (claude.ai/code)が作業を行う際のガイダンスを提供します。

## プロジェクト概要

OpenStreetMapのデータをOverpass API経由で取得し、GeoJSON形式で返すMCP (Model Context Protocol)サーバーです。指定された地理的境界内の建物、道路、アメニティを取得するツールを提供しています。

## 主要コンポーネント

- **メインサーバー**: `osm-geojson-mcp.js` - 核となるMCPサーバー実装
- **クラス構造**: `OSMGeoJSONServer`クラスがすべてのMCP操作を処理
- **データフロー**: Overpass API → OSM XML/JSON → GeoJSON変換 → MCP応答
- **ネットワーク処理**: 複数のフォールバックサーバーを持つカスタムHTTPS実装

## 開発コマンド

### サーバー起動
```bash
# メインサーバーを実行
node osm-geojson-mcp.js

# MCP Inspectorでテスト（開発時推奨）
npx @modelcontextprotocol/inspector node osm-geojson-mcp.js
```

### テスト
```bash
# シンプルな接続テストを実行
node test/simple-test.js

# 詳細なネットワーク診断を実行
node test/network-diagnostic.js
```

### 依存関係
```bash
# 依存関係をインストール
npm install

# サーバー起動（package.jsonスクリプト）
npm start
```

## アーキテクチャ詳細

### MCP統合
- `@modelcontextprotocol/sdk`を使用したMCPプロトコル実装
- 4つのツールを提供: `test_connection`, `get_buildings`, `get_roads`, `get_amenities`
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

### 新機能追加時
1. `setupToolHandlers()`でツール定義を追加
2. 既存パターンに従ってハンドラーメソッドを実装
3. API呼び出しには`queryOverpass()`を使用
4. エラーハンドリング付きのMCP形式応答を返す

### 新しい変更のテスト
1. `test_connection`ツールでAPI接続を確認
2. 最初は小さな境界ボックスでテスト（0.005° × 0.005°）
3. インタラクティブテストにはMCP Inspectorを使用
4. 成功とエラーの両方のケースをチェック

### パフォーマンス考慮事項
- 大きな境界ボックスはタイムアウトを引き起こす
- 建物クエリは道路クエリより高コスト
- ウェイ処理前にノード収集が発生
- クエリの複雑さとエリアサイズを考慮

## トラブルシューティング

### よくある問題
1. **接続失敗**: network-diagnostic.jsの出力を確認
2. **タイムアウト**: 境界ボックスサイズを縮小またはフィルター追加
3. **空の結果**: 座標順序とエリアカバレッジを確認
4. **レート制限**: リクエスト間の待機、指数バックオフの実装

### デバッグツール
- `test/simple-test.js`: 基本的な接続テスト
- `test/network-diagnostic.js`: 包括的なネットワーク分析
- MCP Inspector: インタラクティブツールテスト