<h1>
  <img src="https://logos-world.net/wp-content/uploads/2021/03/FiveM-Logo.png" height="32" style="vertical-align:middle; margin-right:8px;"/>
  FiveM-Server Docker
</h1>

[![Docker Image](https://img.shields.io/badge/docker-fivem-blue.svg)](https://github.com/skriptzip/docker_fivem)
[![FiveM Version](https://img.shields.io/badge/fivem-26389-green.svg)](https://fivem.net/)
[![Let's Encrypt](https://img.shields.io/badge/https-letsencrypt-green.svg)](https://letsencrypt.org/)

A containerized FiveM server with automatic configuration and OneSync support.

## Features

- **WebSocket Secure (WSS):** Real-time console streaming over HTTPS with automatic Let's Encrypt certificates
- **Traefik Integration:** Built-in reverse proxy with automatic HTTPS/TLS termination
- **TypeScript Control Layer:** Modern Node.js WebSocket server for server management
- **Graceful Shutdown:** Event for resources to save data gracefully
- **Environment-Based Config:** Automatic `server.cfg` generation from env variables
- **OneSync Ready:** Built-in OneSync support for improved multiplayer sync
- **Alpine Linux:** Minimal, fast image (~200MB base)

## Quick Start

### Docker Compose Example

```yaml
services:
  fivem-local-server:
    build:
      context: .
    container_name: fivem-local
    restart: on-failure
    stop_grace_period: 46s
    environment:
      - LICENSE_KEY=${LICENSE_KEY}
      - ENABLE_WEBSOCKET=1
      - WEBSOCKET_API_KEY=${WEBSOCKET_API_KEY:-}
      - WEBSOCKET_PORT=${WEBSOCKET_PORT:-30121}
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
    volumes:
      - ./fivem-data:/config
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.fivem-wss.rule=Host(`${TRAEFIK_HOST}`)"
      - "traefik.http.routers.fivem-wss.entrypoints=websecure"
      - "traefik.http.routers.fivem-wss.tls.certresolver=letsencrypt"
      - "traefik.http.services.fivem-wss.loadbalancer.server.port=${WEBSOCKET_PORT:-30121}"
      - "traefik.http.services.fivem-wss.loadbalancer.server.scheme=http"
    networks:
      - fivem-network
    depends_on:
      - traefik

  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=fivem-network"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${LETSENCRYPT_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./config/acme.json:/acme.json
    networks:
      - fivem-network

networks:
  fivem-network:
    driver: bridge
```



## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LICENSE_KEY` | FiveM key from [keymaster.fivem.net](https://keymaster.fivem.net) | ✅ Yes |
| `TRAEFIK_HOST` | Hostname for WSS routing (e.g., `fivem.example.com`) | ✅ Yes |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt certificate notifications | ✅ Yes |
| `WEBSOCKET_API_KEY` | API key for WebSocket authentication (Bearer token or query param) | ❌ Optional |
| `WEBSOCKET_PORT` | Internal WebSocket server port (default: 30121) | ❌ Optional |
| `RCON_PASSWORD` | RCON password (randomly generated if not set) | ❌ Optional |
| `ENABLE_WEBSOCKET` | Enable WebSocket server (default: 1) | ❌ Optional |
| `NO_DEFAULT_CONFIG` | Skip default config (for txAdmin) | ❌ Optional |
| `NO_ONESYNC` | Disable OneSync | ❌ Optional |

## WebSocket Secure (WSS)

With API Key in query parameter:
```javascript
const apiKey = 'your_websocket_api_key';
const ws = new WebSocket(`wss://fivem.example.com?api_key=${apiKey}`);
```

Or with Bearer token:
```javascript
const ws = new WebSocket('wss://fivem.example.com');
ws.onopen = () => {
  // Wait for connection before sending auth
  ws.send(JSON.stringify({ type: 'auth', token: apiKey }));
};
```

#### Connection Handling
```javascript
ws.onopen = () => {
  console.log('Connected to FiveM WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Server message:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from server');
};
```

### Volumes

- `/config` - Server configuration & resources
- `/txData` - txAdmin data (if using txAdmin)

## Graceful Shutdown

When the container stops, it waits up to 45 seconds for resources to save data. Listen for the shutdown event in your resources:

```lua
-- server.lua

RegisterCommand("trigger_shutdown", function(source, args, rawCommand)
  local reason = args[1] or "No Reason provided"
  local secondsRemaining = tonumber(args[2]) or 45000

  TriggerEvent("docker:shutdown", secondsRemaining, reason)
  TriggerClientEvent("docker:shutdown", -1, secondsRemaining, reason)

end, true)
```

## Versions

Images are automatically built with the latest recommended FiveM version.

- `ghcr.io/skriptzip/fivem:latest` - Latest version
- `ghcr.io/skriptzip/fivem:26261` - Specific version (pin for production)
