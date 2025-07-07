// logger.js
// API使用状況ログとモニタリング機能

export class ApiLogger {
  constructor() {
    this.stats = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      serverFailures: new Map(),
      rateLimits: 0,
      requestsByTool: new Map(),
      requestsByHour: new Map(),
      averageResponseTime: 0,
      totalResponseTime: 0,
      startTime: Date.now()
    };
  }

  // APIリクエスト開始をログ
  logRequestStart(tool, query, server) {
    this.stats.requests++;
    
    // ツール別統計
    const toolCount = this.stats.requestsByTool.get(tool) || 0;
    this.stats.requestsByTool.set(tool, toolCount + 1);
    
    // 時間別統計
    const hour = new Date().getHours();
    const hourCount = this.stats.requestsByHour.get(hour) || 0;
    this.stats.requestsByHour.set(hour, hourCount + 1);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'request_start',
      tool,
      server,
      requestId: this.stats.requests,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
    };
    
    console.error(`[API] ${logEntry.timestamp} - Request #${logEntry.requestId} started: ${tool} on ${server}`);
    
    return {
      requestId: logEntry.requestId,
      startTime: Date.now()
    };
  }

  // APIリクエスト完了をログ
  logRequestComplete(requestInfo, success, responseSize = 0) {
    const responseTime = Date.now() - requestInfo.startTime;
    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.requests;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'request_complete',
      requestId: requestInfo.requestId,
      success,
      responseTime,
      responseSize
    };
    
    console.error(`[API] ${logEntry.timestamp} - Request #${requestInfo.requestId} completed: ${success ? 'SUCCESS' : 'FAILED'} (${responseTime}ms, ${responseSize} bytes)`);
  }

  // キャッシュヒットをログ
  logCacheHit(tool, query) {
    this.stats.cacheHits++;
    
    console.error(`[CACHE] Cache hit for ${tool}: ${query.substring(0, 50)}...`);
  }

  // キャッシュミスをログ
  logCacheMiss(tool, query) {
    this.stats.cacheMisses++;
    
    console.error(`[CACHE] Cache miss for ${tool}: ${query.substring(0, 50)}...`);
  }

  // エラーをログ
  logError(error, server, tool) {
    this.stats.errors++;
    
    // サーバー別エラー統計
    const serverErrors = this.stats.serverFailures.get(server) || 0;
    this.stats.serverFailures.set(server, serverErrors + 1);
    
    // レート制限の検出
    if (error.message.includes('429')) {
      this.stats.rateLimits++;
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      server,
      tool,
      error: error.message,
      isRateLimit: error.message.includes('429'),
      isServerError: error.message.includes('500') || error.message.includes('502') || error.message.includes('503')
    };
    
    console.error(`[ERROR] ${logEntry.timestamp} - ${server} (${tool}): ${error.message}`);
  }

  // 統計情報を取得
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const requestsPerMinute = this.stats.requests / (uptime / 60000);
    
    return {
      uptime: {
        milliseconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      requests: {
        total: this.stats.requests,
        perMinute: requestsPerMinute.toFixed(2),
        averageResponseTime: this.stats.averageResponseTime.toFixed(2) + 'ms'
      },
      cache: {
        hits: this.stats.cacheHits,
        misses: this.stats.cacheMisses,
        hitRate: this.stats.requests > 0 ? ((this.stats.cacheHits / this.stats.requests) * 100).toFixed(1) + '%' : '0%'
      },
      errors: {
        total: this.stats.errors,
        rateLimits: this.stats.rateLimits,
        errorRate: this.stats.requests > 0 ? ((this.stats.errors / this.stats.requests) * 100).toFixed(1) + '%' : '0%'
      },
      serverFailures: Object.fromEntries(this.stats.serverFailures),
      requestsByTool: Object.fromEntries(this.stats.requestsByTool),
      requestsByHour: Object.fromEntries(this.stats.requestsByHour)
    };
  }

  // 稼働時間をフォーマット
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // 統計をリセット
  resetStats() {
    this.stats = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      serverFailures: new Map(),
      rateLimits: 0,
      requestsByTool: new Map(),
      requestsByHour: new Map(),
      averageResponseTime: 0,
      totalResponseTime: 0,
      startTime: Date.now()
    };
  }

  // 詳細なログ出力
  printDetailedStats() {
    const stats = this.getStats();
    
    console.error('\n=== API Usage Statistics ===');
    console.error(`Uptime: ${stats.uptime.formatted}`);
    console.error(`Total Requests: ${stats.requests.total} (${stats.requests.perMinute}/min)`);
    console.error(`Average Response Time: ${stats.requests.averageResponseTime}`);
    console.error(`Cache Hit Rate: ${stats.cache.hitRate} (${stats.cache.hits}/${stats.cache.hits + stats.cache.misses})`);
    console.error(`Error Rate: ${stats.errors.errorRate} (${stats.errors.total}/${stats.requests.total})`);
    console.error(`Rate Limits: ${stats.errors.rateLimits}`);
    
    if (stats.serverFailures && Object.keys(stats.serverFailures).length > 0) {
      console.error('\nServer Failures:');
      for (const [server, count] of Object.entries(stats.serverFailures)) {
        console.error(`  ${server}: ${count}`);
      }
    }
    
    if (stats.requestsByTool && Object.keys(stats.requestsByTool).length > 0) {
      console.error('\nRequests by Tool:');
      for (const [tool, count] of Object.entries(stats.requestsByTool)) {
        console.error(`  ${tool}: ${count}`);
      }
    }
    
    console.error('============================\n');
  }
}

// シングルトンインスタンス
export const apiLogger = new ApiLogger();