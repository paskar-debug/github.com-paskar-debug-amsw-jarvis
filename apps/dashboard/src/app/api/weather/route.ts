import { NextResponse } from "next/server";

// Smørum, Egedal Kommune - single-owner personal dashboard, so a fixed location is enough.
const LATITUDE = 55.74232;
const LONGITUDE = 12.30276;

export async function GET() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LATITUDE));
  url.searchParams.set("longitude", String(LONGITUDE));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max");
  url.searchParams.set("timezone", "Europe/Copenhagen");
  url.searchParams.set("forecast_days", "4");

  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) {
    return NextResponse.json({ error: "Kunne ikke hente vejrdata" }, { status: 502 });
  }
  return NextResponse.json(await response.json());
}
