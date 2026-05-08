FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY src ./src

EXPOSE 3001
CMD ["bun", "run", "src/index.ts"]
