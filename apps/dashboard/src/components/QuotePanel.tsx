"use client";

import { useEffect, useState } from "react";

export function QuotePanel() {
  const [quote, setQuote] = useState<{ quote: string; author: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/quote")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setQuote(data))
      .catch(() => setFailed(true));
  }, []);

  if (failed || !quote) return null;

  return (
    <p className="hero-quote">
      &ldquo;{quote.quote}&rdquo; <span className="hero-quote-author">—&nbsp;{quote.author}</span>
    </p>
  );
}
