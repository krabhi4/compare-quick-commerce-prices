# Quick-Commerce Price Comparison

Compare live grocery prices across Blinkit, Zepto, Swiggy Instamart, Flipkart Minutes & BigBasket Now.

## Requirements

- Docker & Docker Compose
- Or Python 3.13+ and Node 22+ with pnpm

## Running with Docker

1. Clone repo & build container:
```bash
docker compose build
```

2. Start service in background:
```bash
docker compose up -d
```

3. Open your browser:
```
http://localhost:8000
```

Data, price snapshots & browser session cookies persist in `./data`.

## Local Development

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn api.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Vite dev server proxies `/search`, `/alerts`, `/history`, `/auth` to port 8000.

## API Endpoints

- `POST /search`: Query product prices across stores
- `GET /history?name=`: View historical price snapshots for a product
- `POST /location`: Update delivery pincode and coordinates
- `GET /alerts`: List active price drop alerts
- `POST /alerts`: Create new price drop alert
- `DELETE /alerts/{id}`: Remove price alert
- `GET /auth/status`: Check platform session statuses
- `POST /auth/login/{platform}`: Start interactive login session
- `POST /auth/logout/{platform}`: Clear platform session
- `GET /health`: Healthcheck

## Caddy Configuration

Add to your Caddyfile:

```caddy
compare.192.168.0.9.nip.io {
    reverse_proxy localhost:8000
}
```
