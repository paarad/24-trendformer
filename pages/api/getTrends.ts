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

const CURATED_SUBREDDITS = [
	"technology",
	"selfimprovement",
	"Fitness",
	"artificial",
	"AskMen",
	"AskWomen",
];

async function fetchExplodingTopics(niche: string): Promise<Trend[]> {
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
		const json = await res.json();
		const arr: any[] = Array.isArray(json)
			? json
			: Array.isArray(json?.data)
				? json.data
				: Array.isArray(json?.trends)
				? json.trends
				: [];
		return arr
			.map((it: any): Trend | null => {
				const title = it?.title || it?.topic || it?.name || it?.headline;
				if (!title) return null;
				return {
					topic: String(title),
					source: "glasp",
					score: typeof it?.score === "number" ? it.score : undefined,
					timestamp: it?.timestamp || it?.created_at || new Date().toISOString(),
					url: it?.url || it?.link,
				};
			})
			.filter(Boolean) as Trend[];
	} catch {
		return [];
	}
}

async function fetchRedditCurated(): Promise<Trend[]> {
	const headers = { "user-agent": "trendformer/1.0" } as const;
	const limit = 5;
	const results: Trend[] = [];
	for (const sub of CURATED_SUBREDDITS) {
		const listUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=${limit}`;
		try {
			const res = await fetch(listUrl, { headers });
			if (!res.ok) continue;
			const json = await res.json();
			const children: any[] = json?.data?.children ?? [];
			for (const c of children) {
				const p = c?.data;
				if (!p?.title) continue;
				let topComment: string | null = null;
				try {
					const commentsUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/comments/${p.id}.json?limit=1&depth=1&sort=top`;
					const cr = await fetch(commentsUrl, { headers });
					if (cr.ok) {
						const cjson = await cr.json();
						const commentsListing = Array.isArray(cjson) ? cjson[1] : null;
						const first = commentsListing?.data?.children?.[0]?.data?.body;
						topComment = typeof first === "string" ? first : null;
					}
				} catch {
					// ignore comment errors
				}
				results.push({
					topic: p.title as string,
					source: "reddit",
					score: typeof p.score === "number" ? p.score : undefined,
					timestamp: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
					url: p.url_overridden_by_dest || (p.permalink ? `https://reddit.com${p.permalink}` : undefined),
					body: p.selftext || undefined,
					topComment,
				});
			}
		} catch {
			// ignore subreddit errors
		}
	}
	return results;
}

async function fetchHackerNewsOfficial(minScore?: number): Promise<Trend[]> {
	try {
		const listRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
		if (!listRes.ok) return [];
		const ids: number[] = await listRes.json();
		const take = ids.slice(0, 50);
		const items = await Promise.all(
			take.map(async (id) => {
				try {
					const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
					if (!r.ok) return null;
					return (await r.json()) as any;
				} catch {
					return null;
				}
			})
		);
		return items
			.filter(Boolean)
			.map((it: any): Trend | null => {
				if (!it?.title) return null;
				if (typeof minScore === "number" && typeof it?.score === "number" && it.score < minScore) {
					return null;
				}
				return {
					topic: it.title as string,
					source: "hn",
					score: typeof it.score === "number" ? it.score : undefined,
					timestamp: it?.time ? new Date(it.time * 1000).toISOString() : new Date().toISOString(),
					url: it?.url || (it?.id ? `https://news.ycombinator.com/item?id=${it.id}` : undefined),
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
				trends = await fetchRedditCurated();
			} else if (provider === "hn") {
				trends = await fetchHackerNewsOfficial(minScore);
			} else if (provider === "glasp") {
				trends = await fetchGlasp(niche);
			} else {
				const [r, hn, g] = await Promise.all([
					fetchRedditCurated(),
					fetchHackerNewsOfficial(minScore),
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
	} catch (err: any) {
		return res.status(500).json({ error: err?.message || "Unknown error" });
	}
} 