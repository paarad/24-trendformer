import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type TelemetryEvent = {
	feature: string; // e.g., "generateThread"
	metadata?: Record<string, string | number | boolean | null>;
};

export async function recordTelemetry(event: TelemetryEvent) {
	if (!supabaseUrl || !supabaseKey) return;
	const supabase = createClient(supabaseUrl, supabaseKey);
	await supabase.from("telemetry_events").insert({
		feature: event.feature,
		metadata: event.metadata ?? {},
		created_at: new Date().toISOString(),
	});
} 