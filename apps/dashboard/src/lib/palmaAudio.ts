"use client";

/** Én fælles lyd-analysator for Palma: både mikrofonen (når hun lytter) og hendes stemme
 *  (når hun taler) kobles på, så kuglen og lydbølgerne kan bevæge sig i takt. */
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freq: Uint8Array<ArrayBuffer> | null = null;
let current: AudioNode | null = null;

function ensure(): AnalyserNode | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
  }
  if (ctx.state === "suspended") void ctx.resume();
  return analyser;
}

function swap(node: AudioNode | null) {
  try {
    current?.disconnect();
  } catch {
    /* allerede frakoblet */
  }
  current = node;
}

/** Palmas stemme: lyden spilles stadig ud af højttaleren, men går forbi analysatoren. */
export function connectPlayback(audio: HTMLAudioElement) {
  const a = ensure();
  if (!a || !ctx) return;
  const src = ctx.createMediaElementSource(audio);
  src.connect(a);
  a.connect(ctx.destination);
  swap(src);
}

/** Mikrofonen: kun til analysatoren, ikke ud af højttaleren. */
export function connectMic(stream: MediaStream) {
  const a = ensure();
  if (!a || !ctx) return;
  try {
    a.disconnect();
  } catch {
    /* ikke forbundet */
  }
  const src = ctx.createMediaStreamSource(stream);
  src.connect(a);
  swap(src);
}

export function disconnectAudio() {
  swap(null);
}

/** Lydniveau 0–1 og frekvenser til lydbølgerne. */
export function readAudio(): { level: number; freq: Uint8Array | null } {
  if (!analyser || !freq || !current) return { level: 0, freq: null };
  analyser.getByteFrequencyData(freq);
  let sum = 0;
  for (let i = 0; i < freq.length; i++) sum += freq[i];
  return { level: Math.min(1, (sum / freq.length / 255) * 2.2), freq };
}
