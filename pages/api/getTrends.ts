import type { NextApiRequest, NextApiResponse } from "next";

export type Trend = {
	topic: string;
	source: "mock" | "explodingtopics" | "glasp";
	score?: number;
	timestamp: string;
};

async function fetchExplodingTopics(niche: string): Promise<Trend[]> {
	// Placeholder for real API integration
	return [];
}

async function fetchGlasp(niche: string): Promise<Trend[]> {
	// Placeholder for real API integration
	return [];
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
	const useMock = (process.env.USE_MOCK_TRENDS || "true").toLowerCase() === "true";

	try {
		let trends: Trend[] = [];
		if (!useMock) {
			trends = (await fetchExplodingTopics(niche)) || [];
			if (trends.length === 0) {
				trends = (await fetchGlasp(niche)) || [];
			}
		}
		if (useMock || trends.length === 0) {
			trends = getMockTrends(niche);
		}
		return res.status(200).json({ niche, trends });
	} catch (err: any) {
		return res.status(500).json({ error: err?.message || "Unknown error" });
	}
} 