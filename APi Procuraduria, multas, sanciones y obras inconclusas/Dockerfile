FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json ./
RUN bun install

COPY src ./src
COPY *.csv ./

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
