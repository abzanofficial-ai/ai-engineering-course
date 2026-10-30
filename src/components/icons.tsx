// Inline stroke icons (no icon font, no extra request). Decorative unless given a label.
const PATHS = {
  learn:
    "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5",
  practise:
    "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z",
  decide: "M12 3v18M12 7h7l2 2-2 2h-7M12 13H5l-2 2 2 2h7",
  review: "M5 6h12a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM7 3h12a2 2 0 0 1 2 2v12",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chev: "M6 9l6 6 6-6",
  back: "M15 6l-6 6 6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  tag: "M3 12V4h8l10 10-8 8zM7.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  flag: "M5 21V4h12l-2 4 2 4H5",
  flame: "M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  medal: "M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM8 3l4 6 4-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  contrast: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "icon",
  label,
}: {
  name: IconName;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
      {name === "contrast" && <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />}
    </svg>
  );
}
