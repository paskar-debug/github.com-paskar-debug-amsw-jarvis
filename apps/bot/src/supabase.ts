import { createServiceClient } from "@amsw/db";
import { env } from "./env.js";

export const supabase = createServiceClient(env.supabaseUrl, env.supabaseServiceRoleKey);
