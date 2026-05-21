# Unified Dockerfile for BoostNote-Legacy
# Builds for both amd64 (Intel Mac) and arm64 (Apple Silicon).
#
# Build for Intel Mac / amd64:
#   docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t boostnote-legacy .
#
# Build for Apple Silicon / arm64:
#   docker build --platform linux/arm64 \
#     --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
#     --build-arg BUILDARCH=arm64 -t boostnote-legacy-arm64 .
#
# Export:
#   docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64 ./dist/
#   docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-darwin-x64.zip ./dist/
#   docker cp $(docker create --rm boostnote-legacy):/app/dist/Boostnote-linux-x64.tar.gz ./dist/
#   docker cp $(docker create --rm boostnote-legacy-arm64):/app/dist/Boostnote-darwin-arm64 ./dist/
#   docker cp $(docker create --rm boostnote-legacy-arm64):/app/dist/Boostnote-darwin-arm64.zip ./dist/

ARG BUILDARCH=amd64

FROM node:22-bookworm AS base

RUN apt-get update && apt-get install -y \
  python3 \
  python-is-python3 \
  build-essential \
  fakeroot \
  git \
  zip \
  && rm -rf /var/lib/apt/lists/*

# ── deps stage: install node_modules and resolve yarn.lock ──────────────────
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
# node:20-bookworm ships yarn; skip reinstalling it to avoid symlink conflict
RUN npm install -g grunt-cli@1.3.2 && \
  git config --global url."https://".insteadOf git:// && \
  yarn install --ignore-engines

# ── build stage: compile and package ────────────────────────────────────────
FROM deps AS build
ARG GIT_COMMIT=unknown
ARG BUILDARCH
COPY . .
# Restore yarn.lock resolved in deps stage (COPY . . overwrites with host version)
COPY --from=deps /app/yarn.lock ./yarn.lock
RUN echo "$GIT_COMMIT" > /app/commit-hash.txt

# Patch CodeMirror's on() function to mark touchstart/touchmove listeners as
# passive. This eliminates Chrome violations that block smooth scrolling.
RUN sed -i 's/emitter.addEventListener(type, f, false);/emitter.addEventListener(type, f, type === "touchstart" || type === "touchmove" ? { passive: true } : false);/' node_modules/codemirror/lib/codemirror.js

# Patch react-sortable-hoc's componentDidMount to register touch events as
# passive (handleStart/handleMove never call preventDefault).
RUN sed -i 's/events\[key\], false);/events[key], { passive: true });/' node_modules/react-sortable-hoc/dist/commonjs/SortableContainer/index.js && \
    sed -i 's/events\[key\], false);/events[key], { passive: true });/' node_modules/react-sortable-hoc/dist/es6/SortableContainer/index.js

# Compile webpack production build, then copy to staging for packaging.
# The staging copy avoids fs-extra overlayfs bug when electron-packager copies app dir.
RUN npm run compile && \
  mkdir -p /build && \
  cp -a /app /build/app && \
  cd /build/app && \
  ARCH_SUFFIX=x64 && \
  PACK_TARGET=osx && \
  if [ "$BUILDARCH" = "arm64" ]; then \
    ARCH_SUFFIX=arm64 && \
    PACK_TARGET=osx-arm64; \
  fi && \
  PACK_OUT_DIR=/build/out grunt pack:$PACK_TARGET && \
  mkdir -p /app/dist && \
  cp -r /build/out/Boostnote-darwin-$ARCH_SUFFIX /app/dist/ && \
  cd /build/app && \
  PACK_OUT_DIR=/build/out-linux grunt pack:linux && \
  mkdir -p /app/dist && \
  tar -czf /app/dist/Boostnote-linux-x64.tar.gz -C /build/out-linux/Boostnote-linux-x64 . && \
  cd /build/out/Boostnote-darwin-$ARCH_SUFFIX && \
  zip -r -y -q /app/dist/Boostnote-darwin-$ARCH_SUFFIX.zip Boostnote.app

# Output:
#   /app/dist/Boostnote-darwin-{x64,arm64}/Boostnote.app
#   /app/dist/Boostnote-darwin-{x64,arm64}.zip
#   /app/dist/Boostnote-linux-x64.tar.gz
CMD ["sh", "-c", "ls -la dist/"]
