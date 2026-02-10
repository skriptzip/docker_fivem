# FiveM Docker Server

[![Docker Image](https://img.shields.io/badge/docker-fivem-blue.svg)](https://github.com/skriptzip/docker_fivem)
[![FiveM Version](https://img.shields.io/badge/fivem-24574-green.svg)](https://fivem.net/)

A containerized FiveM server based on Alpine Linux with automatic configuration and OneSync support.

## 🚀 Quick Start

### Docker Compose (Recommended)

```bash
docker-compose up -d
```

### Docker Run

```bash
docker run -d \
  --name fivem-server \
  --restart unless-stopped \
  -e LICENSE_KEY=your_license_key_here \
  -p 30120:30120/tcp \
  -p 30120:30120/udp \
  -p 30121:30121/tcp \
  -p 30121:30121/udp \
  -v ./config:/config \
  -ti \
  ghcr.io/skriptzip/fivem:latest
```

### With txAdmin Web UI

```bash
docker run -d \
  --name fivem-server \
  --restart unless-stopped \
  -e LICENSE_KEY=your_license_key_here \
  -e NO_DEFAULT_CONFIG=1 \
  -p 30120:30120/tcp \
  -p 30120:30120/udp \
  -p 40120:40120 \
  -v ./config:/config \
  -v ./txData:/txData \
  -ti \
  ghcr.io/skriptzip/fivem:latest
```

_Note: Interactive and pseudo-tty options (`-ti`) are required to prevent container crashes on startup_

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LICENSE_KEY` | Yes* | - | FiveM license key from [keymaster.fivem.net](https://keymaster.fivem.net) |
| `RCON_PASSWORD` | No | Random 16-char | RCON password for server management |
| `NO_DEFAULT_CONFIG` | No | - | Set to disable default config (enables txAdmin) |
| `NO_LICENSE_KEY` | No | - | Set to disable license key requirement |
| `NO_ONESYNC` | No | - | Set to disable OneSync |

*Required unless `NO_LICENSE_KEY` is set

## 📁 Volume Mounts

| Container Path | Purpose |
|----------------|---------|
| `/config` | Server configuration files and resources |
| `/txData` | txAdmin web UI configuration and database |

## 🔄 Automatic Builds & Versions

- **Scheduled Builds**: Runs automatically every week on Sundays at 02:00 UTC
- **Automatic Updates**: Fetches the latest recommended FiveM version from `artifacts.jgscripts.com`

### Available Tags

- `ghcr.io/skriptzip/fivem:latest` - Latest recommended version (updates every 2 weeks)
- `ghcr.io/skriptzip/fivem:[VERSION]` - Specific version (e.g., `24574`)

### Version Pinning

**Production:** Pin to a specific version
```yaml
services:
  fivem:
    image: ghcr.io/skriptzip/fivem:24574
```

**Development:** Use latest
```yaml
services:
  fivem:
    image: ghcr.io/skriptzip/fivem:latest
```
