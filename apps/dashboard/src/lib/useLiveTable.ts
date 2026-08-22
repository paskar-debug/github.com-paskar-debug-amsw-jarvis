"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "./supabaseClient";

export interface LiveTableResult<Row> {
  rows: Row[];
  /** True until the first successful fetch resolves - lets panels show a skeleton instead of a premature "empty" state. */
  isLoading: boolean;
  /** Briefly true right after a Realtime-triggered refetch (not the initial load), for a subtle "this just updated" cue. */
  flash: boolean;
}

/**
 * Loads all rows for a table (scoped to the logged-in user by RLS) and keeps
 * them live-updated via a Supabase Realtime subscription.
 */
export function useLiveTable<TableName extends "tasks" | "calendar_events" | "amsw_status" | "drafts" | "integration_sync_state" | "user_facts" | "goals", Row>(
  table: TableName,
  userId: string | null,
  order: { column: string; ascending?: boolean },
): LiveTableResult<Row> {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    let cancelled = false;
    let flashTimeout: ReturnType<typeof setTimeout> | undefined;

    async function load(isRealtimeUpdate: boolean) {
      // `table` is a union of literal names here, which trips up postgrest-js's
      // distributive generic inference on .from(); the Row type is already
      // pinned by the caller's explicit generic, so a local cast is safe.
      const { data } = await (supabase.from(table) as any)
        .select("*")
        .eq("owner_id", userId)
        .order(order.column, { ascending: order.ascending ?? true });
      if (cancelled || !data) return;
      setRows(data as Row[]);
      setIsLoading(false);
      if (isRealtimeUpdate) {
        setFlash(true);
        clearTimeout(flashTimeout);
        flashTimeout = setTimeout(() => setFlash(false), 700);
      }
    }
    load(false);

    const channel = supabase
      .channel(`live:${table}:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `owner_id=eq.${userId}` },
        () => load(true),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(flashTimeout);
      supabase.removeChannel(channel);
    };
  }, [table, userId, order.column, order.ascending]);

  return { rows, isLoading, flash };
}
