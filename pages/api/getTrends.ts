import type { NextApiRequest, NextApiResponse } from "next";
import { saveTrendsToSupabase } from "@/utils/storage";

export type Trend = {
	topic: string;
	source: "mock" | "explodingtopics" | "glasp" | "reddit" | "hn";
	score?: number;
	timestamp: string;
	url?: string;
	body?: string;
	topComment?: string | null;
};

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function getArray(obj: unknown, key: string): unknown[] | undefined {
	if (!obj || typeof obj !== "object") return undefined;
	const val = (obj as Record<string, unknown>)[key];
	return Array.isArray(val) ? (val as unknown[]) : undefined;
}

function getNested(obj: unknown, path: string[]): unknown {
	let cur: unknown = obj;
	for (const key of path) {
		if (!cur || typeof cur !== "object") return undefined;
		const next = (cur as Record<string, unknown>)[key];
		cur = next;
	}
	return cur;
}

const DEFAULT_SUBREDDITS = [
	"technology",
	"selfimprovement",
	"Fitness",
	"artificial",
	"AskMen",
	"AskWomen",
];

const NICHE_TO_SUBREDDITS: Record<string, string[]> = {
	ai: ["MachineLearning", "ArtificialIntelligence", "OpenAI", "ChatGPT", "LanguageTechnology"],
	fitness: ["Fitness", "bodyweightfitness", "nutrition", "running"],
	dating: ["dating", "AskMen", "AskWomen", "relationships"],
	marketing: ["marketing", "SEO", "Entrepreneur", "content_marketing"],
	crypto: ["CryptoCurrency", "CryptoMarkets", "ethereum", "Bitcoin"],
	freelancing: ["freelance", "digitalnomad", "Entrepreneur", "smallbusiness"],
	startups: ["startups", "Entrepreneur", "SaaS", "smallbusiness"],
	productivity: ["productivity", "selfimprovement", "GetMotivated", "lifehacks"],
};

const NICHE_TO_HN_KEYWORDS: Record<string, string[]> = {
	ai: [" ai ", "ai:", "machine learning", "ml ", "chatgpt", "openai", "llm", "transformer", "gpt"],
	fitness: ["fitness", "workout", "exercise", "health", "sleep"],
	dating: ["dating", "relationships", "romance"],
	marketing: ["marketing", "seo", "growth", "ads", "newsletter"],
	crypto: ["crypto", "bitcoin", "ethereum", "web3", "defi"],
	freelancing: ["freelance", "contract", "gig", "client"],
	startups: ["startup", "funding", "bootstrapping", "saas"],
	productivity: ["productivity", "time management", "focus", "habits"],
};

function normalizeNiche(n: string | undefined): string | undefined {
	if (!n) return undefined;
	return n.toLowerCase();
}

async function fetchExplodingTopics(_niche: string): Promise<Trend[]> {
	// Placeholder for real API integration
	return [];
}

async function fetchGlasp(niche: string): Promise<Trend[]> {
	const baseUrl = process.env.GLASP_API_URL;
	const apiKey = process.env.GLASP_API_KEY;
	if (!baseUrl) return [];
	const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}q=${encodeURIComponent(niche)}`;
	const headers: Record<string, string> = {
		accept: "application/json",
		"user-agent": "trendformer/1.0",
	};
	if (apiKey) {
		headers["authorization"] = `Bearer ${apiKey}`;
		headers["x-api-key"] = apiKey;
	}
	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return [];
		const json: unknown = await res.json();
		const arr = getArray(json, "data") ?? getArray(json, "trends") ?? (isArray(json) ? (json as unknown[]) : []);
		return arr
			.map((itUnknown): Trend | null => {
				const it = itUnknown as Record<string, unknown>;
				const title = getString(it.title) || getString(it.topic) || getString(it.name) || getString(it.headline);
				if (!title) return null;
				return {
					topic: title,
					source: "glasp",
					score: typeof it.score === "number" ? (it.score as number) : undefined,
					timestamp: getString(it.timestamp) || getString(it.created_at) || new Date().toISOString(),
					url: getString(it.url) || getString(it.link),
				};
			})
			.filter(Boolean) as Trend[];
	} catch {
		return [];
	}
}

async function fetchRedditCurated(niche?: string): Promise<Trend[]> {
	const headers = { "user-agent": "trendformer/1.0" } as const;
	const limit = 5;
	const results: Trend[] = [];
	const n = normalizeNiche(niche);
	const list = (n && NICHE_TO_SUBREDDITS[n]) || DEFAULT_SUBREDDITS;
	for (const sub of list) {
		const listUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=${limit}`;
		try {
			const res = await fetch(listUrl, { headers });
			if (!res.ok) continue;
			const json: unknown = await res.json();
			const children = getNested(json, ["data", "children"]);
			if (!isArray(children)) continue;
			for (const cUnknown of children) {
				const p = getNested(cUnknown, ["data"]) as Record<string, unknown> | undefined;
				const title = getString(p?.title);
				if (!title) continue;
				let topComment: string | null = null;
				try {
					const idStr = getString(p?.id);
					if (idStr) {
						const commentsUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/comments/${idStr}.json?limit=1&depth=1&sort=top`;
						const cr = await fetch(commentsUrl, { headers });
						if (cr.ok) {
							const cjson: unknown = await cr.json();
							const listing = isArray(cjson) ? (cjson as unknown[])[1] : undefined;
							const first = getNested(listing, ["data", "children", "0", "data", "body"]);
							topComment = getString(first) ?? null;
						}
					}
				} catch {
					// ignore comment errors
				}
				const createdUtc = (p?.created_utc as number | undefined) ?? undefined;
				const permalink = getString(p?.permalink);
				const overridden = getString(getNested(p, ["url_overridden_by_dest"]));
				results.push({
					topic: title,
					source: "reddit",
					score: typeof p?.score === "number" ? (p.score as number) : undefined,
					timestamp: createdUtc ? new Date(createdUtc * 1000).toISOString() : new Date().toISOString(),
					url: overridden || (permalink ? `https://reddit.com${permalink}` : undefined),
					body: getString(p?.selftext) || undefined,
					topComment,
				});
			}
		} catch {
			// ignore subreddit errors
		}
	}
	return results;
}

