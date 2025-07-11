#!/bin/bash
cd /home/shimizu/_mcp/osm-geojson-mcp-server

# MCPサーバを実行する (stdoutに余計な出力をしない)
exec node src/index.js