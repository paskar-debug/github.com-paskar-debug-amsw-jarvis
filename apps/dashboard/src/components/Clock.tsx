"use client";

import { useEffect, useState } from "react";

const timeFormatter = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const date = dateFormatter.format(now);

  return (
    <div className="clock">
      <span className="clock-time">{timeFormatter.format(now)}</span>
      <span className="clock-date">{date.charAt(0).toUpperCase() + date.slice(1)}</span>
    </div>
  );
}