async function fetchHackerNewsOfficial(minScore?: number, niche?: string): Promise<Trend[]> {
	try {
		const listRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
		if (!listRes.ok) return [];
		const ids: number[] = await listRes.json();
		const take = ids.slice(0, 60);
		const items = await Promise.all(
			take.map(async (id) => {
				try {
					const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
					if (!r.ok) return null;
					return (await r.json()) as unknown;
				} catch {
					return null;
				}
			})
		);
		const n = normalizeNiche(niche);
		const keywords = (n && NICHE_TO_HN_KEYWORDS[n]) || [];
		return items
			.filter(Boolean)
			.map((itUnknown): Trend | null => {
				const it = itUnknown as Record<string, unknown>;
				const title = getString(it?.title);
				if (!title) return null;
				const score = typeof it?.score === "number" ? (it.score as number) : undefined;
				if (typeof minScore === "number" && typeof score === "number" && score < minScore) {
					return null;
				}
				if (keywords.length > 0) {
					const titleLc = title.toLowerCase();
					const matched = keywords.some((kw) => titleLc.includes(kw.toLowerCase()));
					if (!matched) return null;
				}
				const time = typeof it?.time === "number" ? (it.time as number) : undefined;
				const url = getString(it?.url) || (typeof it?.id === "number" ? `https://news.ycombinator.com/item?id=${it.id as number}` : undefined);
				return {
					topic: title,
					source: "hn",
					score,
					timestamp: time ? new Date(time * 1000).toISOString() : new Date().toISOString(),
					url,
				};
			})
			.filter(Boolean) as Trend[];
	} catch {
		return [];
	}
}

function getMockTrends(niche: string): Trend[] {
	const now = new Date().toISOString();
	const base: Trend[] = [
		{ topic: "AI agents running personal workflows", source: "mock", score: 92, timestamp: now },
		{ topic: "Short-form vertical video SEO tactics", source: "mock", score: 81, timestamp: now },
		{ topic: "Sleep optimization gadgets", source: "mock", score: 74, timestamp: now },
		{ topic: "Cold outreach prompts for freelancers", source: "mock", score: 69, timestamp: now },
		{ topic: "Glucose monitoring for fat loss", source: "mock", score: 65, timestamp: now },
	];
	return base.map((t) => ({ ...t, topic: `${t.topic} — ${niche}` }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	const niche = (req.query.niche as string) || "AI";
	const mockParam = (req.query.mock as string) || "";
	const provider = ((req.query.provider as string) || "all").toLowerCase(); // reddit | hn | glasp | all
	const minScoreParam = Number(req.query.minScore ?? "");
	const minScore = Number.isFinite(minScoreParam) ? (minScoreParam as number) : undefined;
	const saveParam = (req.query.save as string) || "true";
	const shouldSave = saveParam.toLowerCase() !== "false";
	const envMock = (process.env.USE_MOCK_TRENDS || "true").toLowerCase() === "true";
	const useMock = mockParam ? mockParam.toLowerCase() === "true" : envMock;

	try {
		let trends: Trend[] = [];
		if (!useMock) {
			if (provider === "reddit") {
				trends = await fetchRedditCurated(niche);
			} else if (provider === "hn") {
				trends = await fetchHackerNewsOfficial(minScore, niche);
			} else if (provider === "glasp") {
				trends = await fetchGlasp(niche);
			} else {
				const [r, hn, g] = await Promise.all([
					fetchRedditCurated(niche),
					fetchHackerNewsOfficial(minScore, niche),
					fetchGlasp(niche),
				]);
				trends = [...r, ...hn, ...g];
			}
			// fallback to ET if empty
			if (trends.length === 0) {
				trends = (await fetchExplodingTopics(niche)) || [];
			}
		}
		if (useMock || trends.length === 0) {
			trends = getMockTrends(niche);
		}

		if (shouldSave) {
			void saveTrendsToSupabase(trends);
		}

		return res.status(200).json({ niche, provider, mock: useMock, trends });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return res.status(500).json({ error: message || "Unknown error" });
	}
} 