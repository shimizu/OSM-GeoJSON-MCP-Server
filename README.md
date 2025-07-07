# OSM GeoJSON MCP Server

OpenStreetMapのデータをOverpass API経由で取得し、GeoJSON形式で返すMCP (Model Context Protocol)サーバーです。

## 🌟 主要機能

### 🗺️ 地理データ取得ツール (8種類)
- **🏢 建物データ取得** (`get_buildings`): 住宅、商業、工業、公共建物の取得
- **🛣️ 道路ネットワーク取得** (`get_roads`): 高速道路から住宅街道路までの道路データ
- **🏪 アメニティ取得** (`get_amenities`): レストラン、病院、学校などのPOIデータ
- **🌊 水域データ取得** (`get_waterways`): 川、湖、運河、貯水池などの水域データ
- **🌳 緑地データ取得** (`get_green_spaces`): 公園、森林、農地、草地などの緑地
- **🚃 鉄道データ取得** (`get_railways`): 鉄道線路、駅、地下鉄、トラムなど

### 🔧 システム機能
- **📊 API統計** (`get_api_stats`): 使用統計、キャッシュ状況、エラー率の監視
- **🔧 接続テスト** (`test_connection`): Overpass APIサーバーへの接続診断
- **🔄 データ変換** (`convert_to_geojson`): OSMデータからGeoJSONへの変換
- **📁 ファイル出力**: 全ツールでファイルエクスポート機能 (.geojson/.json)

## 🚀 高度な機能

### 💾 キャッシュシステム
- **15分TTL**: OSM規約準拠のキャッシュ期間
- **LRUアルゴリズム**: メモリ効率的なキャッシュ管理
- **重複リクエスト防止**: 同一クエリの自動キャッシュ利用

### 📈 ログ・監視機能
- **詳細ログ**: API使用状況、応答時間、エラー率の追跡
- **統計情報**: キャッシュヒット率、サーバー別パフォーマンス
- **リアルタイム監視**: 稼働時間、リクエスト頻度の表示

### ⚡ エラーハンドリング
- **マルチサーバー対応**: 3サーバーの自動フォールバック
- **指数バックオフ**: レート制限時の適応的待機
- **5xx系エラー対応**: サーバーエラー時の自動リトライ

## 📦 インストールと使用方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. サーバーの起動

```bash
# 通常の起動
npm start

# 開発モード（MCP Inspectorを使用）
npm run dev
```

### 3. テスト実行

```bash
# 全テストを実行
npm test

# 重要なテストのみ実行
npm run test:critical

# 高速テスト（重要テスト + 早期終了）
npm run test:fast

# 個別テスト実行
npm run test:simple       # 基本接続テスト
npm run test:diagnostic   # ネットワーク診断
npm run test:features     # 新機能テスト
npm run test:download     # ダウンロード機能テスト
npm run test:direct       # 直接ファイル出力テスト
```

## 🎯 Claude での使用例

### 💬 プロンプト例

#### 📍 特定地域の建物データ取得
```
東京駅周辺（東経139.765-139.768度、北緯35.679-35.682度）の建物データをGeoJSON形式で取得してください。
```

#### 🏙️ エリア分析用データ収集
```
新宿駅周辺の以下のデータを取得してファイルに保存してください：
- 建物データ（商業施設のみ）
- 道路ネットワーク（主要道路のみ）
- レストランなどの飲食店
座標は東経139.695-139.705度、北緯35.685-35.695度でお願いします。
```

#### 🔢 件数制限付きデータ取得
```
渋谷駅周辺の建物データを最大30件まで取得してください。商業施設に限定してGeoJSONで出力をお願いします。
```

#### 📊 システム状況確認
```
OSMサーバーの接続状況とAPI使用統計を確認してください。
```

#### 🌊 河川・水域調査
```
皇居周辺（東経139.75-139.77度、北緯35.68-35.69度）の水域データ（川、堀など）を取得してください。
```

#### 🚀 高速データ取得
```
品川駅周辺の鉄道データを10件まで取得して、レスポンス時間を短縮してください。
```

### 🗺️ 地図データ活用例

#### 1. 都市計画・不動産分析
```
渋谷駅周辺500m四方の建物、道路、公園データを取得して都市密度を分析したい
```
→ 建物密度、道路アクセス、緑地率などの分析が可能

#### 2. 観光ルート作成
```
浅草寺周辺の観光スポット（レストラン、神社、公園）を50件まで取得して歩行者道路のデータも欲しい
```
→ 観光客向けの歩行ルートや見どころマップを作成

#### 3. 災害時避難計画
```
学校周辺の避難に使える道路、公園、公共施設のデータを収集したい。重要度の高い施設を20件程度で
```
→ 避難経路や避難場所の最適化に活用

#### 4. 交通インフラ調査
```
品川駅周辺の鉄道、道路、バス停のデータで交通アクセスを分析したい。主要な交通機関を15件まで
```
→ 交通利便性の評価や都市計画に活用


