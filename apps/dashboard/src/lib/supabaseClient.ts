"use client";

import { createBrowserClient, type TypedSupabaseClient } from "@amsw/db";

let client: TypedSupabaseClient | undefined;

export function getSupabaseClient(): TypedSupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
