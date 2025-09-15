"use client";

import { useCallback, useMemo, useState } from "react";

type Tone = "degen" | "contrarian" | "expert";

type Trend = {
  topic: string;
  source: "mock" | "explodingtopics" | "glasp" | "reddit" | "hn";
  score?: number;
  timestamp: string;
  url?: string;
  body?: string;
  topComment?: string | null;
};

type ThreadOutput = {
  title: string;
  segments: string[];
  cta?: string;
  quoteIdea?: string;
};

const NICHES = ["AI", "Fitness", "Dating", "Marketing", "Crypto", "Freelancing", "Startups", "Productivity"];
const TONES: Tone[] = ["degen", "contrarian", "expert"];
const PROVIDERS = ["all", "reddit", "hn", "glasp"] as const;

type Provider = typeof PROVIDERS[number];

export default function Home() {
  const [niche, setNiche] = useState<string>("AI");
  const [tone, setTone] = useState<Tone>("expert");
  const [provider, setProvider] = useState<Provider>("all");
  const [minScore, setMinScore] = useState<number>(100);
  const [saveToDb, setSaveToDb] = useState<boolean>(true);

  const [trends, setTrends] = useState<Trend[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [thread, setThread] = useState<ThreadOutput | null>(null);

  const selectedTrend = trends[selectedIdx] || null;

  const loadTrends = useCallback(async () => {
    try {
      setError("");
      setLoadingTrends(true);
      setThread(null);
      setSelectedIdx(-1);
      const params = new URLSearchParams();
      params.set("mock", "false");
      params.set("provider", provider);
      params.set("niche", niche);
      if (provider === "hn" || provider === "all") params.set("minScore", String(minScore));
      params.set("save", saveToDb ? "true" : "false");
      const url = `/api/getTrends?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load trends: ${res.status}`);
      const data = await res.json();
      setTrends(data.trends || []);
      if ((data.trends || []).length > 0) setSelectedIdx(0);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch trends");
    } finally {
      setLoadingTrends(false);
    }
  }, [provider, minScore, saveToDb, niche]);

  const generate = useCallback(async () => {
    if (selectedIdx < 0 || !trends[selectedIdx]) {
      setError("Pick a topic first");
      return;
    }
    const t = trends[selectedIdx];
    const context = [t.body, t.topComment].filter(Boolean).join("\n\n");
    try {
      setError("");
      setLoadingThread(true);
      setThread(null);
      const res = await fetch(`/api/generateThread`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ niche, topic: t.topic, tone, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to generate: ${res.status}`);
      setThread(data.thread as ThreadOutput);
    } catch (e: any) {
      setError(e?.message || "Failed to generate thread");
    } finally {
      setLoadingThread(false);
    }
  }, [niche, tone, trends, selectedIdx]);

  const remix = useCallback(async () => {
    // Simple remix: re-call generation with the same inputs
    await generate();
  }, [generate]);

  const threadAsText = useMemo(() => {
    if (!thread) return "";
    const parts: string[] = [];
    parts.push(thread.title);
    thread.segments?.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
    if (thread.cta) parts.push(`CTA: ${thread.cta}`);
    if (thread.quoteIdea) parts.push(`Quote: ${thread.quoteIdea}`);
    return parts.join("\n\n");
  }, [thread]);

  const copyAll = useCallback(async () => {
    if (!threadAsText) return;
    await navigator.clipboard.writeText(threadAsText);
  }, [threadAsText]);

  return (
    <div className="min-h-screen p-6 sm:p-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Trendformer</h1>
        <div className="text-sm opacity-70">Generate threads from fresh trends</div>
      </header>

      <section className="grid sm:grid-cols-5 gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm">Niche</label>
          <select value={niche} onChange={(e) => setNiche(e.target.value)} className="border rounded-md px-3 py-2 bg-transparent">
            {NICHES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="border rounded-md px-3 py-2 bg-transparent">
            {TONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="border rounded-md px-3 py-2 bg-transparent">
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm">HN min score</label>
          <input type="number" value={minScore} onChange={(e) => setMinScore(Number(e.target.value || 0))} className="border rounded-md px-3 py-2 bg-transparent" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Save to DB</label>
          <input type="checkbox" checked={saveToDb} onChange={(e) => setSaveToDb(e.target.checked)} className="h-5 w-5" />
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="sm:col-span-2 flex flex-col gap-2">
          <label className="text-sm">Trending topics</label>
          <select
            value={selectedIdx >= 0 ? String(selectedIdx) : ""}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="border rounded-md px-3 py-2 bg-transparent"
          >
            <option value="" disabled>
              {trends.length ? "Select a topic" : "Fetch trends to load topics"}
            </option>
            {trends.map((t, idx) => (
              <option key={`${t.topic}-${idx}`} value={idx}>
                {t.topic}
              </option>
            ))}
          </select>
          {selectedTrend?.url ? (
            <a href={selectedTrend.url} target="_blank" rel="noreferrer" className="text-xs underline opacity-70">Open source link</a>
          ) : null}
          {selectedTrend?.topComment ? (
            <div className="text-xs opacity-70 whitespace-pre-wrap">Top comment: {selectedTrend.topComment}</div>
          ) : null}
        </div>
        <div className="flex items-end gap-2">
          <button onClick={loadTrends} className="border rounded-md px-4 py-2 w-full sm:w-auto hover:bg-black/5" disabled={loadingTrends}>
            {loadingTrends ? "Loading trends..." : "Fetch Trends"}
          </button>
          <button onClick={generate} className="border rounded-md px-4 py-2 w-full sm:w-auto hover:bg-black/5" disabled={loadingThread || selectedIdx < 0}>
            {loadingThread ? "Generating..." : "Generate"}
          </button>
          <button onClick={remix} className="border rounded-md px-4 py-2 w-full sm:w-auto hover:bg-black/5" disabled={loadingThread || selectedIdx < 0}>Remix</button>
        </div>
      </section>

      {error ? <div className="mb-6 text-red-600 text-sm">{error}</div> : null}

      {thread ? (
        <section className="border rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Preview</h2>
            <button onClick={copyAll} className="border rounded-md px-3 py-1.5 hover:bg-black/5 text-sm">Copy all</button>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm uppercase opacity-70 mb-1">Hook</div>
              <div className="whitespace-pre-wrap">{thread.title}</div>
            </div>
            {thread.segments?.map((seg, i) => (
              <div key={i}>
                <div className="text-sm uppercase opacity-70 mb-1">Tweet {i + 1}</div>
                <div className="whitespace-pre-wrap">{seg}</div>
              </div>
            ))}
            {thread.cta ? (
              <div>
                <div className="text-sm uppercase opacity-70 mb-1">CTA</div>
                <div className="whitespace-pre-wrap">{thread.cta}</div>
              </div>
            ) : null}
            {thread.quoteIdea ? (
              <div>
                <div className="text-sm uppercase opacity-70 mb-1">Quote idea</div>
                <div className="whitespace-pre-wrap">{thread.quoteIdea}</div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 text-xs opacity-60">Built with Next.js · OpenAI · Supabase</footer>
    </div>
  );
}
