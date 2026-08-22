"use client";

import { useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  // Every new code invalidates whatever code was already sent (Supabase keeps only one active
  // token per user) - an un-disabled button invited exactly that: a double-click (or an
  // impatient second click while the first request was still in flight) silently generates a
  // second email whose code supersedes the first, before the person reading the first email has
  // even had a chance to use it.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const { error } = await getSupabaseClient().auth.signInWithOtp({ email });
      if (error) setError(error.message);
      else setSent(true);
    } finally {
      setSending(false);
    }
  }

  // Backup path for browser contexts where the email flow can't complete at all - installed
  // "Add to Dock"/Home Screen web app windows use storage isolated from regular Safari, so a
  // session established there never appears here, and there's no address bar for an email link
  // to land back in this exact window either. Gated by a secret only the owner has, since the
  // email round-trip is precisely the thing that doesn't work in this context.
  async function handlePassphrase(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("https://dqqseqhzqleqbabvuyni.supabase.co/functions/v1/owner-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: passphrase }),
      });
      const data = (await res.json()) as { access_token?: string; refresh_token?: string; error?: string };
      if (!res.ok || !data.access_token || !data.refresh_token) {
        setError(data.error ?? "Login fejlede.");
        return;
      }
      // Repeated failed attempts in this window can leave a stale/partial session in local
      // storage, which the client then tries to refresh (and fails) before accepting the new
      // one. Clear it first so setSession always starts from a clean slate.
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) window.localStorage.removeItem(key);
      }
      const { error } = await getSupabaseClient().auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) setError(error.message);
    } catch (err) {
      // A fetch-level failure (CORS, offline, DNS) throws instead of returning an { error }
      // shape - without this, it was silently swallowed: verifying reset via finally, but
      // nothing ever told the user why nothing happened.
      setError(`Netværksfejl: ${(err as Error).message}`);
    } finally {
      setVerifying(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    // Supabase routes signInWithOtp for an existing, already-confirmed user through its
    // recovery-token mechanism internally (confirmed directly against auth.one_time_tokens) -
    // "email" looks like the right type but only matches a separate, unrelated code path.
    const { error } = await getSupabaseClient().auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
    setVerifying(false);
    if (error) setError(error.message);
    // On success, onAuthStateChange in the dashboard picks up the new session and redirects.
  }

  if (sent) {
    return (
      <div className="page">
        <form className="login-form" onSubmit={handleVerify}>
          <Image src="/logo-icon.png" alt="Paramasamy" width={104} height={111} priority />
          <p>
            Tjek din indbakke ({email}). I en almindelig browser: klik linket i mailen - det er hurtigst og mest
            pålideligt. I en installeret app uden adresselinje: skriv koden fra mailen herunder i stedet.
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Login-kode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" disabled={verifying}>
            {verifying ? "Bekræfter..." : "Log ind med kode"}
          </button>
          {error && <p style={{ color: "var(--red)" }}>{error}</p>}
        </form>
      </div>
    );
  }

  if (usePassphrase) {
    return (
      <div className="page">
        <form className="login-form" onSubmit={handlePassphrase}>
          <Image src="/logo-icon.png" alt="Paramasamy" width={104} height={111} priority />
          <input
            type="password"
            placeholder="Adgangskode"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" disabled={verifying}>
            {verifying ? "Logger ind..." : "Log ind"}
          </button>
          {error && <p style={{ color: "var(--red)" }}>{error}</p>}
          <button type="button" className="login-link-button" onClick={() => setUsePassphrase(false)}>
            Brug e-mail i stedet
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="login-form" onSubmit={handleSubmit}>
        <Image src="/logo-icon.png" alt="Paramasamy" width={104} height={111} priority />
        <input
          type="email"
          placeholder="din@email.dk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={sending}>
          {sending ? "Sender..." : "Send login-kode"}
        </button>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
        <button type="button" className="login-link-button" onClick={() => setUsePassphrase(true)}>
          Virker e-mail ikke her? Brug adgangskode
        </button>
      </form>
    </div>
  );
}
