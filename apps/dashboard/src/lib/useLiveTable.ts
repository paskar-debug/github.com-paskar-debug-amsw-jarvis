"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "./supabaseClient";

/**
 * Loads all rows for a table (scoped to the logged-in user by RLS) and keeps
 * them live-updated via a Supabase Realtime subscription.
 */
export function useLiveTable<TableName extends "tasks" | "calendar_events" | "amsw_status" | "wellbeing_entries" | "drafts" | "integration_sync_state", Row>(
  table: TableName,
  userId: string | null,
  order: { column: string; ascending?: boolean },
): Row[] {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    let cancelled = false;

    async function load() {
      // `table` is a union of literal names here, which trips up postgrest-js's
      // distributive generic inference on .from(); the Row type is already
      // pinned by the caller's explicit generic, so a local cast is safe.
      const { data } = await (supabase.from(table) as any)
        .select("*")
        .eq("owner_id", userId)
        .order(order.column, { ascending: order.ascending ?? true });
      if (!cancelled && data) setRows(data as Row[]);
    }
    load();

    const channel = supabase
      .channel(`live:${table}:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `owner_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table, userId, order.column, order.ascending]);

  return rows;
}
