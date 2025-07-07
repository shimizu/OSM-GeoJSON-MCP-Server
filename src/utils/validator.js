// validator.js
// 入力検証ユーティリティ

// 境界ボックスの検証
export function validateBoundingBox(minLon, minLat, maxLon, maxLat) {
  const errors = [];
  
  // 座標の有効性チェック
  if (typeof minLon !== 'number' || minLon < -180 || minLon > 180) {
    errors.push('minLon must be a number between -180 and 180');
  }
  
  if (typeof minLat !== 'number' || minLat < -90 || minLat > 90) {
    errors.push('minLat must be a number between -90 and 90');
  }
  
  if (typeof maxLon !== 'number' || maxLon < -180 || maxLon > 180) {
    errors.push('maxLon must be a number between -180 and 180');
  }
  
  if (typeof maxLat !== 'number' || maxLat < -90 || maxLat > 90) {
    errors.push('maxLat must be a number between -90 and 90');
  }
  
  // 境界ボックスの論理的妥当性チェック
  if (minLon >= maxLon) {
    errors.push('minLon must be less than maxLon');
  }
  
  if (minLat >= maxLat) {
    errors.push('minLat must be less than maxLat');
  }
  
  return errors;
}

// エリアサイズの検証と警告
export function validateAreaSize(minLon, minLat, maxLon, maxLat, maxArea = 0.001) {
  const area = (maxLon - minLon) * (maxLat - minLat);
  const warnings = [];
  
  if (area > maxArea) {
    warnings.push(`Large area detected (${area.toFixed(6)} square degrees). Consider using a smaller area to avoid timeouts.`);
  }
  
  return {
    area,
    warnings
  };
}

// フィルター値の検証
export function validateFilter(value, allowedValues) {
  if (value === undefined || value === null) {
    return { isValid: true, normalizedValue: 'all' };
  }
  
  if (typeof value === 'string') {
    if (allowedValues.includes(value)) {
      return { isValid: true, normalizedValue: value };
    } else {
      return { 
        isValid: false, 
        error: `Invalid filter value: ${value}. Allowed values: ${allowedValues.join(', ')}` 
      };
    }
  }
  
  if (Array.isArray(value)) {
    const invalidValues = value.filter(v => !allowedValues.includes(v));
    if (invalidValues.length > 0) {
      return { 
        isValid: false, 
        error: `Invalid filter values: ${invalidValues.join(', ')}. Allowed values: ${allowedValues.join(', ')}` 
      };
    }
    return { isValid: true, normalizedValue: value };
  }
  
  return { 
    isValid: false, 
    error: `Filter value must be a string or array, got ${typeof value}` 
  };
}

// 一般的な入力検証
export function validateCommonInputs(args) {
  const { minLon, minLat, maxLon, maxLat } = args;
  
  // 境界ボックスの検証
  const bboxErrors = validateBoundingBox(minLon, minLat, maxLon, maxLat);
  if (bboxErrors.length > 0) {
    throw new Error(`Invalid bounding box: ${bboxErrors.join(', ')}`);
  }
  
  // エリアサイズの検証
  const { area, warnings } = validateAreaSize(minLon, minLat, maxLon, maxLat);
  
  // 警告をコンソールに出力
  warnings.forEach(warning => {
    console.error(`Warning: ${warning}`);
  });
  
  return { area, warnings };
}