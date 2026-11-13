"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createJarvisOrbRenderer, type PalmaOrbController, type PalmaOrbState } from "@/lib/palmaOrbRenderer";
import { readAudio } from "@/lib/palmaAudio";

/** Palmas ansigt: partikelkuglen (WebGL) og lydbølger nedenunder, der følger lyden. */
export function PalmaOrb({ state }: { state: PalmaOrbState }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<PalmaOrbController | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    try {
      orbRef.current = createJarvisOrbRenderer(THREE, mountRef.current, { state, audioAmplitude: 0, transitionIn: 1 });
    } catch {
      orbRef.current = null; // Ingen WebGL: siden virker stadig, bare uden kugle.
    }
    return () => {
      orbRef.current?.dispose();
      orbRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    orbRef.current?.setState(state);
  }, [state]);

  // Én animationsløkke: lydniveau til kuglen og frekvenser til lydbølgerne.
  useEffect(() => {
    let frame = 0;
    const canvas = waveRef.current;
    const g = canvas?.getContext("2d") ?? null;
    let smooth = 0;
    const loop = () => {
      const { level, freq } = readAudio();
      smooth += (level - smooth) * 0.25;
      orbRef.current?.setAudioAmplitude(smooth);
      if (canvas && g) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        const bars = 48;
        const gap = 3;
        const bw = (w - gap * (bars - 1)) / bars;
        for (let i = 0; i < bars; i++) {
          // Spejlet om midten, så bølgerne ser symmetriske ud under kuglen.
          const d = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
          const idx = Math.floor(d * 40);
          const v = freq ? freq[idx] / 255 : 0;
          const idle = 0.06 + 0.04 * Math.sin(performance.now() / 600 + i * 0.5);
          const bh = Math.max(2, (freq ? v : idle) * h * (1 - d * 0.35));
          g.fillStyle = `rgba(${Math.round(60 + 90 * (1 - d))}, ${Math.round(200 + 35 * (1 - d))}, 255, ${0.35 + 0.6 * (1 - d)})`;
          g.fillRect(i * (bw + gap), (h - bh) / 2, bw, bh);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="palma-orb">
      <div ref={mountRef} className="palma-orb-gl" aria-hidden="true" />
      <canvas ref={waveRef} className="palma-wave" aria-hidden="true" />
    </div>
  );
}
