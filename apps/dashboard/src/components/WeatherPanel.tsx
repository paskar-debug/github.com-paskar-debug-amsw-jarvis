"use client";

import { useEffect, useState } from "react";
import { PanelHeader } from "./panels";
import { IconCloud, IconCloudSun, IconFog, IconRain, IconSnow, IconStorm, IconSun } from "./icons";

interface WeatherData {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
}

const WEATHER_LABELS: Record<number, string> = {
  0: "Klar himmel",
  1: "Mest klart",
  2: "Delvist skyet",
  3: "Overskyet",
  45: "Tåge",
  48: "Rimtåge",
  51: "Let støvregn",
  53: "Støvregn",
  55: "Kraftig støvregn",
  56: "Frysende støvregn",
  57: "Frysende støvregn",
  61: "Let regn",
  63: "Regn",
  65: "Kraftig regn",
  66: "Frysende regn",
  67: "Frysende regn",
  71: "Let sne",
  73: "Sne",
  75: "Kraftig sne",
  77: "Snekorn",
  80: "Regnbyger",
  81: "Regnbyger",
  82: "Kraftige regnbyger",
  85: "Snebyger",
  86: "Kraftige snebyger",
  95: "Tordenvejr",
  96: "Tordenvejr med hagl",
  99: "Kraftigt tordenvejr med hagl",
};

function weatherKind(code: number): "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm" {
  if (code === 0) return "sun";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "cloud";
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  switch (weatherKind(code)) {
    case "sun":
      return <IconSun className={className} />;
    case "partly":
      return <IconCloudSun className={className} />;
    case "fog":
      return <IconFog className={className} />;
    case "rain":
      return <IconRain className={className} />;
    case "snow":
      return <IconSnow className={className} />;
    case "storm":
      return <IconStorm className={className} />;
    default:
      return <IconCloud className={className} />;
  }
}

function dayLabel(iso: string, index: number): string {
  if (index === 0) return "I dag";
  return new Date(iso).toLocaleDateString("da-DK", { weekday: "short" });
}

export function WeatherPanel() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/weather")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section className="panel">
      <PanelHeader icon={<IconCloudSun />} title="Vejr" subtitle="Smørum lige nu" />
      {failed && <p className="empty">Kunne ikke hente vejret.</p>}
      {!failed && !data && <p className="empty">Henter...</p>}
      {data && (
        <>
          <div className="weather-now">
            <span className="weather-now-icon">
              <WeatherIcon code={data.current.weather_code} />
            </span>
            <div>
              <div className="weather-now-temp">{Math.round(data.current.temperature_2m)}°</div>
              <div className="meta">
                Føles som {Math.round(data.current.apparent_temperature)}° · {WEATHER_LABELS[data.current.weather_code] ?? "Ukendt vejr"}
              </div>
            </div>
          </div>
          <div className="weather-days">
            {data.daily.time.map((iso, i) => (
              <div className="weather-day" key={iso}>
                <span className="weather-day-label">{dayLabel(iso, i)}</span>
                <WeatherIcon code={data.daily.weather_code[i]} className="weather-day-icon" />
                <span className="weather-day-temp">
                  {Math.round(data.daily.temperature_2m_max[i])}°
                  <span className="weather-day-min"> {Math.round(data.daily.temperature_2m_min[i])}°</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
