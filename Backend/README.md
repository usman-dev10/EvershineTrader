# Evershine Backend (FastAPI)

## Setup
```bash
cd Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` → `.env` and set `DATABASE_URL` to your Supabase Postgres URL
(`postgresql+asyncpg://...`).

```bash
uvicorn app.main:app --reload --port 8000
```

- Health: http://127.0.0.1:8000/health → `"database": "postgres"`

### Keep Render awake (free tier)
Render sleeps after ~15 minutes idle. An in-app timer cannot wake a sleeping service.

After deploy, use one of:
1. **GitHub Action** (in repo): set secret `RENDER_HEALTH_URL` = `https://YOUR.onrender.com/health` — runs every 5 minutes.
2. **cron-job.org / UptimeRobot**: GET the same `/health` URL every 5–10 minutes.
3. Frontend also pings `/health` every 60s while someone has the site open.

Do **not** ping every second — every 5–10 minutes is enough.

### Demo login
- Company: `company@demo.com` / `company123`
- Employee: `employee@demo.com` / `employee123`
