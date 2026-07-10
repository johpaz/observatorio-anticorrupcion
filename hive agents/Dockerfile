FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json ./
COPY packages ./packages
RUN bun install

COPY src ./src
COPY tsconfig.json ./

EXPOSE 4000
ENV PORT=4000
CMD ["bun", "run", "src/gateway/server.ts"]
