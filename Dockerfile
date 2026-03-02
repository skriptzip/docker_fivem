ARG FIVEM_NUM=18443
ARG FIVEM_VER=18443-746f079d418d6a05ae5fe78268bc1b4fd66ce738
ARG DATA_VER=0e7ba538339f7c1c26d0e689aa750a336576cf02

# =============================
# Build Stage
# =============================
FROM ghcr.io/skriptzip/alpine:main AS builder

ARG FIVEM_VER
ARG DATA_VER

WORKDIR /output

RUN apk add --no-cache wget xz tar nodejs npm \
 && wget -O- https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/${FIVEM_VER}/fx.tar.xz \
        | tar xJ --strip-components=1 \
            --exclude alpine/dev --exclude alpine/proc \
            --exclude alpine/run --exclude alpine/sys \
 && mkdir -p /output/opt/cfx-server-data /output/usr/local/share \
 && wget -O- https://github.com/citizenfx/cfx-server-data/archive/${DATA_VER}.tar.gz \
        | tar xz --strip-components=1 -C opt/cfx-server-data

# Add config + entrypoint + websocket server
COPY config/server.cfg.template opt/cfx-server-data/
COPY config/package.json usr/local/
COPY config/tsconfig.json usr/local/
COPY config/server.ts usr/local/
COPY config/entrypoint usr/bin/entrypoint
RUN sed -i 's/\r$//' /output/usr/bin/entrypoint \
 && chmod +x /output/usr/bin/entrypoint

# Install Node.js dependencies and build TypeScript
RUN cd /output/usr/local \
 && npm install \
 && npm run build \
 && npm prune --omit=dev

RUN mkdir -p /output/sbin && cp /sbin/tini /output/sbin/tini

# =============================
# Final Stage
# =============================
FROM ghcr.io/skriptzip/alpine:main

ARG FIVEM_VER
ARG FIVEM_NUM
ARG DATA_VER

# Install Node.js runtime
RUN apk add --no-cache nodejs

LABEL org.opencontainers.image.authors="skriptzip <info@skript.zip>" \
      org.opencontainers.image.title="FiveM Docker" \
      org.opencontainers.image.url="https://github.com/skriptzip/docker_fivem" \
      org.opencontainers.image.version=${FIVEM_NUM}

COPY --from=builder /output/ /

WORKDIR /config
EXPOSE 30120 30121

ENTRYPOINT ["/sbin/tini", "--", "/usr/bin/entrypoint"]