import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type SaveableTrend = {
	topic: string;
	source: string;
	url?: string | null;
	score?: number;
	body?: string;
	topComment?: string | null;
	timestamp?: string;
};

export async function saveTrendsToSupabase(trends: SaveableTrend[]) {
	if (!supabaseUrl || !supabaseKey) return;
	if (!Array.isArray(trends) || trends.length === 0) return;
	const supabase = createClient(supabaseUrl, supabaseKey);
	const rows = trends.map((t) => ({
		source: t.source,
		title: t.topic,
		body: t.body ?? t.topComment ?? null,
		url: t.url ?? null,
		score: typeof t.score === "number" ? t.score : null,
		created_at: t.timestamp || new Date().toISOString(),
	}));
	await supabase.from("trendformer_trends").insert(rows);
} 