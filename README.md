# Trendformer

AI-powered tool that turns trending topics into ready-to-post Twitter threads in specific tones (Degen, Contrarian, Expert).

## Stack
- Next.js (Pages Router, TypeScript)
- OpenAI
- Supabase (telemetry + caching)
- Exploding Topics / Glasp / Reddit / Hacker News (trend sources)

## Features (MVP)
- Niche selection
- Trend data fetch (mocked with pluggable providers)
- Thread generation by tone
- Optional remix/scheduler (future)

## API
- `GET /api/getTrends?niche=AI&mock=false&provider=reddit|hn|glasp|all&minScore=100&save=true` → `{ niche, provider, mock, trends: Trend[] }`
- `POST /api/generateThread` with JSON body `{ niche, topic, tone }` → `{ thread }`

## Setup
1. Copy `.env.example` to `.env.local` and fill values:
```
OPENAI_API_KEY=
USE_MOCK_TRENDS=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Optional Glasp configuration
GLASP_API_URL=
GLASP_API_KEY=
```
2. Install deps and run:
```
npm install
npm run dev
```

## Database
- Telemetry table (scoped): `trendformer_telemetry_events`
- Trends cache table: `trendformer_trends`

Create tables:
```
create extension if not exists "pgcrypto";

create table if not exists public.trendformer_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trendformer_trends (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  title text not null,
  body text,
  url text,
  score int,
  created_at timestamptz not null default now()
);
```

## Notes
- Providers:
  - Reddit curated hot posts (`provider=reddit`)
  - HN official API top stories (`provider=hn`, add `minScore=100` to filter)
  - Glasp: set `GLASP_API_URL` (and `GLASP_API_KEY` if needed). Try `provider=glasp`.
  - all: merges all configured providers.
- Save to Supabase can be disabled via `save=false`.
- Keep `USE_MOCK_TRENDS=true` if external calls should be disabled during dev.
