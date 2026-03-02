<h1>
  <img src="https://logos-world.net/wp-content/uploads/2021/03/FiveM-Logo.png" height="32" style="vertical-align:middle; margin-right:8px;"/>
  FiveM-Server Docker
</h1>

[![Docker Image](https://img.shields.io/badge/docker-fivem-blue.svg)](https://github.com/skriptzip/docker_fivem)
[![FiveM Version](https://img.shields.io/badge/fivem-26261-green.svg)](https://fivem.net/)

A containerized FiveM server with automatic configuration and OneSync support.

## Features

- **WebSocket Server:** Real-time console streaming and remote command execution
- **TypeScript Control Layer:** Modern Node.js WebSocket server for server management
- **Graceful Shutdown:** event for resources to save data gracefully
- **Environment-Based Config:** Automatic `server.cfg` generation from env variables
- **OneSync Ready:** Built-in OneSync support for improved multiplayer sync
- **Alpine Linux:** Minimal, fast image (~200MB base)

## Quick Start
```yaml
services:
  fivem-local-server:
    image: ghcr.io/skriptzip/fivem:latest
    restart: on-failure
    stop_grace_period: 46s
    environment:
      - LICENSE_KEY=${LICENSE_KEY}
      - ENABLE_WEBSOCKET=1
      - WEBSOCKET_API_KEY=${WEBSOCKET_API_KEY:-}
      - RCON_PASSWORD=${RCON_PASSWORD:-changeme}
      - SERVER_NAME=${SERVER_NAME:-FiveM Server}
      - SERVER_DESC=${SERVER_DESC:-A FiveM Server}
      - SERVER_TAGS=${SERVER_TAGS:-default}
      - MAX_CLIENTS=${MAX_CLIENTS:-32}
      - STEAM_API_KEY=${STEAM_API_KEY:-none}
      - MYSQL_CONNECTION=${MYSQL_CONNECTION:-mysql://user:password@localhost:3306/database}
      - LOCALE=${LOCALE:-en-US}
    ports:
      - "30120:30120"
      - "30120:30120/udp"
      - "30121:30121" 
    volumes:
      - ./fivem-data:/config
    tty: true
```

Or with Docker directly:
```bash
docker run -d \
  --name fivem-server \
  --restart unless-stopped \
  -e LICENSE_KEY=your_key \
  -p 30120:30120/tcp \
  -p 30120:30120/udp \
  -p 30121:30121/tcp \
  -p 30121:30121/udp \
  -v ./config:/config \
  ghcr.io/skriptzip/fivem:latest
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `LICENSE_KEY` | FiveM key from [keymaster.fivem.net](https://keymaster.fivem.net) (or set `NO_LICENSE_KEY`) |
| `RCON_PASSWORD` | RCON password (randomly generated if not set) |
| `WEBSOCKET_API_KEY` | API key for WebSocket authentication on port 30121 |
| `ENABLE_WEBSOCKET` | Enable WebSocket server (default: 1) |
| `NO_DEFAULT_CONFIG` | Skip default config (for txAdmin) |
| `NO_ONESYNC` | Disable OneSync |

## WebSocket Authentication

If `WEBSOCKET_API_KEY` is set, clients must authenticate:
```javascript
const ws = new WebSocket("ws://localhost:30121?api_key=your_key");
```

Or with Bearer token:
```javascript
const headers = { "Authorization": `Bearer ${API_KEY}` };
const ws = new WebSocket("ws://localhost:30121", { headers });
```

### Volumes

- `/config` - Server configuration and resources
- `/txData` - txAdmin data (if using txAdmin)

## Graceful Shutdown

When the container stops, it waits up to 45 seconds for resources to save data. Listen for the shutdown event in your resources:

```lua
-- server.lua

RegisterCommand("trigger_shutdown", function(source, args, rawCommand)
  local reason = args[1] or "No Reason provided"
  local secondsRemaining = tonumber(args[2]) or 15000

  TriggerEvent("docker:shutdown", secondsRemaining, reason)
  TriggerClientEvent("docker:shutdown", -1, secondsRemaining, reason)

end, true)

```

## Versions

Images are automatically built with the latest recommended FiveM version.

- `ghcr.io/skriptzip/fivem:latest` - Latest version
- `ghcr.io/skriptzip/fivem:24574` - Specific version (pin for production)
