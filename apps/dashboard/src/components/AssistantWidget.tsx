"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { IconChat, IconClose, IconMic, IconSend, IconVolume } from "./icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function playReply(text: string) {
    try {
      const headers = await authHeader();
      const res = await fetch("/api/assistant/speak", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
    } catch {
      // Voice playback is a nice-to-have, not worth surfacing an error for.
    }
  }

  async function sendMessage(text: string, spoken: boolean) {
    if (!text.trim() || sending) return;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "Ukendt fejl.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      if (spoken) void playReply(data.reply);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setSending(true);
        try {
          const headers = await authHeader();
          const res = await fetch("/api/assistant/transcribe", {
            method: "POST",
            headers: { ...headers, "Content-Type": blob.type },
            body: blob,
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok || !data.text) throw new Error(data.error ?? "Kunne ikke forstå lydoptagelsen.");
          await sendMessage(data.text, true);
        } catch (err) {
          setError((err as Error).message);
          setSending(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Ingen adgang til mikrofonen.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="assistant-widget">
      {open && (
        <div className="assistant-panel">
          <div className="assistant-panel-header">
            <span>Din assistent</span>
            <button type="button" className="assistant-icon-button" onClick={() => setOpen(false)} aria-label="Luk">
              <IconClose />
            </button>
          </div>
          <div className="assistant-messages" ref={scrollRef}>
            {messages.length === 0 && !sending && (
              <p className="empty">Spørg om noget, eller bed mig oprette en opgave/aftale, huske et fakta, eller skrive et udkast.</p>
            )}
            {messages.map((m, i) => (
              <div className={`assistant-bubble assistant-bubble-${m.role}`} key={i}>
                <p>{m.content}</p>
                {m.role === "assistant" && (
                  <button type="button" className="assistant-icon-button assistant-listen" onClick={() => playReply(m.content)} aria-label="Lyt">
                    <IconVolume />
                  </button>
                )}
              </div>
            ))}
            {sending && <div className="assistant-bubble assistant-bubble-assistant assistant-typing">…</div>}
            {error && <p className="assistant-error">{error}</p>}
          </div>
          <form
            className="assistant-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input, false);
            }}
          >
            <button
              type="button"
              className={`assistant-icon-button assistant-mic${recording ? " assistant-mic-active" : ""}`}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? "Stop optagelse" : "Indtal besked"}
            >
              <IconMic />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv en besked..."
              disabled={sending || recording}
            />
            <button type="submit" className="assistant-icon-button" disabled={sending || !input.trim()} aria-label="Send">
              <IconSend />
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Luk assistent" : "Åbn assistent"}
      >
        <IconChat />
      </button>
    </div>
  );
}
