"use client";

import { useCallback, useMemo, useState } from "react";

type Tone = "degen" | "contrarian" | "expert";

type Trend = {
  topic: string;
  source: "mock" | "explodingtopics" | "glasp";
  score?: number;
  timestamp: string;
};

type ThreadOutput = {
  title: string;
  segments: string[];
  cta?: string;
  quoteIdea?: string;
};

const NICHES = [
  "AI",
  "Fitness",
  "Dating",
  "Marketing",
  "Crypto",
  "Freelancing",
  "Startups",
  "Productivity",
];

const TONES: Tone[] = ["degen", "contrarian", "expert"];

export default function Home() {
  const [niche, setNiche] = useState<string>("AI");
  const [tone, setTone] = useState<Tone>("expert");
  const [trends, setTrends] = useState<Trend[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [thread, setThread] = useState<ThreadOutput | null>(null);

  const loadTrends = useCallback(async () => {
    try {
      setError("");
      setLoadingTrends(true);
      setThread(null);
      setSelectedTopic("");
      const res = await fetch(`/api/getTrends?niche=${encodeURIComponent(niche)}`);
      if (!res.ok) throw new Error(`Failed to load trends: ${res.status}`);
      const data = await res.json();
      setTrends(data.trends || []);
      if ((data.trends || []).length > 0) {
        setSelectedTopic(data.trends[0].topic as string);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch trends");
    } finally {
      setLoadingTrends(false);
    }
  }, [niche]);

  const generate = useCallback(async () => {
    if (!selectedTopic) {
      setError("Pick a topic first");
      return;
    }
    try {
      setError("");
      setLoadingThread(true);
      setThread(null);
      const res = await fetch(`/api/generateThread`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ niche, topic: selectedTopic, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to generate: ${res.status}`);
      setThread(data.thread as ThreadOutput);
    } catch (e: any) {
      setError(e?.message || "Failed to generate thread");
    } finally {
      setLoadingThread(false);
    }
  }, [niche, selectedTopic, tone]);

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

      <section className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm">Niche</label>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="border rounded-md px-3 py-2 bg-transparent"
          >
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="border rounded-md px-3 py-2 bg-transparent"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={loadTrends}
            className="border rounded-md px-4 py-2 w-full sm:w-auto hover:bg-black/5"
            disabled={loadingTrends}
          >
            {loadingTrends ? "Loading trends..." : "Fetch Trends"}
          </button>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="sm:col-span-2 flex flex-col gap-2">
          <label className="text-sm">Trending topics</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="border rounded-md px-3 py-2 bg-transparent"
          >
            <option value="" disabled>
              {trends.length ? "Select a topic" : "Fetch trends to load topics"}
            </option>
            {trends.map((t, idx) => (
              <option key={`${t.topic}-${idx}`} value={t.topic}>
                {t.topic}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={generate}
            className="border rounded-md px-4 py-2 w-full hover:bg-black/5"
            disabled={loadingThread || !selectedTopic}
          >
            {loadingThread ? "Generating..." : "Generate Thread"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="mb-6 text-red-600 text-sm">{error}</div>
      ) : null}

      {thread ? (
        <section className="border rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Preview</h2>
            <button onClick={copyAll} className="border rounded-md px-3 py-1.5 hover:bg-black/5 text-sm">
              Copy all
            </button>
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

      <footer className="mt-10 text-xs opacity-60">
        Built with Next.js · OpenAI · Supabase
      </footer>
    </div>
  );
}
