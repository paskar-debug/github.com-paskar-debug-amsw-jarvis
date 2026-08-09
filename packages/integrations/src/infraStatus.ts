// Checks the health/plan of the platforms AMSW Jarvis itself runs on
// (Supabase, Vercel, Railway, OpenAI, Anthropic) - distinct from the
// business integrations in googleCalendar.ts / shopify.ts, which sync
// actual data. A thrown error here means "not operational right now".

export interface InfraServiceStatus {
  plan: string | null;
  detail: Record<string, unknown>;
}

export async function checkSupabaseStatus(cfg: { accessToken: string; projectUrl: string }): Promise<InfraServiceStatus> {
  const projectRef = new URL(cfg.projectUrl).hostname.split(".")[0];
  const headers = { Authorization: `Bearer ${cfg.accessToken}` };

  const projectRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, { headers });
  if (!projectRes.ok) throw new Error(`Supabase projekt-opslag fejlede: ${projectRes.status}`);
  const project = (await projectRes.json()) as { status: string; organization_slug: string };

  const orgRes = await fetch(`https://api.supabase.com/v1/organizations/${project.organization_slug}`, { headers });
  if (!orgRes.ok) throw new Error(`Supabase organisations-opslag fejlede: ${orgRes.status}`);
  const org = (await orgRes.json()) as { plan: string };

  if (project.status !== "ACTIVE_HEALTHY") {
    throw new Error(`Supabase-projekt status: ${project.status}`);
  }

  return { plan: org.plan, detail: { projectStatus: project.status } };
}

export async function checkVercelStatus(cfg: { apiToken: string; projectName: string }): Promise<InfraServiceStatus> {
  const res = await fetch("https://api.vercel.com/v9/projects", {
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
  });
  if (!res.ok) throw new Error(`Vercel API fejlede: ${res.status}`);
  const data = (await res.json()) as {
    projects: Array<{ name: string; latestDeployments?: Array<{ readyState: string; plan: string }> }>;
  };
  const project = data.projects.find((p) => p.name === cfg.projectName);
  if (!project) throw new Error(`Vercel-projekt "${cfg.projectName}" ikke fundet`);

  const latest = project.latestDeployments?.[0];
  if (latest && latest.readyState !== "READY") {
    throw new Error(`Seneste Vercel-deploy status: ${latest.readyState}`);
  }

  return { plan: latest?.plan ?? null, detail: { deployState: latest?.readyState ?? "ukendt" } };
}

export async function checkRailwayStatus(cfg: { apiToken: string }): Promise<InfraServiceStatus> {
  const headers = { Authorization: `Bearer ${cfg.apiToken}`, "Content-Type": "application/json" };

  const projectsRes = await fetch("https://backboard.railway.app/graphql/v2", {
    method: "POST",
    headers,
    body: JSON.stringify({ query: "{ projects { edges { node { workspaceId } } } }" }),
  });
  const projectsJson = (await projectsRes.json()) as {
    errors?: Array<{ message: string }>;
    data?: { projects: { edges: Array<{ node: { workspaceId: string } }> } };
  };
  if (projectsJson.errors) throw new Error(`Railway API fejlede: ${projectsJson.errors[0].message}`);
  const workspaceId = projectsJson.data?.projects.edges[0]?.node.workspaceId;
  if (!workspaceId) throw new Error("Intet Railway-projekt fundet");

  const wsRes = await fetch("https://backboard.railway.app/graphql/v2", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query:
        "query($id: String!) { workspace(workspaceId: $id) { plan customer { isTrialing trialDaysRemaining remainingUsageCreditBalance hasExhaustedFreePlan } } }",
      variables: { id: workspaceId },
    }),
  });
  const wsJson = (await wsRes.json()) as {
    errors?: Array<{ message: string }>;
    data?: {
      workspace: {
        plan: string;
        customer: {
          isTrialing: boolean;
          trialDaysRemaining: number;
          remainingUsageCreditBalance: number;
          hasExhaustedFreePlan: boolean;
        };
      };
    };
  };
  if (wsJson.errors) throw new Error(`Railway workspace-opslag fejlede: ${wsJson.errors[0].message}`);
  const workspace = wsJson.data!.workspace;

  if (workspace.customer.hasExhaustedFreePlan) {
    throw new Error("Railway trial/credit er opbrugt");
  }

  return {
    plan: workspace.plan,
    detail: {
      isTrialing: workspace.customer.isTrialing,
      trialDaysRemaining: workspace.customer.trialDaysRemaining,
      creditBalance: Math.round(workspace.customer.remainingUsageCreditBalance * 100) / 100,
    },
  };
}

/** Makes a 1-token completion call, which fails with insufficient_quota if the account has no credits left. */
export async function checkOpenAiStatus(cfg: { apiKey: string }): Promise<InfraServiceStatus> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `OpenAI API fejlede: ${res.status}`);
  }
  return { plan: null, detail: {} };
}

/** Makes a 1-token message call as a real end-to-end check (mirrors the classification calls the bot actually makes). */
export async function checkAnthropicStatus(cfg: { apiKey: string }): Promise<InfraServiceStatus> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Anthropic API fejlede: ${res.status}`);
  }
  return { plan: null, detail: {} };
}
