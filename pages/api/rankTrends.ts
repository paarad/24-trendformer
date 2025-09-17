import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { z } from "zod";

const bodySchema = z.object({
	niche: z.string().min(1),
	trends: z.array(z.object({
		topic: z.string(),
		source: z.string(),
		score: z.number().optional(),
		url: z.string().optional(),
		body: z.string().optional(),
		topComment: z.string().optional().nullable()
	})).min(1).max(50) // Reasonable limits
});

export type RankedTrend = {
	index: number; // Original index in the trends array
	relevanceScore: number; // AI-assigned score 1-10
	reasoning: string; // Why this trend is relevant
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildRankingPrompt(niche: string, trends: Array<{topic: string; source: string; score?: number; body?: string; topComment?: string | null}>): string {
	const trendsList = trends.map((t, i) => 
		`${i}: "${t.topic}" (${t.source}, score: ${t.score || 'N/A'})\n   Context: ${(t.body || t.topComment || '').slice(0, 200)}...`
	).join('\n\n');

	return `You are an expert content strategist analyzing trending topics for the ${niche} niche.

Analyze these ${trends.length} trends and rank them by relevance and potential for viral Twitter content:

${trendsList}

Consider:
- Relevance to ${niche} audience interests
- Timeliness and trending momentum  
- Controversy/discussion potential
- Actionable insights for the audience
- Content creation opportunities

Return JSON with exactly this format:
{
  "rankings": [
    {
      "index": 0,
      "relevanceScore": 8.5,
      "reasoning": "Brief explanation of why this trend is highly relevant"
    }
  ]
}

Rank ALL trends provided. Sort by relevanceScore (highest first). Use scores 1-10 (decimals ok).`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const parse = bodySchema.safeParse(req.body);
	if (!parse.success) {
		return res.status(400).json({ error: "Invalid body", details: parse.error.flatten() });
	}

	const { niche, trends } = parse.data;

	try {
		if (!openai.apiKey) {
			return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
		}

		const prompt = buildRankingPrompt(niche, trends);

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ 
					role: "system", 
					content: "You are an expert content strategist. Analyze trends and return only valid JSON." 
				},
				{ role: "user", content: prompt },
			],
			response_format: { type: "json_object" },
			temperature: 0.3, // Lower temperature for more consistent rankings
		});

		const raw = response.choices?.[0]?.message?.content || "{}";
		const parsed = JSON.parse(raw) as { rankings: RankedTrend[] };

		// Validate and sort rankings
		const rankings = (parsed.rankings || [])
			.filter(r => typeof r.index === 'number' && r.index >= 0 && r.index < trends.length)
			.sort((a, b) => b.relevanceScore - a.relevanceScore);

		return res.status(200).json({ rankings });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return res.status(500).json({ error: message || "Unknown error" });
	}
} 