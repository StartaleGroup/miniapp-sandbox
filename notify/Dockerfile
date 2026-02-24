FROM node:20-slim
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN corepack enable && pnpm install
COPY tsconfig.json ./
COPY src ./src
RUN mkdir -p data
EXPOSE 3200
CMD ["pnpm", "start"]
