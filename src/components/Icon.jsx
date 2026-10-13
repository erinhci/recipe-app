// A small set of line icons, drawn at 24×24 in the current text color.
// Decorative: the text beside each icon carries the meaning.
const PATHS = {
  library: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h12v4H6a2 2 0 0 1-2-2z" />
    </>
  ),
  add: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  stats: <path d="M5 20V11M12 20V5M19 20v-6M3 20h18" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  repeat: (
    <>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2a5 5 0 0 1 5.5 4.8" />
    </>
  ),
  meals: <path d="M9 3v7a2 2 0 0 0 4 0V3M11 10v11M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  sort: <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />,
  sync: <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2" />,
  camera: (
    <>
      <path d="M4 8.5h3.2l1.8-2.8h6l1.8 2.8H20V19H4z" />
      <circle cx="12" cy="13.2" r="3.6" />
    </>
  ),
  image: (
    <>
      <path d="M4 5h16v14H4zM4 16l5-5 4 4 2.5-2.5L20 17" />
      <circle cx="15.5" cy="9" r="1.6" />
    </>
  ),
  file: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
}

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
