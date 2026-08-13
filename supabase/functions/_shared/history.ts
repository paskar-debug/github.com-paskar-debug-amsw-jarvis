import { OWNER_ID, serviceClient } from "./db.ts";

// Backend-only conversation memory: gives the assistant continuity across sessions without ever
// being read back into the dashboard UI (someone glancing at an already-logged-in screen should
// not be able to browse past chats there).
const HISTORY_LIMIT = 20;

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export async function loadRecentHistory(): Promise<HistoryTurn[]> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("role, content")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error || !data) return [];
  return data.reverse();
}

export async function saveHistoryTurn(role: "user" | "assistant", content: string): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.from("assistant_messages").insert({ owner_id: OWNER_ID, role, content });
  if (error) console.error("Kunne ikke gemme samtale-hukommelse:", error);
}
