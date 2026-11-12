export type PalmaOrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface PalmaOrbController {
  setState: (state: PalmaOrbState) => void;
  setAudioAmplitude: (amplitude: number) => void;
  setTransitionIn: (transition: number) => void;
  resize: () => void;
  dispose: () => void;
}

export function createJarvisOrbRenderer(
  THREE: unknown,
  mount: HTMLElement,
  options?: { state?: PalmaOrbState; audioAmplitude?: number; transitionIn?: number; [key: string]: unknown },
): PalmaOrbController;
