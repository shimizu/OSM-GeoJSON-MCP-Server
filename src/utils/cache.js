// cache.js
// OSM APIクエリのキャッシュ機能
// Overpass API使用規約に準拠したキャッシュ実装

import crypto from 'crypto';

export class QueryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;  // 最大キャッシュエントリ数
    this.ttl = options.ttl || 15 * 60 * 1000;  // 15分のTTL（規約推奨）
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000;  // 5分ごとのクリーンアップ
    
    // 定期的なクリーンアップ
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  // クエリのハッシュ値を生成
  generateKey(query) {
    return crypto.createHash('sha256').update(query).digest('hex');
  }

  // キャッシュから取得
  get(query) {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // TTLをチェック
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // アクセス時刻を更新（LRU）
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  // キャッシュに保存
  set(query, data) {
    const key = this.generateKey(query);
    const now = Date.now();
    
    // キャッシュサイズ制限チェック
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // 最も古いエントリを削除（LRU）
      this.evictOldest();
    }
    
    this.cache.set(key, {
      data,
      timestamp: now,
      lastAccessed: now
    });
  }

  // 最も古いエントリを削除
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // 期限切れエントリのクリーンアップ
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.error(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  // キャッシュ統計情報
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key: key.substring(0, 8) + '...',
        timestamp: entry.timestamp,
        lastAccessed: entry.lastAccessed,
        age: Date.now() - entry.timestamp
      }))
    };
  }

  // キャッシュをクリア
  clear() {
    this.cache.clear();
  }

  // クリーンアップタイマーを停止
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}