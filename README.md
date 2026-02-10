# FiveM Docker Server

[![Docker Image](https://img.shields.io/badge/docker-docker__fivem-blue.svg)](https://github.com/skriptzip/docker_fivem)
[![FiveM Version](https://img.shields.io/badge/fivem-18443-green.svg)](https://fivem.net/)

A containerized FiveM server based on Alpine Linux with automatic configuration and OneSync support.

## 📦 What's Included

- **Base OS**: Alpine Linux (minimal, secure)
- **FiveM Server**: Latest build with OneSync enabled by default
- **Init system**: `tini` for proper PID 1 behavior
- **Auto-config**: Default server configuration generated on first run
- **Web UI**: txAdmin support for server management

## 🛠️ Usage

### Quick Start with Docker Compose

```bash
# Clone or download docker-compose.yml
docker-compose up -d
```

### Pull from Registry

```bash
docker pull ghcr.io/skriptzip/fivem:latest
```

### Run with Docker

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

### Use with txAdmin Web UI

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

### Connect to WebSocket

You can connect to the FiveM server's WebSocket endpoint using wscat:

```bash
wscat -c ws://localhost:30121
```

This is useful for monitoring and interacting with the server in real-time.

## 🏗️ Build Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `FIVEM_NUM` | `18443` | FiveM build number |
| `FIVEM_VER` | `18443-746f079d418d6a05ae5fe78268bc1b4fd66ce738` | Full FiveM version string |
| `DATA_VER` | `0e7ba538339f7c1c26d0e689aa750a336576cf02` | CFX server data version |

Example:
```bash
docker build --build-arg FIVEM_NUM=18500 -t my-fivem .
```

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LICENSE_KEY` | Yes* | - | FiveM license key from [keymaster.fivem.net](https://keymaster.fivem.net) |
| `RCON_PASSWORD` | No | Random 16-char | RCON password for server management |
| `NO_DEFAULT_CONFIG` | No | - | Set to disable default config (enables txAdmin) |
| `NO_LICENSE_KEY` | No | - | Set to disable license key requirement |
| `NO_ONESYNC` | No | - | Set to disable OneSync |
| `DEBUG` | No | - | Enable debug logging |

*Required unless `NO_LICENSE_KEY` is set

## 📁 Volume Mounts

| Container Path | Purpose | Description |
|----------------|---------|-------------|
| `/config` | Server Config | Server configuration files and resources |
| `/txData` | txAdmin Data | txAdmin web UI configuration and database |

## 🚀 Getting Started

1. **Obtain a License Key**: Visit [keymaster.fivem.net](https://keymaster.fivem.net) to get your free license key

2. **Create directories**:
   ```bash
   mkdir -p config txData
   ```

3. **Run with Docker Compose**:
   ```bash
   # Edit docker-compose.yml with your license key
   docker-compose up -d
   ```

4. **Configure Server**: Edit `config/server.cfg` after first run to customize your server

5. **Connect**: Join your server at `your-server-ip:30120`

## 🔄 Automatic Builds

This repository uses GitHub Actions to automatically build and publish Docker images with the latest FiveM artifacts.

### How It Works

- **Scheduled Builds**: Runs automatically every 2 weeks on Sundays at 02:00 UTC
- **Manual Trigger**: Can be triggered manually via GitHub Actions UI
- **Automatic Updates**: Fetches the recommended artifact version from `artifacts.jgscripts.com`
- **Smart Tagging**: Creates both `latest` and version-specific tags (e.g., `24574`)

### Available Tags

- `ghcr.io/skriptzip/docker_fivem:latest` - Currently recommended FiveM version
- `ghcr.io/skriptzip/docker_fivem:[VERSION]` - Specific FiveM version (e.g., `24574`)

### Manual Workflow Trigger

To manually trigger a build:

1. Go to the **Actions** tab in this repository
2. Select **"🐳 Auto-Build FiveM Docker Images"** workflow
3. Click **"Run workflow"**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
