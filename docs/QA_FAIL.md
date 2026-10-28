# QA Failure Log

Date: 2026-10-26
Env: local dev
- Admin origin: http://localhost:5173
- Client SSR fallback origin: http://localhost:3000
- API expected: http://localhost:8000

## Summary
Admin auth bootstrap fails.
- `GET /api/v1/auth/csrf` → 404
- `GET /api/v1/auth/me` → 404
CORS failure is secondary because the endpoint is not reachable on port 8000 in this environment.

## Evidence
- curl to `http://localhost:8000/api/v1/auth/csrf` returns 404
- curl to `http://localhost:8000/api/v1/auth/me` returns 404
- curl to `http://localhost:8000/api/v1/health` returns 404
- curl to `http://localhost:8000/` returns 404
- Port 8000 is already occupied by an unrelated service in this environment
- Live Admin dev server is running at http://localhost:5173 and serves a valid HTML shell

## Root cause
The real backend from this repository is not running on port 8000 here.
Until it is started on a reachable port, CORS and client config alone cannot fix the failure.

## Client impact
Client SSR path targets `${API_BASE_URL}/api/site` on the same wrong host,
so landing-page SSR data will also fail here until the correct backend is live.

## Live app observed
- http://localhost:5173 returns 200 with the Vite Admin shell
- The browser app is reachable, but it still fails because its calls go to port 8000

## Required next step
Start the backend from this repo on a reachable port and point Admin at it,
then re-verify:
- `GET /api/v1/auth/csrf` returns 200 with `Access-Control-Allow-Origin`
- `GET /api/v1/auth/me` returns 401 without cookies, not 404
- Client SSR can reach `${API_BASE_URL}/api/site`
