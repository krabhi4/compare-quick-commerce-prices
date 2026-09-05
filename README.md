# Quick-Commerce Price Comparison

Compare live grocery prices across Blinkit, Zepto, Swiggy Instamart, Flipkart Minutes & BigBasket Now.

## How location works

Every search is keyed on a 6-digit Indian pincode. The backend geocodes it with Nominatim (OpenStreetMap, free, cached in `data/geocache.json`) and passes the coordinates to each store, so results reflect the dark store that actually serves that pincode. "Auto-Detect" uses browser GPS and reverse-geocodes to a pincode.

Blinkit, BigBasket and Flipkart Minutes are fetched via their public web APIs with no browser. Instamart and Zepto run inside a headless Chromium because their APIs sit behind browser challenges. A store that does not serve the pincode simply returns no products (for example Zepto does not operate in Patna).

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
- `POST /location`: Set delivery pincode (`{"pin"}`) or GPS position (`{"lat","lon"}`), geocoded server-side
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
