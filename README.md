# OSM GeoJSON MCP Server

OpenStreetMap（OSM）のデータをGeoJSON形式で取得するMCP（Model Context Protocol）サーバーです。Overpass APIを使用して、指定された地理的範囲内の建物、道路、施設などの地理データを取得できます。

## 特徴

- 🏢 **建物データの取得** - 住宅、商業施設、工業施設などの建物の輪郭をポリゴンとして取得
- 🛣️ **道路ネットワークの取得** - 高速道路から住宅街の道路まで、様々なタイプの道路をラインストリングとして取得
- 📍 **施設（アメニティ）の取得** - レストラン、病院、学校などのPOI（Point of Interest）データを取得
- 🌏 **標準的なGeoJSON形式** - Leaflet、Mapbox、QGISなどの一般的なGISツールで直接利用可能

## 必要な環境

- Node.js 18以上
- npm または yarn

## インストール

1. リポジトリをクローンまたはダウンロード

```bash
git clone <repository-url>
cd osm-geojson-mcp-server
```

2. 依存関係をインストール

```bash
npm install
```

## 使用方法

### 基本的な起動方法

```bash
node osm-geojson-mcp.js
```

### MCP Inspectorでのテスト

開発・デバッグには[MCP Inspector](https://github.com/modelcontextprotocol/inspector)の使用を推奨します：

```bash
npx @modelcontextprotocol/inspector node osm-geojson-mcp.js
```

ブラウザで http://localhost:5173 にアクセスしてツールをテストできます。

### Claude Desktopでの使用

1. Claude Desktopの設定ファイルを開きます：
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. 以下の設定を追加：

```json
{
  "mcpServers": {
    "osm-geojson": {
      "command": "node",
      "args": ["/path/to/your/osm-geojson-mcp.js"]
    }
  }
}
```

3. Claude Desktopを再起動

## 利用可能なツール

### 1. test_connection
Overpass APIサーバーへの接続をテストします。

**パラメータ**: なし

**使用例**:
```json
{}
```

### 2. get_buildings
指定した矩形範囲内の建物データを取得します。

**パラメータ**:
- `minLon` (number, 必須): 最小経度（西端）
- `minLat` (number, 必須): 最小緯度（南端）
- `maxLon` (number, 必須): 最大経度（東端）
- `maxLat` (number, 必須): 最大緯度（北端）
- `building_type` (string, オプション): 建物タイプ
  - `residential`: 住宅
  - `commercial`: 商業施設
  - `industrial`: 工業施設
  - `public`: 公共施設
  - `all`: すべて（デフォルト）

**使用例**:
```json
{
  "minLon": 139.765,
  "minLat": 35.680,
  "maxLon": 139.770,
  "maxLat": 35.685,
  "building_type": "all"
}
```

### 3. get_roads
指定した矩形範囲内の道路ネットワークを取得します。

**パラメータ**:
- `minLon`, `minLat`, `maxLon`, `maxLat`: 範囲指定（buildingsと同じ）
- `road_types` (array, オプション): 道路タイプのリスト
  - `motorway`: 高速道路
  - `trunk`: 国道
  - `primary`: 主要地方道
  - `secondary`: 一般都道府県道
  - `tertiary`: その他の道路
  - `residential`: 住宅地の道路
  - `all`: すべて

**使用例**:
```json
{
  "minLon": 139.765,
  "minLat": 35.680,
  "maxLon": 139.770,
  "maxLat": 35.685,
  "road_types": ["primary", "secondary"]
}
```

### 4. get_amenities
指定した矩形範囲内の施設・設備を取得します。

**パラメータ**:
- `minLon`, `minLat`, `maxLon`, `maxLat`: 範囲指定
- `amenity_type` (string, オプション): 施設タイプ
  - 例: `restaurant`, `hospital`, `school`, `bank`, `cafe`, `parking`
  - `all`: すべて（デフォルト）

**使用例**:
```json
{
  "minLon": 139.765,
  "minLat": 35.680,
  "maxLon": 139.770,
  "maxLat": 35.685,
  "amenity_type": "restaurant"
}
```

## 出力形式

すべてのツールは以下の形式でGeoJSONデータを返します：

```json
{
  "type": "geojson",
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": "way/123456",
        "properties": {
          "name": "建物名",
          "building": "yes",
          // その他のOSMタグ
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[...]]
        }
      }
    ]
  },
  "summary": {
    "feature_count": 42,
    "building_type": "all",
    "bbox": [139.765, 35.680, 139.770, 35.685]
  }
}
```

## データの可視化

取得したGeoJSONデータは以下の方法で可視化できます：

1. **付属のHTMLビューアー**: `geojson-viewer.html`をブラウザで開き、データをペースト
2. **[geojson.io](https://geojson.io)**: オンラインでGeoJSONを可視化・編集
3. **QGIS**: プロフェッショナルなGISソフトウェア
4. **Leaflet/Mapbox**: Webアプリケーションでの地図表示

## 主要な日本の地点の座標

テスト用の座標例：

| 地点 | minLon | minLat | maxLon | maxLat |
|------|--------|--------|--------|--------|
| 東京駅周辺 | 139.76 | 35.68 | 139.77 | 35.69 |
| 新宿駅周辺 | 139.695 | 35.685 | 139.705 | 35.695 |
| 渋谷駅周辺 | 139.695 | 35.655 | 139.705 | 35.665 |
| 横浜駅周辺 | 139.615 | 35.460 | 139.625 | 35.470 |
| 大阪駅周辺 | 135.495 | 34.700 | 135.505 | 34.710 |

## 注意事項

1. **エリアサイズ**: 大きなエリアを指定するとタイムアウトする可能性があります。最初は0.005度×0.005度程度の小さなエリアから始めることをお勧めします。

2. **レート制限**: Overpass APIには利用制限があります。短時間に大量のリクエストを送信しないでください。

3. **データの著作権**: OpenStreetMapのデータは[ODbL（Open Database License）](https://www.openstreetmap.org/copyright)の下で提供されています。利用時は適切なクレジット表記が必要です。

## トラブルシューティング

### 接続エラーが発生する場合

1. `test_connection`ツールを実行して接続状態を確認
2. ファイアウォールやプロキシの設定を確認
3. VPNを使用している場合は一時的に無効化してテスト

### タイムアウトエラーが発生する場合

1. より小さなエリアを指定
2. `building_type`や`road_types`でフィルタリングしてデータ量を削減
3. 時間を置いてから再試行

### データが空の場合

1. 指定したエリアに該当するデータが存在しない可能性
2. 座標の順序（西、南、東、北）を確認
3. エリアを少し広げて再試行

## 技術的な詳細

このサーバーは以下の技術を使用しています：

- **Overpass API**: OpenStreetMapデータのクエリAPI
- **MCP (Model Context Protocol)**: AIアシスタントとの統合プロトコル
- **Node.js**: サーバーランタイム
- **HTTPS with IP直接接続**: DNS解決の問題を回避

## ライセンス

このソフトウェアはMITライセンスの下で公開されています。

## 貢献

バグ報告や機能提案は、GitHubのIssuesまたはPull Requestでお願いします。

## 参考リンク

- [OpenStreetMap](https://www.openstreetmap.org/)
- [Overpass API Documentation](https://wiki.openstreetmap.org/wiki/JA:Overpass_API)
- [GeoJSON Specification](https://geojson.org/)
- [MCP Documentation](https://modelcontextprotocol.io/)
