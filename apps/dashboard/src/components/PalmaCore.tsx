"use client";

import { useEffect, useState } from "react";
import { PALMA_STATE_EVENT, PALMA_TALK_EVENT, type PalmaState } from "./AssistantWidget";
import { PalmaOrb } from "./PalmaOrb";
import { ASSISTANT_NAME } from "@/lib/assistantName";

const STATUS: Record<PalmaState, string> = {
  idle: "Klar · tryk for at tale",
  listening: "Lytter · tryk når du er færdig",
  thinking: "Tænker …",
  speaking: "Taler",
};

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }));
  if (h < 10) return "God morgen";
  if (h < 18) return "God eftermiddag";
  return "God aften";
}

/** Assistenten i midten af Kontoret: en lysende kerne der pulserer efter hvad hun laver. */
export function PalmaCore() {
  const [state, setState] = useState<PalmaState>("idle");
  const [hello, setHello] = useState("");

  useEffect(() => {
    setHello(greeting());
    function onState(e: Event) {
      setState((e as CustomEvent<PalmaState>).detail);
    }
    window.addEventListener(PALMA_STATE_EVENT, onState);
    return () => window.removeEventListener(PALMA_STATE_EVENT, onState);
  }, []);

  return (
    <section className="palma" aria-label={ASSISTANT_NAME}>
      <button
        type="button"
        className={`palma-core palma-${state}`}
        onClick={() => window.dispatchEvent(new Event(PALMA_TALK_EVENT))}
        aria-label={state === "listening" ? "Stop optagelse" : `Tal til ${ASSISTANT_NAME}`}
      >
        <PalmaOrb state={state} />
        <span className="palma-name">{ASSISTANT_NAME.toUpperCase()}</span>
      </button>
      <p className="palma-status" aria-live="polite">
        {STATUS[state]}
      </p>
      {hello && <p className="palma-hello">{hello}, Paskar.</p>}
    </section>
  );
}
