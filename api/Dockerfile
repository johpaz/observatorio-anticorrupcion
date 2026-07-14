FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
COPY api/package.json ./api/package.json
COPY ["frontend/package.json", "./frontend/package.json"]
COPY ["APi Procuraduria, multas, sanciones y obras inconclusas/package.json", "./APi Procuraduria, multas, sanciones y obras inconclusas/package.json"]
COPY ["hive agents/package.json", "./hive agents/package.json"]
COPY ["hive agents/packages", "./hive agents/packages"]

RUN bun install --frozen-lockfile

COPY api/src ./api/src
COPY ["hive agents/src", "./hive agents/src"]

EXPOSE 3001
CMD ["bun", "run", "--cwd", "api", "src/index.ts"]
