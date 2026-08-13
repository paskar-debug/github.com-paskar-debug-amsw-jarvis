"use client";

type IconProps = { className?: string };

const common = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconTasks(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m4 8 2 2 4-4" />
      <path d="m4 16 2 2 4-4" />
      <path d="M13 8h7" />
      <path d="M13 16h7" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

export function IconPulse(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

export function IconDraft(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M14 3.5 18.5 8 8 18.5H3.5V14Z" />
      <path d="M12.5 5 17 9.5" />
    </svg>
  );
}

export function IconQuote(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M7 8c-1.7 0-3 1.3-3 3v5h5v-5H6c0-1.1.9-2 2-2V8Z" fill="currentColor" stroke="none" />
      <path d="M17 8c-1.7 0-3 1.3-3 3v5h5v-5h-3c0-1.1.9-2 2-2V8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconNews(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 9h6" />
      <path d="M7 12.5h10" />
      <path d="M7 16h10" />
    </svg>
  );
}

export function IconPlug(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M9 3v5" />
      <path d="M15 3v5" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
      <path d="M12 17v4" />
    </svg>
  );
}

export function IconRing(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4z" />
    </svg>
  );
}

export function IconMic(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5v3" />
    </svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m4 12 16-7-6 16-2.5-7L4 12Z" />
    </svg>
  );
}

export function IconVolume(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
    </svg>
  );
}

export function IconVolumeOff(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m15 9 5 6M20 9l-5 6" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}
