# AMSW Jarvis

Personligt Jarvis-system:

- **Telegram-bot** (`apps/bot`) – tag imod tekst og talebeskeder, opret opgaver/status/mål/velvære, og svar med talebeskeder (OpenAI TTS eller ElevenLabs).
- **Supabase** (`packages/db`) – central database for opgaver, kalender, AMSW-status, mål og velvære, med Row Level Security scoped til dig som bruger.
- **Integrationer** (`packages/integrations`) – henter data ind fra Google Kalender, Todoist og Shopify.
- **Dashboard** (`apps/dashboard`) – Next.js-app der opdaterer sig selv live via Supabase Realtime.

## Struktur

```
apps/
  bot/          Telegram-bot (grammy)
  dashboard/    Next.js live-dashboard
packages/
  core/         Fælles TypeScript-typer
  db/           Supabase-skema (SQL-migrationer) + typed klient
  integrations/ Google Calendar / Todoist / Shopify klienter
```

## 1. Installer afhængigheder

```bash
npm install
```

## 2. Opret Supabase-projekt

1. Opret et projekt på [supabase.com](https://supabase.com).
2. Kør SQL'en i [`packages/db/migrations/0001_init.sql`](packages/db/migrations/0001_init.sql) via SQL-editoren i Supabase Studio.
3. Under **Authentication -> Users**, opret dig selv som bruger (email + password, eller inviter dig selv). Kopiér dit bruger-`id` (uuid) – det skal bruges som `SUPABASE_OWNER_USER_ID`.
4. Under **Authentication -> URL Configuration**, sæt Site URL til der hvor dashboardet kører (f.eks. `http://localhost:3000` under udvikling).
5. Kopiér `Project URL`, `anon public` key og `service_role` key fra **Project Settings -> API**.

## 3. Opret Telegram-bot

1. Skriv til [@BotFather](https://t.me/BotFather) -> `/newbot` -> kopiér token.
2. Find dit eget Telegram-bruger-id via [@userinfobot](https://t.me/userinfobot).

## 4. Google Kalender

1. Opret et projekt i [Google Cloud Console](https://console.cloud.google.com/), aktivér **Google Calendar API**.
2. Opret OAuth 2.0-klient af typen **Desktop app**.
3. Sæt `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` i `.env`.
4. Kør:
   ```bash
   npm run google:auth --workspace=@amsw/integrations
   ```
   Følg linket, godkend adgang, og indsæt den udskrevne `GOOGLE_REFRESH_TOKEN` i `.env`.

## 5. Todoist

Opret et API-token under **Settings -> Integrations -> Developer** i Todoist, og sæt `TODOIST_API_TOKEN`.

## 6. Shopify

Opret en custom app i din butiks admin (**Settings -> Apps -> Develop apps**), giv den `read_orders`-scope, og sæt `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_ADMIN_API_TOKEN`.

## 7. Tale (STT/TTS)

- **Tale ind**: kræver `OPENAI_API_KEY` (Whisper).
- **Tale ud**: sæt `TTS_PROVIDER` til `openai` (samme nøgle, stemme via `OPENAI_TTS_VOICE`) eller `elevenlabs` (kræver `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`).

## 8. Udfyld `.env`

```bash
cp .env.example .env
```

Udfyld alle værdier beskrevet ovenfor. `apps/bot` og `apps/dashboard` læser fra denne fil via `dotenv` / Next.js' indbyggede env-håndtering – kopiér evt. relevante `NEXT_PUBLIC_*` værdier til `apps/dashboard/.env.local` også.

## 9. Kør botten

```bash
npm run bot:dev
```

Skriv eller indtal en besked til botten i Telegram – den bliver automatisk til en opgave. Brug `/help` for alle kommandoer, og `/sync` for at hente data fra Google Kalender, Todoist og Shopify med det samme (kører også automatisk hvert 15. minut).

## 10. Kør dashboardet

```bash
npm run dashboard:dev
```

Åbn `http://localhost:3000`, log ind med magic link (samme email som din Supabase-bruger), og se opgaver, kalender, AMSW-status, mål og velvære opdatere sig selv live.

## Deployment

Botten kører **long-polling** (`bot.start()` i grammy), dvs. den holder selv en åben forbindelse til Telegram og skal derfor køre som en vedvarende proces – ikke som serverless. Dashboardet er en almindelig Next.js-app uden persistent proces (Supabase Realtime kører via websocket direkte i browseren).

### Bot -> Railway

1. Opret et projekt på [railway.app](https://railway.app) og forbind det til dette GitHub-repo (root, ikke `apps/bot` – npm workspaces kræver at installationen sker fra repo-roden).
2. Railway læser [`railway.json`](railway.json) automatisk: `npm install` som build, `npm run bot:start` som start (kører botten via `tsx`, så der er ikke brug for et separat build-trin af de interne pakker).
3. Under **Variables**, indsæt alle nøgler fra din `.env`-fil (samme navne).
4. Deploy. Railway genstarter automatisk botten ved fejl (`restartPolicyType: ON_FAILURE`).

### Dashboard -> Vercel

1. Opret et projekt på [vercel.com](https://vercel.com), forbind til samme repo.
2. Sæt **Root Directory** til `apps/dashboard` (Vercel installerer stadig fra repo-roden og forstår npm workspaces automatisk).
3. Under **Environment Variables**, tilføj `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Under Supabase **Authentication -> URL Configuration**, opdatér Site URL til din Vercel-URL, så magic link-login virker i produktion.
5. Deploy.

## Sikkerhed

- Botten bruger `SUPABASE_SERVICE_ROLE_KEY` og skal derfor **kun** køre server-side (din egen maskine/server) – del den aldrig med dashboardets browser-kode.
- Dashboardet bruger `anon`-nøglen og Supabase Auth; Row Level Security sikrer at kun din egen bruger (`owner_id = auth.uid()`) kan læse/skrive data.
