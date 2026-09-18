# Stage 1: build (TypeScript -> dist)
FROM node:22.23-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Stage 2: runtime
FROM node:22.23-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-writer \
    fonts-dejavu-core \
    fonts-liberation \
    dumb-init \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /usr/share/man /usr/share/doc /tmp/* /var/tmp/*

COPY fonts/msttcorefonts /usr/share/fonts/truetype/msttcorefonts
RUN fc-cache -fv

RUN mkdir -p /etc/libreoffice && \
    printf '[CrashReport]\nEnabled=false\n' > /etc/libreoffice/sofficerc

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8080

USER 1000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "dist/index.js"]
