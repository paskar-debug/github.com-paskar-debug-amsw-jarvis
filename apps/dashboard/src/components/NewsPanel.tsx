"use client";

import { useEffect, useState } from "react";
import { PanelHeader } from "./panels";
import { IconNews } from "./icons";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  image: string | null;
}

const SOURCES: { key: "dr" | "tv2"; label: string }[] = [
  { key: "dr", label: "DR" },
  { key: "tv2", label: "TV2" },
];

function formatTime(pubDate: string) {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

// One panel, not two - DR and TV2 headlines are the same kind of content, so a source toggle
// keeps them one scroll-stop instead of two near-identical panels back to back.
export function NewsPanel() {
  const [source, setSource] = useState<"dr" | "tv2">("dr");
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setItems(null);
    setFailed(false);
    fetch(`/api/news?source=${source}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setItems(data.items))
      .catch(() => setFailed(true));
  }, [source]);

  return (
    <section className="panel">
      <div className="news-panel-header">
        <PanelHeader icon={<IconNews />} title="Nyheder" subtitle="Seneste overskrifter, opdateres automatisk" />
        <div className="news-source-toggle">
          {SOURCES.map((s) => (
            <button
              type="button"
              key={s.key}
              className={s.key === source ? "news-source-active" : ""}
              onClick={() => setSource(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {failed && <p className="empty">Kunne ikke hente nyheder.</p>}
      {!failed && !items && <p className="empty">Henter...</p>}
      {items?.length === 0 && <p className="empty">Ingen nyheder lige nu.</p>}
      {items?.map((item) => (
        <a className="item news-item" href={item.link} target="_blank" rel="noreferrer" key={item.link}>
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable domains per source
            <img className="news-thumb" src={item.image} alt="" loading="lazy" />
          )}
          <div className="news-item-body">
            {item.title}
            <div className="meta">{formatTime(item.pubDate)}</div>
          </div>
        </a>
      ))}
    </section>
  );
}
