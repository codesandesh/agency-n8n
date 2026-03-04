FROM node:20-alpine

# librsvg  — lets sharp render SVG overlays
# vips-dev  — libvips headers (sharp builds against these)
# font packages — fallback fonts for SVG text rendering
# build-base + python3 — needed to compile sharp's native bindings
RUN apk add --no-cache \
      vips-dev \
      librsvg \
      fontconfig \
      ttf-liberation \
      font-noto \
      font-noto-extra \
      build-base \
      python3

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]
