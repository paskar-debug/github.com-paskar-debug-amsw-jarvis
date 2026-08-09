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

export function IconHeart(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M12 20s-7-4.35-9.5-8.8C.8 7.9 2.6 4.5 6 4.5c2 0 3.3 1.1 4 2.2.7-1.1 2-2.2 4-2.2 3.4 0 5.2 3.4 3.5 6.7C19 15.65 12 20 12 20Z" />
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

export function IconCopy(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}