## 📄 レスポンス形式

### GeoJSONレスポンス（標準）

```json
{
  "type": "geojson",
  "data": {
    "type": "FeatureCollection",
    "features": [...]
  },
  "summary": {
    "feature_count": 42,
    "limit_applied": 50,
    "is_truncated": false,
    "bbox": [139.765, 35.679, 139.768, 35.682],
    "building_type": "all"
  }
}
```

### ファイル出力レスポンス

```json
{
  "status": "success",
  "message": "建物データをダウンロードしました",
  "file": "./data/tokyo_buildings.geojson",
  "size": "0.85 MB",
  "feature_count": 245,
  "limit_applied": null,
  "is_truncated": false,
  "building_type": "all",
  "bbox": [139.765, 35.679, 139.768, 35.682],
  "server": "overpass-api.de"
}
```

### API統計レスポンス

```json
{
  "timestamp": "2025-07-07T13:00:00.000Z",
  "api_statistics": {
    "uptime": { "formatted": "2h 30m" },
    "requests": { "total": 150, "perMinute": "1.2" },
    "cache": { "hitRate": "75.3%" },
    "errors": { "errorRate": "0.7%" }
  },
  "cache_statistics": { "size": 45 },
  "compliance_info": {
    "user_agent": "OSM-MCP/1.0",
    "rate_limiting": "enabled",
    "caching": "enabled (15min TTL)",
    "overpass_api_compliance": "full"
  }
}
```

## 🛠️ 利用可能なツール詳細

### 🏢 get_buildings
建物データを取得します。

**パラメータ:**
- `minLon`, `minLat`, `maxLon`, `maxLat`: 取得範囲の座標（必須）
- `building_type` (オプション): 建物タイプ (`residential`, `commercial`, `industrial`, `public`, `all`)
- `limit` (オプション): 取得件数の上限（1-10000）
- `output_path` (オプション): ファイル出力パス（.geojson/.json）

### 🛣️ get_roads
道路ネットワークを取得します。

**パラメータ:**
- `minLon`, `minLat`, `maxLon`, `maxLat`: 取得範囲の座標（必須）
- `road_types` (オプション): 道路タイプの配列 (`motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential`, `all`)
- `limit` (オプション): 取得件数の上限（1-10000）
- `output_path` (オプション): ファイル出力パス

### 🏪 get_amenities
アメニティ（施設・設備）を取得します。

**パラメータ:**
- `minLon`, `minLat`, `maxLon`, `maxLat`: 取得範囲の座標（必須）
- `amenity_type` (オプション): アメニティタイプ (`restaurant`, `hospital`, `school`, `bank`, `cafe`, `all`)
- `limit` (オプション): 取得件数の上限（1-10000）
- `output_path` (オプション): ファイル出力パス

### 🌊 get_waterways
水域・河川データを取得します。

**パラメータ:**
- `minLon`, `minLat`, `maxLon`, `maxLat`: 取得範囲の座標（必須）
- `waterway_type` (オプション): 水域タイプ (`river`, `stream`, `canal`, `lake`, `reservoir`, `pond`, `all`)
- `limit` (オプション): 取得件数の上限（1-10000）
- `output_path` (オプション): ファイル出力パス

### 🌳 get_green_spaces
緑地・公園データを取得します。

**パラメータ:**
- `minLon`, `minLat`, `maxLon`, `maxLat`: 取得範囲の座標（必須）
- `green_space_type` (オプション): 緑地タイプ (`park`, `forest`, `garden`, `farmland`, `grass`, `meadow`, `nature_reserve`, `all`)
- `limit` (オプション): 取得件数の上限（1-10000）
- `output_path` (オプション): ファイル出力パス

### 🚃 get_railways
鉄道データを取得します。

**パラメータ:**
- `minLon`, `minLat`, `maxLon`, `maxLat`: 取得範囲の座標（必須）
- `railway_type` (オプション): 鉄道タイプ (`rail`, `subway`, `tram`, `monorail`, `station`, `platform`, `all`)
- `limit` (オプション): 取得件数の上限（1-10000）
- `output_path` (オプション): ファイル出力パス

### 📊 get_api_stats
API使用統計とシステム状況を取得します。

**パラメータ:**
- `reset` (オプション): 統計をリセットするかどうか（boolean）

### 🔧 test_connection
Overpass APIサーバーへの接続をテストします。

**パラメータ:** なし

### 🔄 convert_to_geojson
OSMファイルをGeoJSONに変換します。

**パラメータ:**
- `input_path`: 入力OSMファイルパス（必須）
- `output_path`: 出力GeoJSONファイルパス（必須）

## 🔬 技術的な詳細

### OSM/Overpass API規約準拠
- **User-Agent識別**: `OSM-MCP/1.0`による適切な識別
- **レート制限遵守**: 指数バックオフとサーバー負荷分散
- **キャッシュ実装**: 15分TTLによる重複リクエスト防止
- **メモリ制限**: 1GB制限でサーバー負荷軽減
- **タイムアウト最適化**: 180秒でOverpass API推奨値準拠

