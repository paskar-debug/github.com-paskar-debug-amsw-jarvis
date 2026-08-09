"use client";

import { useEffect, useState } from "react";
import { PanelHeader } from "./panels";
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

  return (
    <section className="panel panel-wide quote-panel">
      <PanelHeader icon={<IconQuote />} title="Dagens citat" />
      {failed && <p className="empty">Kunne ikke hente dagens citat.</p>}
      {!failed && !quote && <p className="empty">Henter...</p>}
      {quote && (
        <blockquote className="quote-block">
          <p>&ldquo;{quote.quote}&rdquo;</p>
          <footer>— {quote.author}</footer>
        </blockquote>
      )}
    </section>
  );
}
