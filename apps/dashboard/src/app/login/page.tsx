"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await getSupabaseClient().auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="page">
        <p>Tjek din indbakke ({email}) for et login-link.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>AMSW Jarvis</h1>
        <input
          type="email"
          placeholder="din@email.dk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send login-link</button>
        {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      </form>
    </div>
  );
}
