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

type RankedTrend = {
  index: number;
  relevanceScore: number;
  reasoning: string;
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

// Helper function to get source badge color
const getSourceBadgeColor = (source: string) => {
  switch (source) {
    case "reddit": return "bg-orange-100 text-orange-800";
    case "hn": return "bg-orange-100 text-orange-800";
    case "glasp": return "bg-blue-100 text-blue-800";
    case "explodingtopics": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

export default function Home() {
  const [niche, setNiche] = useState<string>("AI");
  const [tone, setTone] = useState<Tone>("expert");
  const [provider, setProvider] = useState<Provider>("all");

  const [trends, setTrends] = useState<Trend[]>([]);
  const [rankings, setRankings] = useState<RankedTrend[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);
  const [loadingRankings, setLoadingRankings] = useState<boolean>(false);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [thread, setThread] = useState<ThreadOutput | null>(null);

  const selectedTrend = trends[selectedIdx] || null;

  // Organize trends: AI-ranked top 3, then the rest
  const organizedTrends = useMemo(() => {
    if (rankings.length === 0) {
      return { 
        aiPicks: [], 
        others: trends.map((trend, index) => ({ trend, originalIndex: index }))
      };
    }

    const top3Rankings = rankings.slice(0, 3);
    const aiPickIndices = new Set(top3Rankings.map(r => r.index));
    
    const aiPicks = top3Rankings.map(ranking => ({
      trend: trends[ranking.index],
      ranking,
      originalIndex: ranking.index
    })).filter(item => item.trend);

    const others = trends
      .map((trend, index) => ({ trend, originalIndex: index }))
      .filter(item => !aiPickIndices.has(item.originalIndex));

    return { aiPicks, others };
  }, [trends, rankings]);

  const loadTrends = useCallback(async () => {
    try {
      setError("");
      setLoadingTrends(true);
      setLoadingRankings(false);
      setThread(null);
      setSelectedIdx(-1);
      setRankings([]);
      
      const params = new URLSearchParams();
      params.set("mock", "false");
      params.set("provider", provider);
      params.set("niche", niche);
      if (provider === "hn" || provider === "all") params.set("minScore", "100");
      params.set("save", "true");
      const url = `/api/getTrends?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load trends: ${res.status}`);
      const data = await res.json();
      const fetchedTrends = data.trends || [];
      setTrends(fetchedTrends);
      
      // Auto-rank trends with AI if we have them
      if (fetchedTrends.length > 0) {
        await rankTrendsWithAI(fetchedTrends);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Failed to fetch trends");
    } finally {
      setLoadingTrends(false);
    }
  }, [provider, niche]);

  const rankTrendsWithAI = useCallback(async (trendsToRank: Trend[]) => {
    try {
      setLoadingRankings(true);
      const res = await fetch('/api/rankTrends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ niche, trends: trendsToRank })
      });
      
      if (!res.ok) {
        console.warn('AI ranking failed, continuing without rankings');
        return;
      }
      
      const data = await res.json();
      setRankings(data.rankings || []);
      
      // Auto-select the top AI pick
      if (data.rankings && data.rankings.length > 0) {
        setSelectedIdx(data.rankings[0].index);
      }
    } catch (e) {
      console.warn('AI ranking failed:', e);
      // Continue without rankings - not a critical failure
    } finally {
      setLoadingRankings(false);
    }
  }, [niche]);

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Failed to generate thread");
    } finally {
      setLoadingThread(false);
    }
  }, [niche, tone, trends, selectedIdx]);

  const remix = useCallback(async () => {
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

  const copySegment = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
  }, []);

  const handleTrendSelect = useCallback((originalIndex: number) => {
    setSelectedIdx(originalIndex);
  }, []);

  return (
    <div className="font-sans min-h-screen bg-white px-6 sm:px-10 py-6 sm:py-10 max-w-5xl mx-auto flex flex-col gap-8">
      {/* Hero Section */}
      <section className="pt-8 sm:pt-16 pb-2 sm:pb-4 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">Trendformer</h1>
        <p className="mt-3 text-sm sm:text-base opacity-80">Transform trending topics into viral Twitter threads with AI-powered insights.</p>
      </section>

      {/* Controls Section */}
      <section className="section">
        <div className="grid sm:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2">
            <label className="label">Niche</label>
            <select value={niche} onChange={(e) => setNiche(e.target.value)} className="select">
              {NICHES.map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="label">Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="select">
              {TONES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="label">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="select">
              {PROVIDERS.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="label">Action</label>
            <button onClick={loadTrends} className="btn btn-primary h-[42px]" disabled={loadingTrends}>
              {loadingTrends ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Fetching...
                </>
              ) : (
                "Fetch Trends"
              )}
            </button>
          </div>
        </div>

        {loadingRankings && (
          <div className="flex items-center gap-2 text-sm opacity-80 mt-4">
            <div className="w-3 h-3 border-2 border-[var(--muted)] border-t-[var(--fg)] rounded-full animate-spin"></div>
            AI analyzing trends...
          </div>
        )}
      </section>

      {error ? (
        <section className="section border-red-300 bg-red-50">
          <div className="text-red-800 text-sm font-medium">Error</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </section>
      ) : null}

      {/* Main Content */}
      <section className={`grid gap-4 ${thread ? 'lg:grid-cols-[1fr_1.2fr]' : 'lg:grid-cols-[4fr_1fr]'}`}>
        {/* Trends Section */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-lg">Trending Topics</h3>
            {trends.length > 0 && (
              <div className="text-sm opacity-80">{trends.length} trends found</div>
            )}
          </div>
          
          {loadingTrends ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="section animate-pulse">
                  <div className="h-4 bg-black/10 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-black/10 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : trends.length === 0 ? (
            <div className="section text-center">
              <div className="text-4xl mb-3">📈</div>
              <div className="font-medium mb-1">No trends loaded yet</div>
              <div className="text-sm opacity-80">Configure your preferences and click "Fetch Trends"</div>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto">
              {/* AI-Selected Top Picks */}
              {organizedTrends.aiPicks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                    <h4 className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                      AI Picks - Most Pertinent
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {organizedTrends.aiPicks.slice(0, 2).map(({ trend, ranking, originalIndex }, idx) => (
                      <div
                        key={`ai-${originalIndex}`}
                        className={`section cursor-pointer relative overflow-hidden transition-all hover:shadow-lg ${
                          selectedIdx === originalIndex
                            ? 'bg-gradient-to-r from-purple-50 to-pink-50'
                            : 'hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50'
                        }`}
                        onClick={() => handleTrendSelect(originalIndex)}
                      >
                        {/* Gradient border effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl"></div>
                        <div className="relative">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {idx + 1}
                              </div>
                              <h4 className="font-medium leading-tight flex-1 min-w-0">{trend.topic}</h4>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-mono bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded-full">
                                {ranking.relevanceScore.toFixed(1)}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${getSourceBadgeColor(trend.source)}`}>
                                {trend.source}
                              </span>
                              {trend.score && (
                                <span className="text-xs opacity-80 font-mono">
                                  {trend.score}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-xs text-purple-700 mb-2 font-medium">
                            💡 {ranking.reasoning}
                          </div>
                          
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs opacity-80">
                              {new Date(trend.timestamp).toLocaleString()}
                            </div>
                            {trend.url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(trend.url, '_blank');
                                }}
                                className="text-xs text-purple-600 hover:underline flex-shrink-0"
                              >
                                Open Link →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Trends */}
              {organizedTrends.others.length > 0 && (
                <div>
                  {organizedTrends.aiPicks.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 mt-6">
                      <div className="w-2 h-2 bg-black/40 rounded-full"></div>
                      <h4 className="text-sm font-medium opacity-80">
                        Other Trends
                      </h4>
                    </div>
                  )}
                  <div className="space-y-3">
                    {organizedTrends.others.map((item) => (
                      <div
                        key={`other-${item.originalIndex}`}
                        className={`section cursor-pointer transition-all hover:shadow-sm ${
                          selectedIdx === item.originalIndex
                            ? 'ring-2 ring-black/30 bg-black/5'
                            : 'hover:bg-black/5'
                        }`}
                        onClick={() => handleTrendSelect(item.originalIndex)}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-medium leading-tight flex-1 min-w-0">{item.trend.topic}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getSourceBadgeColor(item.trend.source)}`}>
                              {item.trend.source}
                            </span>
                            {item.trend.score && (
                              <span className="text-xs opacity-80 font-mono">
                                {item.trend.score}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs opacity-80">
                            {new Date(item.trend.timestamp).toLocaleString()}
                          </div>
                          {item.trend.url && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.trend.url, '_blank');
                              }}
                              className="text-xs opacity-80 hover:underline flex-shrink-0"
                            >
                              Open Link →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

                {/* Generate Button / Thread Output */}
        <div className="flex flex-col min-w-0">
          {!thread && trends.length > 0 ? (
            <div className="sticky top-6">
              {selectedTrend ? (
                <div className="section text-center">
                  <div className="text-2xl mb-2">✨</div>
                  <div className="text-sm font-medium mb-1">Ready to generate!</div>
                  <div className="text-xs opacity-80 mb-3 line-clamp-2 min-w-0">{selectedTrend.topic}</div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={generate} 
                      className="btn btn-primary w-full" 
                      disabled={loadingThread}
                    >
                      {loadingThread ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        "Generate Thread"
                      )}
                    </button>

                  </div>
                </div>
              ) : (
                <div className="section text-center">
                  <div className="text-2xl mb-2">🎯</div>
                  <div className="text-sm font-medium mb-1">Select a trend</div>
                  <div className="text-xs opacity-80">Click on any trend to generate content</div>
                </div>
              )}
            </div>
          ) : thread ? (
            <section className="section">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-medium text-lg">Generated Thread</h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={remix} 
                    className="btn" 
                    disabled={loadingThread}
                  >
                    {loadingThread ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--muted)] border-t-[var(--fg)] rounded-full animate-spin"></div>
                        Remixing...
                      </>
                    ) : (
                      "Remix"
                    )}
                  </button>
                  <button onClick={copyAll} className="text-xs underline opacity-80">
                    Copy All
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium opacity-80">Hook</div>
                    <button 
                      onClick={() => copySegment(thread.title)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs underline opacity-80"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="whitespace-pre-wrap p-3 bg-black/5 rounded-lg border border-black/10 text-sm">
                    {thread.title}
                  </div>
                </div>
                
                {thread.segments?.map((seg, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium opacity-80">Tweet {i + 1}</div>
                      <button 
                        onClick={() => copySegment(seg)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs underline opacity-80"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap p-3 bg-black/5 rounded-lg border border-black/10 text-sm">
                      {seg}
                    </div>
                  </div>
                ))}
                
                {thread.cta ? (
                  <div className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium opacity-80">CTA</div>
                      <button 
                        onClick={() => copySegment(thread.cta!)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs underline opacity-80"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap p-3 bg-black/5 rounded-lg border border-black/10 text-sm">
                      {thread.cta}
                    </div>
                  </div>
                ) : null}
                
                {thread.quoteIdea ? (
                  <div className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium opacity-80">Quote Idea</div>
                      <button 
                        onClick={() => copySegment(thread.quoteIdea!)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs underline opacity-80"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap p-3 bg-black/5 rounded-lg border border-black/10 text-sm">
                      {thread.quoteIdea}
                    </div>
                  </div>
                ) : null}
                              </div>
              </section>
          ) : null}
        </div>
      </section>

      <footer className="mt-8 text-xs opacity-60 text-center">Built with Next.js · OpenAI · Supabase</footer>
    </div>
  );
}
