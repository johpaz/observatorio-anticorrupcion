FROM oven/bun:1.4.4 AS base
WORKDIR /app

# Python + scikit-learn para el pipeline ML (Isolation Forest):
# sin esto la bandera ANOMALIA_ESTADISTICA nunca se calcula en producción
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/* \
 && python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir scikit-learn pandas
ENV PYTHON_BIN=/opt/venv/bin/python3

COPY package.json bun.lock ./
COPY api/package.json ./api/package.json
COPY ["frontend/package.json", "./frontend/package.json"]
COPY ["APi Procuraduria, multas, sanciones y obras inconclusas/package.json", "./APi Procuraduria, multas, sanciones y obras inconclusas/package.json"]

RUN bun install --frozen-lockfile

COPY api/src ./api/src

EXPOSE 3001
CMD ["bun", "run", "--cwd", "api", "src/index.ts"]
