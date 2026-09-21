# Evershine Frontend

Next.js + TypeScript + Tailwind CSS client for the Evershine shift / job / sheet management system.

## Setup

```bash
cd Frontend
cp .env.example .env.local
npm install
npm run dev
```

Set real values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon only — never the service role)
- `NEXT_PUBLIC_API_BASE_URL` (FastAPI base, e.g. `http://localhost:8000/api/v1`)

## Security notes

- Session via `@supabase/ssr` cookies
- Role-gated routes in `src/proxy.ts`
- Zod validation on auth/forms
- Security headers in `next.config.ts`
- Typed API client never trusts client-supplied `company_id`
- Safe error mapping (no raw stack leakage)

## Structure

```
src/app          → routes (public, company, employee)
src/components   → ui, forms, layout, landing, feature views
src/lib          → env, auth, api, supabase, validations, security
src/hooks        → client hooks
src/types        → shared domain types
```

Files are kept modular (~200–250 lines) for maintainability.
