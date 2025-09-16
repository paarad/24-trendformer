# Trendformer

AI-powered tool that turns trending topics into ready-to-post Twitter threads in specific tones (Degen, Contrarian, Expert).

## Stack
- Next.js (Pages Router, TypeScript)
- OpenAI
- Supabase (telemetry + caching)
- Exploding Topics / Glasp / Reddit / Hacker News (trend sources)

## Features
- ✅ Niche selection (AI, Fitness, Dating, Marketing, Crypto, Freelancing, Startups, Productivity)
- ✅ Multi-provider trend fetching with caching (12min TTL)
- ✅ Thread generation with granular copy (hook, tweets, CTA, quote)
- ✅ Card-based UI with source badges and scores
- ✅ Loading states and error handling
- ✅ Optional CRON security gate

## API
- `GET /api/getTrends?niche=AI&mock=false&provider=reddit|hn|glasp|all&minScore=100&save=true` → `{ niche, provider, mock, trends: Trend[], cached?: boolean }`
- `POST /api/generateThread` with JSON body `{ niche, topic, tone }` → `{ thread }`

## Quick Start

1. **Clone and install:**
```bash
git clone <repo>
cd trendformer
npm install
```

2. **Create `.env.local`:**
```bash
cp .env.example .env.local
```

3. **Configure environment variables** (see Environment Variables section below)

4. **Run development server:**
```bash
npm run dev
```

## Environment Variables

### Required
```bash
# OpenAI API for thread generation
OPENAI_API_KEY=sk-your-openai-key

# Supabase (for telemetry and trend storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional
```bash
# Development: Use mock data instead of real APIs
USE_MOCK_TRENDS=true

# Glasp integration (if using glasp provider)
GLASP_API_URL=https://glasp.co/api/highlights
GLASP_API_KEY=your-glasp-key

# Security: Protect API from unauthorized automation (optional)
CRON_KEY=your-secret-key-for-automated-access
```

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel

2. **Set environment variables** in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all required variables from the section above
   - Ensure `USE_MOCK_TRENDS=false` for production

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Test deployment:**
   - Visit your deployed URL
   - Test different niches: `?niche=AI`, `?niche=Fitness`, etc.
   - Verify trends load (should use real APIs in production)
   - Test thread generation

### Other Platforms

For other platforms (Railway, Render, etc.), ensure:
- Node.js environment
- All environment variables configured
- Build command: `npm run build`
- Start command: `npm start`

## Niche Support

Supported niches with curated sources:

| Niche | Reddit Subreddits | HN Keywords |
|-------|------------------|-------------|
| **AI** | MachineLearning, ArtificialIntelligence, OpenAI, ChatGPT | ai, machine learning, chatgpt, llm |
| **Fitness** | Fitness, bodyweightfitness, nutrition, running | fitness, workout, health, sleep |
| **Dating** | dating, AskMen, AskWomen, relationships | dating, relationships, romance |
| **Marketing** | marketing, SEO, Entrepreneur, content_marketing | marketing, seo, growth, ads |
| **Crypto** | CryptoCurrency, CryptoMarkets, ethereum, Bitcoin | crypto, bitcoin, ethereum, web3 |
| **Freelancing** | freelance, digitalnomad, Entrepreneur | freelance, contract, gig, client |
| **Startups** | startups, Entrepreneur, SaaS, smallbusiness | startup, funding, saas |
| **Productivity** | productivity, selfimprovement, GetMotivated | productivity, time management, focus |

## Security

### CRON Protection (Optional)

If you set `CRON_KEY` environment variable, the `/api/getTrends` endpoint will require authentication for automated access:

- **Automated requests:** Include `X-Cron-Key: your-secret-key` header or `Authorization: Bearer your-secret-key`
- **Browser requests:** Work normally (detected by referer and user-agent)
- **No CRON_KEY set:** All requests allowed (backwards compatible)

Example automated request:
```bash
curl -H "X-Cron-Key: your-secret-key" \
  "https://your-app.vercel.app/api/getTrends?niche=AI&provider=all"
```

## Database

Create these tables in your Supabase project:

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Telemetry events
create table if not exists public.trendformer_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Trends cache
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

## Usage

1. **Select niche and provider** from dropdowns
2. **Fetch trends** - data is cached for 12 minutes to avoid rate limits
3. **Click on trend cards** to select topics
4. **Generate threads** with your chosen tone
5. **Copy individual segments** (hook, tweets, CTA) or full thread

## Providers

- **Reddit** (`provider=reddit`): Curated hot posts from niche-specific subreddits
- **Hacker News** (`provider=hn`): Top stories with optional `minScore` filter
- **Glasp** (`provider=glasp`): Requires `GLASP_API_URL` configuration
- **All** (`provider=all`): Merges results from all configured providers

## Troubleshooting

- **No trends loading:** Check `USE_MOCK_TRENDS=false` and API credentials
- **Generation failing:** Verify `OPENAI_API_KEY` is set correctly
- **Empty results:** Try different niches or providers
- **Rate limits:** Trends are cached for 12 minutes to prevent excessive API calls

## Development

- Set `USE_MOCK_TRENDS=true` to use mock data during development
- Supabase is optional - app works without it (telemetry disabled)
- CRON security is optional - useful for production automation
