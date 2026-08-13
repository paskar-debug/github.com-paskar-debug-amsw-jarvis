"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { IconChat, IconCheck, IconClose, IconMic, IconSend, IconSettings, IconVolume, IconVolumeOff } from "./icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const VOICES: { id: string; label: string }[] = [
  { id: "alloy", label: "Alloy" },
  { id: "echo", label: "Echo" },
  { id: "fable", label: "Fable" },
  { id: "onyx", label: "Onyx" },
  { id: "nova", label: "Nova" },
  { id: "shimmer", label: "Shimmer" },
];
const VOICE_PREVIEW_TEXT = "Hej, sådan lyder jeg. Er det en stemme du kan lide?";
const VOICE_ENABLED_KEY = "assistant-voice-enabled";
const VOICE_NAME_KEY = "assistant-voice-name";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceName, setVoiceName] = useState("alloy");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedEnabled = localStorage.getItem(VOICE_ENABLED_KEY);
    if (storedEnabled !== null) setVoiceEnabled(storedEnabled === "true");
    const storedVoice = localStorage.getItem(VOICE_NAME_KEY);
    if (storedVoice) setVoiceName(storedVoice);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function toggleVoiceEnabled() {
    setVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(VOICE_ENABLED_KEY, String(next));
      return next;
    });
  }

  function selectVoice(id: string) {
    setVoiceName(id);
    localStorage.setItem(VOICE_NAME_KEY, id);
  }

  async function playReply(text: string, voiceOverride?: string) {
    try {
      const headers = await authHeader();
      const res = await fetch("/api/assistant/speak", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceOverride ?? voiceName }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
    } catch {
      // Voice playback is a nice-to-have, not worth surfacing an error for.
    }
  }

  async function previewVoice(id: string) {
    setPreviewingVoice(id);
    await playReply(VOICE_PREVIEW_TEXT, id);
    setPreviewingVoice(null);
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
      if (spoken && voiceEnabled) void playReply(data.reply);
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
            <div className="assistant-header-actions">
              <button
                type="button"
                className="assistant-icon-button"
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label="Stemmeindstillinger"
              >
                <IconSettings />
              </button>
              <button type="button" className="assistant-icon-button" onClick={() => setOpen(false)} aria-label="Luk">
                <IconClose />
              </button>
            </div>
          </div>
          {settingsOpen && (
            <div className="assistant-settings">
              <button type="button" className="assistant-voice-toggle" onClick={toggleVoiceEnabled}>
                {voiceEnabled ? <IconVolume /> : <IconVolumeOff />}
                <span>Stemme er {voiceEnabled ? "slået til" : "slået fra"}</span>
              </button>
              {voiceEnabled && (
                <div className="assistant-voice-list">
                  {VOICES.map((v) => (
                    <div className={`assistant-voice-row${v.id === voiceName ? " assistant-voice-row-active" : ""}`} key={v.id}>
                      <button type="button" className="assistant-voice-name" onClick={() => selectVoice(v.id)}>
                        {v.id === voiceName && <IconCheck />}
                        <span>{v.label}</span>
                      </button>
                      <button
                        type="button"
                        className="assistant-icon-button assistant-voice-preview"
                        onClick={() => previewVoice(v.id)}
                        disabled={previewingVoice !== null}
                        aria-label={`Afspil eksempel med ${v.label}`}
                      >
                        {previewingVoice === v.id ? "…" : <IconVolume />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="assistant-messages" ref={scrollRef}>
            {messages.length === 0 && !sending && (
              <p className="empty">Spørg om noget, eller bed mig oprette en opgave/aftale, huske et fakta, eller skrive et udkast.</p>
            )}
            {messages.map((m, i) => (
              <div className={`assistant-bubble assistant-bubble-${m.role}`} key={i}>
                <p>{m.content}</p>
                {m.role === "assistant" && voiceEnabled && (
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
