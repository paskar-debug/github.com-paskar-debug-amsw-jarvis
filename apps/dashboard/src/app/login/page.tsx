"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [useEmailCode, setUseEmailCode] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      if (error) setError(error.message === "Invalid login credentials" ? "Forkert e-mail eller adgangskode." : error.message);
      else router.replace("/");
    } finally {
      setVerifying(false);
    }
  }

  // Fallback for a forgotten password - the email round-trip this used to be the only option.
  async function handleSendCode(e: React.FormEvent) {
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

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const { error } = await getSupabaseClient().auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
    setVerifying(false);
    if (error) setError(error.message);
    else router.replace("/");
  }

  if (useEmailCode) {
    if (sent) {
      return (
        <div className="page">
          <form className="login-form" onSubmit={handleVerifyCode}>
            <Image src="/logo-icon.png" alt="Paramasamy" width={104} height={111} priority />
            <p>
              Tjek din indbakke ({email}). Klik linket i mailen, eller skriv koden herunder.
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Login-kode"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
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
    return (
      <div className="page">
        <form className="login-form" onSubmit={handleSendCode}>
          <Image src="/logo-icon.png" alt="Paramasamy" width={104} height={111} priority />
          <input type="email" placeholder="din@email.dk" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit" disabled={sending}>
            {sending ? "Sender..." : "Send login-kode"}
          </button>
          {error && <p style={{ color: "var(--red)" }}>{error}</p>}
          <button type="button" className="login-link-button" onClick={() => setUseEmailCode(false)}>
            Brug adgangskode i stedet
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="login-form" onSubmit={handlePasswordLogin}>
        <Image src="/logo-icon.png" alt="Paramasamy" width={104} height={111} priority />
        <input type="email" placeholder="din@email.dk" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <input
          type="password"
          placeholder="Adgangskode"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button type="submit" disabled={verifying}>
          {verifying ? "Logger ind..." : "Log ind"}
        </button>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
        <button type="button" className="login-link-button" onClick={() => setUseEmailCode(true)}>
          Glemt adgangskode? Brug e-mail i stedet
        </button>
      </form>
    </div>
  );
}
