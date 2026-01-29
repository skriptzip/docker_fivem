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

# Add config + entrypoint + websocket server (fixed paths)
COPY config/server.cfg.template opt/cfx-server-data/
COPY config/package.json usr/local/
COPY config/server.js usr/local/
COPY config/entrypoint usr/bin/entrypoint
RUN chmod +x /output/usr/bin/entrypoint \
 && ls -la /output/usr/bin/entrypoint \
 && ls -la /output/usr/local/package.json \
 && ls -la /output/usr/local/server.js \
 && head -5 /output/usr/local/server.js

# Install Node.js dependencies
RUN cd /output/usr/local && npm install --production

RUN mkdir -p /output/sbin && cp /sbin/tini /output/sbin/tini

# =============================
# Final Stage
# =============================
FROM ghcr.io/skriptzip/alpine:main

ARG FIVEM_VER
ARG FIVEM_NUM
ARG DATA_VER

# Install Node.js in the final stage
RUN apk add --no-cache nodejs

LABEL org.opencontainers.image.authors="skriptzip <info@skript.zip>" \
      org.opencontainers.image.title="FiveM" \
      org.opencontainers.image.url="https://fivem.net" \
      org.opencontainers.image.description="FiveM dedicated server image" \
      org.opencontainers.image.version=${FIVEM_NUM} \
      io.fivem.version=${FIVEM_VER} \
      io.fivem.data=${DATA_VER}

COPY --from=builder /output/ /

# Debug: Check if entrypoint exists and fix line endings
RUN ls -la /usr/bin/entrypoint || echo "Entrypoint not found!" \
 && head -1 /usr/bin/entrypoint | od -c \
 && sed -i 's/\r$//' /usr/bin/entrypoint \
 && chmod +x /usr/bin/entrypoint

WORKDIR /config
EXPOSE 30120 30121

CMD [""]
ENTRYPOINT ["/sbin/tini", "--", "/usr/bin/entrypoint"]