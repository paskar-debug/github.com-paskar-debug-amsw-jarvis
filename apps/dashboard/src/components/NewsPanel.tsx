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

function formatTime(pubDate: string) {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export function NewsPanel({ source, label }: { source: "dr" | "tv2"; label: string }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/news?source=${source}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setItems(data.items))
      .catch(() => setFailed(true));
  }, [source]);

  return (
    <section className="panel">
      <PanelHeader icon={<IconNews />} title={label} subtitle="Seneste overskrifter, opdateres automatisk" />
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
