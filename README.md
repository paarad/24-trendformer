# Trendformer

AI-powered tool that turns trending topics into ready-to-post Twitter threads in specific tones (Degen, Contrarian, Expert).

## Stack
- Next.js (Pages Router, TypeScript)
- OpenAI
- Supabase (telemetry)
- Exploding Topics / Glasp (optional trend sources)

## Features (MVP)
- Niche selection
- Trend data fetch (mocked with pluggable providers)
- Thread generation by tone
- Optional remix/scheduler (future)

## API
- `GET /api/getTrends?niche=AI` → `{ niche, trends: Trend[] }`
- `POST /api/generateThread` with JSON body `{ niche, topic, tone }` → `{ thread }`

## Setup
1. Copy `.env.example` to `.env.local` and fill values:
```
OPENAI_API_KEY=
USE_MOCK_TRENDS=true
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
2. Install deps and run:
```
npm install
npm run dev
```

## Notes
- If trend APIs are paid/limited, keep `USE_MOCK_TRENDS=true`.
- Telemetry writes to `telemetry_events` table; create it if needed:
```
create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```
