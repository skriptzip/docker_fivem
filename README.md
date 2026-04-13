# <img src="https://logos-world.net/wp-content/uploads/2021/03/FiveM-Logo.png" height="32" style="vertical-align:middle; margin-right:8px;"/> FiveM-Server Docker

[![Docker Image](https://img.shields.io/badge/docker-fivem-blue.svg)](https://github.com/skriptzip/docker_fivem)
[![FiveM Version](https://img.shields.io/badge/fivem-28009-green.svg)](https://fivem.net/)
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
  traefik:
    image: traefik:v3.6
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.fivem.address=:30120"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=${LETSENCRYPT_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
      - "30120:30120"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt

  fivem:
    image: ghcr.io/skriptzip/fivem:26261
    container_name: fivem
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
      - "30120:30120/udp"
    volumes:
      - ./fivem-data:/config
    tty: true
    labels:
      - "traefik.enable=true"

      # ─── FiveM TCP (play.example.com:30120) ───
      - "traefik.tcp.routers.fivem-tcp.rule=HostSNI(`*`)"
      - "traefik.tcp.routers.fivem-tcp.entrypoints=fivem"
      - "traefik.tcp.services.fivem-tcp.loadbalancer.server.port=30120"

      # ─── WSS Public (wss.example.com) ───
      - "traefik.http.routers.fivem-wss-public.rule=Host(`${WSS_HOST}`)"
      - "traefik.http.routers.fivem-wss-public.entrypoints=websecure"
      - "traefik.http.routers.fivem-wss-public.tls.certresolver=letsencrypt"
      - "traefik.http.routers.fivem-wss-public.service=fivem-wss"

      # ─── WSS Local (wss.localhost) ───
      - "traefik.http.routers.fivem-wss-local.rule=Host(`wss.localhost`)"
      - "traefik.http.routers.fivem-wss-local.entrypoints=web"
      - "traefik.http.routers.fivem-wss-local.service=fivem-wss"

      # ─── FiveM Local (fivem.localhost) ───
      - "traefik.http.routers.fivem-local.rule=Host(`fivem.localhost`)"
      - "traefik.http.routers.fivem-local.entrypoints=web"
      - "traefik.http.routers.fivem-local.service=fivem-wss"

      # ─── Shared WSS Service ───
      - "traefik.http.services.fivem-wss.loadbalancer.server.port=${WEBSOCKET_PORT:-30121}"
      - "traefik.http.services.fivem-wss.loadbalancer.server.scheme=http"
    depends_on:
      - traefik
```

> **Note:** `*.localhost` domains resolve automatically in modern browsers and Windows/WSL — no hosts file entry needed.

> **Note:** Traefik reaches containers via the internal Docker network. Port `30121` does **not** need to be exposed in `ports:` — only UDP `30120` needs a direct mapping since Traefik cannot proxy UDP traffic.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LICENSE_KEY` | FiveM key from [keymaster.fivem.net](https://keymaster.fivem.net) | ✅ Yes |
| `WSS_HOST` | Hostname for WSS routing (e.g., `wss.example.com`) | ✅ Yes |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt certificate notifications | ✅ Yes |
| `WEBSOCKET_API_KEY` | API key for WebSocket authentication (Bearer token or query param) | ❌ Optional |
| `WEBSOCKET_PORT` | Internal WebSocket server port (default: 30121) | ❌ Optional |
| `RCON_PASSWORD` | RCON password (randomly generated if not set) | ❌ Optional |
| `ENABLE_WEBSOCKET` | Enable WebSocket server (default: 1) | ❌ Optional |
| `NO_DEFAULT_CONFIG` | Skip default config (for txAdmin) | ❌ Optional |
| `NO_ONESYNC` | Disable OneSync | ❌ Optional |

### DNS Setup

| Domain | Record | Purpose |
|--------|--------|---------|
| `play.example.com` | A → your server IP | FiveM direct connect |
| `wss.example.com` | A → your server IP | WebSocket admin console |
| `*.localhost` | automatic ✅ | Local development |

## WebSocket Secure (WSS)

Connect via query parameter:
```javascript
const ws = new WebSocket(`wss://wss.example.com?api_key=${apiKey}`);
```

Or with Bearer token:
```javascript
const ws = new WebSocket('wss://wss.example.com');
ws.onopen = () => {
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