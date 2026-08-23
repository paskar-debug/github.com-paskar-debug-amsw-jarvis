"use client";

import { useEffect, useState } from "react";
import { IconQuote } from "./icons";

export function QuotePanel() {
  const [quote, setQuote] = useState<{ quote: string; author: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/quote")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setQuote(data))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <div className="quote-strap">
      <IconQuote className="quote-strap-icon" />
      {quote ? (
        <p className="quote-strap-text">
          &ldquo;{quote.quote}&rdquo; <span className="quote-strap-author">— {quote.author}</span>
        </p>
      ) : (
        <p className="quote-strap-text quote-strap-loading">Henter dagens citat...</p>
      )}
    </div>
  );
}
