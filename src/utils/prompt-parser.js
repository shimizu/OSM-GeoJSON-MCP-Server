// prompt-parser.js
// プロンプト解析ユーティリティ - 件数制限などの指示を抽出

/**
 * プロンプトから件数制限を解析する
 * @param {string} prompt - 解析対象のプロンプト文字列
 * @returns {number|null} - 制限件数（見つからない場合はnull）
 */
export function parseLimit(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return null;
  }

  // 日本語パターン
  const japanesePatterns = [
    /最大(\d+)件/,
    /(\d+)件まで/,
    /(\d+)件以内/,
    /上限(\d+)件/,
    /(\d+)件程度/,
    /(\d+)個まで/,
    /最大(\d+)個/,
    /(\d+)個以内/,
    /(\d+)つまで/,
    /最大(\d+)つ/,
    /(\d+)つ以内/
  ];

  // 英語パターン
  const englishPatterns = [
    /limit\s+(\d+)/i,
    /max\s+(\d+)/i,
    /maximum\s+(\d+)/i,
    /up\s+to\s+(\d+)/i,
    /top\s+(\d+)/i,
    /first\s+(\d+)/i,
    /only\s+(\d+)/i,
    /at\s+most\s+(\d+)/i,
    /no\s+more\s+than\s+(\d+)/i
  ];

  // 全パターンを統合
  const allPatterns = [...japanesePatterns, ...englishPatterns];

  // 各パターンをテスト
  for (const pattern of allPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      const limit = parseInt(match[1], 10);
      // 妥当な範囲内の数値かチェック
      if (limit > 0 && limit <= 10000) {
        return limit;
      }
    }
  }

  return null;
}

/**
 * プロンプトから複数の指示を解析する
 * @param {string} prompt - 解析対象のプロンプト文字列
 * @returns {object} - 解析結果のオブジェクト
 */
export function parsePrompt(prompt) {
  const result = {
    limit: null,
    sortBy: null,
    format: null,
    urgency: null
  };

  if (!prompt || typeof prompt !== 'string') {
    return result;
  }

  // 件数制限の解析
  result.limit = parseLimit(prompt);

  // ソート指示の解析
  if (/新しい順|最新順|newest|recent/i.test(prompt)) {
    result.sortBy = 'newest';
  } else if (/古い順|oldest|old/i.test(prompt)) {
    result.sortBy = 'oldest';
  } else if (/大きい順|largest|big/i.test(prompt)) {
    result.sortBy = 'largest';
  } else if (/小さい順|smallest|small/i.test(prompt)) {
    result.sortBy = 'smallest';
  } else if (/近い順|closest|near/i.test(prompt)) {
    result.sortBy = 'closest';
  }

  // フォーマット指示の解析
  if (/\.geojson|geojson形式/i.test(prompt)) {
    result.format = 'geojson';
  } else if (/\.json|json形式/i.test(prompt)) {
    result.format = 'json';
  }

  // 緊急度の解析
  if (/急いで|急ぎ|すぐに|早急に|urgent|quickly|asap/i.test(prompt)) {
    result.urgency = 'high';
  } else if (/ゆっくり|時間をかけて|slow|carefully/i.test(prompt)) {
    result.urgency = 'low';
  }

  return result;
}

/**
 * 制限値の妥当性をチェック
 * @param {number} limit - チェック対象の制限値
 * @returns {object} - 検証結果
 */
export function validateParsedLimit(limit) {
  if (limit === null || limit === undefined) {
    return { isValid: true, normalizedLimit: null };
  }

  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    return { 
      isValid: false, 
      error: '制限値は整数である必要があります' 
    };
  }

  if (limit < 1) {
    return { 
      isValid: false, 
      error: '制限値は1以上である必要があります' 
    };
  }

  if (limit > 10000) {
    return { 
      isValid: false, 
      error: '制限値は10000以下である必要があります（サーバー負荷を考慮）' 
    };
  }

  // 推奨値の範囲をチェック
  const warnings = [];
  if (limit > 1000) {
    warnings.push('1000件を超える取得は時間がかかる可能性があります');
  }

  return { 
    isValid: true, 
    normalizedLimit: limit,
    warnings 
  };
}

/**
 * プロンプトからクエリ最適化のヒントを抽出
 * @param {string} prompt - 解析対象のプロンプト文字列
 * @returns {object} - 最適化ヒント
 */
export function extractOptimizationHints(prompt) {
  const hints = {
    preferCache: false,
    preferSpeed: false,
    preferAccuracy: false,
    expectedSize: null
  };

  if (!prompt || typeof prompt !== 'string') {
    return hints;
  }

  // キャッシュ優先指示
  if (/キャッシュ|cache|cached/i.test(prompt)) {
    hints.preferCache = true;
  }

  // 速度優先指示
  if (/速い|早い|高速|fast|quick|speed/i.test(prompt)) {
    hints.preferSpeed = true;
  }

  // 精度優先指示
  if (/正確|精密|詳細|accurate|precise|detailed/i.test(prompt)) {
    hints.preferAccuracy = true;
  }

  // 期待されるデータサイズ
  if (/少しだけ|少し|small|little/i.test(prompt)) {
    hints.expectedSize = 'small';
  } else if (/たくさん|多く|large|many/i.test(prompt)) {
    hints.expectedSize = 'large';
  }

  return hints;
}

/**
 * デバッグ用：解析結果を表示
 * @param {string} prompt - 元のプロンプト
 * @param {object} parsed - 解析結果
 */
export function debugParseResult(prompt, parsed) {
  console.log('--- Prompt Parse Debug ---');
  console.log('Original:', prompt);
  console.log('Parsed:', JSON.stringify(parsed, null, 2));
  console.log('--- End Debug ---');
}