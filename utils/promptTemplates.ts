export type Tone = "degen" | "contrarian" | "expert";

export const toneSystemPrompts: Record<Tone, string> = {
	degen:
		"You are a bold, unfiltered, hype Degen Twitter creator. You write punchy, meme-aware threads with high energy, crisp sentences, and occasional crypto slang. Never be offensive.",
	contrarian:
		"You are a contrarian thinker. You challenge assumptions, provide spicy but reasoned hot takes, and back them with logic. Keep it concise and insightful.",
	expert:
		"You are an expert educator. You write clean, structured, insight-first threads with clear takeaways and practical advice.",
};

export type ThreadOutput = {
	title: string;
	segments: string[]; // 6-10 tweet segments
	cta?: string;
	quoteIdea?: string;
};

export function buildThreadInstructions(niche: string, topic: string, tone: Tone): string {
	return [
		`Niche: ${niche}`,
		`Trending topic: ${topic}`,
		"Return structured, platform-ready Twitter thread copy:",
		"- Title/hook on first tweet",
		"- 6–10 numbered tweet segments, each < 280 chars",
		"- Optional CTA or quote-tweet idea",
		"Keep formatting clean. No hashtags unless natural. Avoid emojis unless tone strongly implies.",
	].join("\n");
} 