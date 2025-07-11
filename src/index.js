#!/usr/bin/env node
// index.js
// エントリーポイント

import { OSMGeoJSONServer } from './server/OSMGeoJSONServer.js';

// サーバーインスタンスの作成と起動
const server = new OSMGeoJSONServer();
server.run().catch(console.error);