# syntax=docker/dockerfile:1

# 1) Build the static frontend (Next.js output: export -> out/).
FROM node:24-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Build the Go server with the frontend embedded.
FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./server/
RUN cd server && go mod download
COPY server ./server
# Replace the embed placeholder with the real static export.
COPY --from=web /web/out ./server/internal/httpd/dist
RUN cd server && CGO_ENABLED=0 go build -ldflags "-s -w" -o /g3 ./cmd/g3

# 3) Minimal runtime image — a single binary.
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 g3
COPY --from=server /g3 /usr/local/bin/g3

ENV G3_ADDR=:8787 \
    G3_S3_ADDR=:9000 \
    G3_DATA_DIR=/data \
    G3_DEV=false

# SQLite DB + encryption key live here; mount a volume to persist.
RUN mkdir -p /data && chown g3:g3 /data
VOLUME /data
USER g3

# Panel/UI on 8787, S3-compatible API on 9000.
EXPOSE 8787 9000
ENTRYPOINT ["g3"]
