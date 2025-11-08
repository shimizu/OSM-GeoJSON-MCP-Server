# 処理フロー

このドキュメントは、LLM (大規模言語モデル) がこのMCPサーバーを呼び出し、OpenStreetMapからデータを取得して最終的にファイルとして保存されるまでの一連の処理フローを解説します。特に、各ステップで `src/utils/` 配下のユーティリティがどのように使用されるかを明確にすることを目的としています。

## 概要

全体的な流れは以下の通りです。
1.  LLMがMCPプロトコルを通じてサーバーにリクエストを送信します。
2.  サーバーはリクエストを解釈し、指定されたツールを実行します。
3.  ツールは、キャッシュの確認、Overpass APIへの問い合わせ、データ取得を行います。
4.  取得したデータをGeoJSON形式に変換します。
5.  変換したデータをファイルに保存し、そのパスをLLMに返却します。

---

## 詳細フロー

### 1. リクエスト受信 (Request Reception)

-   **担当ファイル:** `src/index.js`, `src/server/OSMGeoJSONServer.js`
-   **処理内容:**
    -   `index.js`がアプリケーションを起動し、`OSMGeoJSONServer`のインスタンスを生成します。
    -   LLMからMCP経由でツール実行リクエスト（例: `download`ツールで特定の地域の建物を取得）がサーバーに到着します。

### 2. ツール実行とプロンプト解析 (Tool Execution and Prompt Parsing)

-   **担当ファイル:** `src/tools/index.js`, `src/tools/download.js` (または他のツール)
-   **処理内容:**
    -   `OSMGeoJSONServer`は、リクエストで指定されたツール（例: `download`）を`src/tools/`から選択して実行します。
    -   **`utils/prompt-parser.js`**: この段階で、LLMからの自然言語に近いプロンプトや引数を解析し、Overpass APIクエリに必要な具体的なパラメータ（BBOX、タグなど）を抽出します。
    -   **`utils/validator.js`**: 解析されたパラメータが有効かどうか（例: BBOXの形式が正しいか、必須タグが含まれているか）を検証します。不正な場合はエラーを返します。

### 3. キャッシュ確認 (Cache Check)

-   **担当ファイル:** `src/tools/download.js`
-   **処理内容:**
    -   **`utils/cache.js`**: ネットワークリクエストを発行する前に、同じクエリパラメータでのリクエストが過去に実行されていないかキャッシュを確認します。キャッシュが存在すれば、その結果（ファイルパス）を返し、処理はステップ7にジャンプします。

### 4. データ取得 (Data Acquisition)

-   **担当ファイル:** `src/tools/download.js`
-   **処理内容:**
    -   キャッシュが存在しない場合、`download.js`はOverpass APIへの問い合わせを実行します。
    -   **`utils/overpass.js`**: ステップ2で解析・検証されたパラメータを基に、Overpass QL (Query Language) を動的に生成し、Overpass APIサーバーにHTTPリクエストを送信してOSMデータをダウンロードします。

### 5. データ変換 (Data Conversion)

-   **担当ファイル:** `src/tools/convert.js` (内部的に利用)
-   **処理内容:**
    -   **`utils/converter.js`**: `overpass.js`がOverpass APIから取得したOSMデータ（通常はXMLまたはJSON形式）を、標準的な地理空間データフォーマットであるGeoJSON形式に変換します。

### 6. ファイル保存 (File Saving)

-   **担当ファイル:** `src/tools/download.js`
-   **処理内容:**
    -   **`utils/file-handler.js`**: ステップ5で変換されたGeoJSONデータを、一意のファイル名を持つファイル（`.geojson`）としてファイルシステム上に保存します。また、このタイミングで`utils/cache.js`を呼び出し、新しい結果をキャッシュに保存します。

### 7. レスポンス返却 (Response Return)

-   **担当ファイル:** `src/server/OSMGeoJSONServer.js`
-   **処理内容:**
    -   `OSMGeoJSONServer`は、ステップ6で保存されたファイルの絶対パスを含む成功メッセージを生成し、MCPレスポンスとしてLLMに返却します。

---

## 横断的なユーティリティ (Cross-cutting Utilities)

-   **`utils/logger.js`**: 上記のすべてのステップ（1〜7）において、処理の進捗、デバッグ情報、エラーメッセージなどをコンソールやログファイルに記録するために、各モジュールから随時呼び出されます。
