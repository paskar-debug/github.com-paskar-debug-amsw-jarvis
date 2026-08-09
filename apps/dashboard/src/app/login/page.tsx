"use client";

import { useState } from "react";
import Image from "next/image";
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
        <div className="login-form">
          <Image src="/logo-icon-red.png" alt="Paramasamy" width={104} height={111} priority />
          <p>Tjek din indbakke ({email}) for et login-link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="login-form" onSubmit={handleSubmit}>
        <Image src="/logo-icon-red.png" alt="Paramasamy" width={104} height={111} priority />
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
