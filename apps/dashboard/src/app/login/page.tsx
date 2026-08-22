"use client";

import { useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await getSupabaseClient().auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const { error } = await getSupabaseClient().auth.verifyOtp({ email, token: code, type: "email" });
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
            Tjek din indbakke ({email}) og skriv koden fra mailen herunder - virker altid, uanset om du bruger en
            installeret app uden adresselinje eller en almindelig browser.
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
        <button type="submit">Send login-kode</button>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      </form>
    </div>
  );
}
