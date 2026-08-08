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

export function IconTarget(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
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