### 高性能アーキテクチャ
- **マルチサーバーフォールバック**: 3サーバーの自動切り替え
- **IP直接接続**: DNS問題回避のための直接IPアドレス使用
- **非同期処理**: Node.js標準https/fsモジュールによる高効率通信
- **ストリーミング**: 大容量データの直接ファイル書き込み

### データ品質保証
- **OSM→GeoJSON変換**: カスタム変換ロジックによる高精度変換
- **ジオメトリ処理**: Point/LineString/Polygon の適切な形状生成
- **座標検証**: 境界ボックスとWGS84座標系の厳密チェック
- **メタデータ保持**: OSMタグの完全保持とGeoJSONプロパティ変換

### 監視・デバッグ機能
- **リアルタイム統計**: リクエスト数、応答時間、エラー率の追跡
- **キャッシュ分析**: ヒット率、メモリ使用量、TTL管理
- **サーバー監視**: 各Overpass APIサーバーの健全性チェック
- **包括的テスト**: 接続、機能、パフォーマンステストの自動実行

## ⚠️ 制限事項と推奨事項

### 境界ボックスサイズ
- **推奨サイズ**: 0.005° × 0.005° 以下（約500m四方）
- **最大サイズ**: 0.001平方度以下（タイムアウト防止）
- **都市部**: より小さな範囲での分割取得を推奨

### パフォーマンス考慮事項
- **建物クエリ**: 道路クエリより高コスト
- **リレーション処理**: 境界線データは複雑度が高い
- **キャッシュ活用**: 同一範囲の再取得は15分間キャッシュされる

### 利用規約遵守
- **レート制限**: 1秒あたり1リクエスト以下を推奨
- **適切な利用**: 教育・研究・非営利目的での使用
- **サーバー負荷軽減**: キャッシュ機能を積極的に活用

## 📈 パフォーマンス指標

### 実測値（東京駅周辺 0.003° × 0.003°）
- **建物データ**: 20件、4.4秒、22KB
- **道路データ**: 361件、2.1秒、129KB  
- **アメニティ**: 24件、12.6秒、4.5KB
- **キャッシュヒット**: < 1秒（75%高速化）

## 🔢 件数制限機能

### 自然言語での制限指定

プロンプトに「最大30件まで」「10件程度」「5つまで」などの表現を含めると、自動的に件数制限が適用されます：

```
東京駅周辺の建物データを最大50件まで取得してください
↓ 自動的に limit: 50 が適用される

品川駅の鉄道データを10件程度で
↓ 自動的に limit: 10 が適用される
```

### 対応する表現パターン

- **日本語**: 最大N件、N件まで、N件以内、上限N件、N個まで、Nつまで
- **英語**: limit N, max N, top N, first N, up to N

### 制限値の仕様

- **範囲**: 1-10000件
- **適用**: Overpass API レベルで効率的に制限
- **メタデータ**: レスポンスに `limit_applied` と `is_truncated` を含む
- **パフォーマンス**: 制限により高速化とメモリ効率化を実現

## 🎛️ Claude Desktop / Claude Code 設定

### Claude Desktop の設定

1. 設定ファイルを開く：
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. 以下を追加：

```json
{
  "mcpServers": {
    "osm-geojson": {
      "command": "node",
      "args": ["/absolute/path/to/osm-geojson-mcp-server/src/index.js"]
    }
  }
}
```

3. Claude Desktop を再起動

### Claude Code での使用

Claude Code では `claude mcp add` コマンドでMCPサーバーを登録します：

```bash
# プロジェクトに移動
cd /path/to/osm-geojson-mcp-server

# MCPサーバーを登録（ローカルスコープ）
claude mcp add osm-geojson node src/index.js

# または絶対パスで登録
claude mcp add osm-geojson /absolute/path/to/osm-geojson-mcp-server/src/index.js
```

**スコープオプション:**
- `--local` (デフォルト): 現在のプロジェクトのみ
- `--project`: チーム共有（.mcp.jsonに保存）
- `--user`: 複数プロジェクト間で使用

詳細は [Claude Code MCP ドキュメント](https://docs.anthropic.com/ja/docs/claude-code/mcp) を参照してください。

### 使用開始

設定完了後、Claude で以下のように話しかけてください：

```
「東京駅周辺の建物データを取得して」
「新宿の地図データを分析したい」
「OSMサーバーの接続状況を確認して」
```

Claude が自動的に適切なツールを選択してデータを取得します。

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙏 謝辞

- [OpenStreetMap](https://www.openstreetmap.org/): オープンな地理データの提供
- [Overpass API](https://overpass-api.de/): 高性能なOSMデータアクセス
- [Model Context Protocol](https://github.com/modelcontextprotocol): 統合プロトコル仕様
