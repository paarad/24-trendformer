import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { z } from "zod";
import { toneSystemPrompts, buildThreadInstructions, type Tone, type ThreadOutput } from "@/utils/promptTemplates";
import { recordTelemetry } from "@/utils/telemetry";

const bodySchema = z.object({
	niche: z.string().min(1),
	topic: z.string().min(1),
	tone: z.union([z.literal("degen"), z.literal("contrarian"), z.literal("expert")]),
	context: z.string().optional(),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const parse = bodySchema.safeParse(req.body);
	if (!parse.success) {
		return res.status(400).json({ error: "Invalid body", details: parse.error.flatten() });
	}

	const { niche, topic, tone, context } = parse.data as { niche: string; topic: string; tone: Tone; context?: string };

	try {
		if (!openai.apiKey) {
			return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
		}

		const system = toneSystemPrompts[tone];
		const instructions = buildThreadInstructions(niche, topic, tone, context);

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: instructions },
			],
			response_format: { type: "json_object" },
			temperature: 0.7,
		});

		const raw = response.choices?.[0]?.message?.content || "{}";
		const parsed = JSON.parse(raw) as ThreadOutput;

		void recordTelemetry({ feature: "generateThread", metadata: { tone, niche } });

		return res.status(200).json({ thread: parsed });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return res.status(500).json({ error: message || "Unknown error" });
	}
} 