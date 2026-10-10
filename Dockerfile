# Single container: FastAPI API + built React frontend. Defaults to the offline mock provider
# and Adapter Simulation Mode, so a public demo makes no paid API calls.

FROM node:22.11.0-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.12.7-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AGENTLABS_DATA_DIR=/data \
    AGENTLABS_FRONTEND_DIST=/app/frontend/dist \
    AGENTLABS_LLM_PROVIDER=mock \
    PORT=8000
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist /app/frontend/dist
RUN useradd --create-home --uid 10001 agentlabs && mkdir -p /data && chown agentlabs /data
USER agentlabs
WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/healthz', timeout=4)"
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
