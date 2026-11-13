FROM node:26.13.1-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN npm install -g --allow-scripts=pnpm "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm run build

FROM python:3.15-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatomic1 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libudev1 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
ENV PATH=/opt/venv/bin:$PATH
RUN python -m venv --without-pip /opt/venv && \
    pip --python /opt/venv/bin/python install --no-cache-dir --no-compile --upgrade -r requirements.txt && \
    playwright install --only-shell chromium && \
    rm -rf /root/.cache/ms-playwright/ffmpeg* && \
    find /root/.cache/ms-playwright -name "*WidevineCdm*" -prune -exec rm -rf {} + && \
    rm -rf /root/.cache/pip && \
    find /usr/local /opt/venv -type d -name "__pycache__" -prune -exec rm -rf {} + && \
    find /usr/local /opt/venv -name "*.pyc" -delete
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY scraper/ ./scraper/
COPY api/ ./api/
COPY db/ ./db/
ENV PYTHONUNBUFFERED=1
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
