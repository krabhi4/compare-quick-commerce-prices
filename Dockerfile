FROM node:25-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
RUN npm install -g pnpm@latest
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY frontend/ .
RUN pnpm run build

FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
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
RUN pip install --no-cache-dir --no-compile --upgrade -r requirements.txt && \
    playwright install --only-shell chromium && \
    rm -rf /root/.cache/ms-playwright/ffmpeg* && \
    find /root/.cache/ms-playwright -name "*WidevineCdm*" -prune -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /root/.cache/pip && \
    find /usr/local -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local -name "*.pyc" -delete 2>/dev/null || true
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY scraper/ ./scraper/
COPY api/ ./api/
COPY db/ ./db/
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
