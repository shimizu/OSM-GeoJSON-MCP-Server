# 処理フロー

このドキュメントは、LLM (大規模言語モデル) がこのMCPサーバーを呼び出し、OpenStreetMapからデータを取得して最終的にファイルとして保存されるまでの一連の処理フローを解説します。特に、各ステップで `src/utils/` 配下のユーティリティがどのように使用されるかを明確にすることを目的としています。

## 概要

全体的な流れは以下の通りです。
1.  LLMがMCPプロトコルで利用可能ツール一覧を取得します。
2.  サーバーは12個のツールスキーマ（機能・パラメータ定義）を返却します。
3.  LLMがユーザーリクエストに基づいて最適なツールを自動選択します。
4.  サーバーは選択されたツール（例：`get_buildings`）を実行します。
5.  ツールは、キャッシュ確認、Overpass API問い合わせ、データ取得を行います。
6.  取得したデータをGeoJSON形式に変換します。
7.  変換したデータをファイルに保存し、そのパスをLLMに返却します。

---

## 詳細フロー

### 1. リクエスト受信 (Request Reception)

-   **担当ファイル:** `src/index.js`, `src/server/OSMGeoJSONServer.js`
-   **処理内容:**
    -   `index.js`がアプリケーションを起動し、`OSMGeoJSONServer`のインスタンスを生成します。
    -   LLMからMCP経由でツール実行リクエスト（例: `download`ツールで特定の地域の建物を取得）がサーバーに到着します。

### 2. ツール発見とスキーマ提供 (Tool Discovery and Schema Provision)

-   **担当ファイル:** `src/server/OSMGeoJSONServer.js`, `src/tools/index.js`
-   **処理内容:**
    -   LLMは利用可能なツールを発見するため、MCPプロトコルで`list_tools`リクエストを送信します
    -   **`OSMGeoJSONServer`**の`ListToolsRequestSchema`ハンドラーが応答し、`src/tools/index.js`の`toolSchemas`配列を返します
    -   この配列には全12個のツールスキーマ（`get_buildings`, `get_roads`, `download_osm_data`等）が含まれます
    -   各スキーマには以下が定義されています：
        - `name`: ツール名（例: `get_buildings`）
        - `description`: 機能説明（「建物データを取得します」等）
        - `inputSchema`: 必須パラメータ（`minLon`, `minLat`等）と型定義

### 3. LLMによるツール選択 (LLM Tool Selection)

-   **処理内容:**
    -   LLMは受け取ったスキーマリストから、ユーザーのリクエストに最適なツールを**自動選択**します
    -   選択基準：
        - **機能マッチング**: 「建物データが欲しい」→ `get_buildings`
        - **出力形式**: 「ファイルに保存」→ `output_path`パラメータ付きで呼び出し
        - **データ範囲**: 座標指定があれば境界ボックスパラメータを設定
    -   例：「東京の建物をファイル保存」→ `get_buildings` + `output_path`パラメータ

### 4. ツール実行とパラメータ検証 (Tool Execution and Parameter Validation)

-   **担当ファイル:** `src/server/OSMGeoJSONServer.js`, `src/tools/index.js`
-   **処理内容:**
    -   LLMが選択したツール名とパラメータでMCP `call_tool`リクエストを送信
    -   **`OSMGeoJSONServer`**の`CallToolRequestSchema`ハンドラーが受信
    -   **`tools/index.js`**の`executeTool`関数がツール名でハンドラー関数をルックアップ
    -   **`toolHandlers`**オブジェクトから対応する実装関数（例：`getBuildings`）を取得・実行
    -   **`utils/validator.js`**: 各ツール内で`validateCommonInputs()`が座標・制限値等を検証

### 5. キャッシュ確認 (Cache Check)

-   **担当ファイル:** `src/tools/download.js`等
-   **処理内容:**
    -   **`utils/cache.js`**: ネットワークリクエストを発行する前に、同じクエリパラメータでのリクエストが過去に実行されていないかキャッシュを確認します。キャッシュが存在すれば、その結果（ファイルパス）を返し、処理はステップ9にジャンプします。

### 6. データ取得 (Data Acquisition)

-   **担当ファイル:** 各ツール（`src/tools/buildings.js`等）
-   **処理内容:**
    -   キャッシュが存在しない場合、選択されたツールがOverpass APIへの問い合わせを実行します。
    -   **`utils/overpass.js`**: ステップ4で検証されたパラメータを基に、Overpass QL (Query Language) を動的に生成し、Overpass APIサーバーにHTTPリクエストを送信してOSMデータをダウンロードします。

### 7. データ変換 (Data Conversion)

-   **担当ファイル:** `src/tools/convert.js` (内部的に利用)
-   **処理内容:**
    -   **`utils/converter.js`**: `overpass.js`がOverpass APIから取得したOSMデータ（通常はXMLまたはJSON形式）を、標準的な地理空間データフォーマットであるGeoJSON形式に変換します。

### 8. ファイル保存 (File Saving)

-   **担当ファイル:** 各ツール（`output_path`指定時）
-   **処理内容:**
    -   **`utils/file-downloader.js`**: ステップ7で変換されたGeoJSONデータを、一意のファイル名を持つファイル（`.geojson`）としてファイルシステム上に保存します。また、このタイミングで`utils/cache.js`を呼び出し、新しい結果をキャッシュに保存します。

### 9. レスポンス返却 (Response Return)

-   **担当ファイル:** `src/server/OSMGeoJSONServer.js`
-   **処理内容:**
    -   `OSMGeoJSONServer`は、ステップ6で保存されたファイルの絶対パスを含む成功メッセージを生成し、MCPレスポンスとしてLLMに返却します。

---

## 横断的なユーティリティ (Cross-cutting Utilities)

-   **`utils/logger.js`**: 上記のすべてのステップ（1〜7）において、処理の進捗、デバッグ情報、エラーメッセージなどをコンソールやログファイルに記録するために、各モジュールから随時呼び出されます。
