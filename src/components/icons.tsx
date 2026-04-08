import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

const icon = (
  path: React.ReactNode,
  viewBox = "0 0 24 24"
): React.FC<IconProps> => {
  const Component: React.FC<IconProps> = ({ size = 20, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  );
  Component.displayName = "Icon";
  return Component;
};

export const Send = icon(
  <>
    <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
    <path d="M12 16V8M12 8l-3 3M12 8l3 3" />
  </>
);

export const Plus = icon(<path d="M12 5v14M5 12h14" />);

export const Search = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </>
);

export const Paperclip = icon(
  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
);

export const X = icon(<path d="M18 6L6 18M6 6l12 12" />);

export const ChevronDown = icon(<path d="M6 9l6 6 6-6" />);

export const ChevronRight = icon(<path d="M9 18l6-6-6-6" />);

export const Edit = icon(
  <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
);

export const Trash = icon(
  <>
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </>
);

export const ExternalLink = icon(
  <>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <path d="M15 3h6v6M10 14L21 3" />
  </>
);

export const Refresh = icon(
  <>
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </>
);

export const Settings = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </>
);

export const Keyboard = icon(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
  </>
);

export const ThumbsUp = icon(
  <path d="M14 9V5a3 3 0 00-6 0v0l-2 8h2a2 2 0 002-2V9h4zm0 0h3.28a2 2 0 011.94 2.47l-1.56 7A2 2 0 0115.72 20H6a2 2 0 01-2-2v-7" />
);

export const ThumbsDown = icon(
  <path d="M10 15v4a3 3 0 006 0v0l2-8h-2a2 2 0 01-2 2v2h-4zm0 0H6.72a2 2 0 01-1.94-2.47l1.56-7A2 2 0 018.28 4H18a2 2 0 012 2v7" />
);

export const Copy = icon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </>
);

export const Check = icon(<path d="M20 6L9 17l-5-5" />);

export const AlertCircle = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </>
);

export const Document = icon(
  <>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </>
);

export const Clock = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>
);

export const User = icon(
  <>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
);

export const Menu = icon(
  <path d="M3 12h18M3 6h18M3 18h18" />
);

export const MessageSquare = icon(
  <>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </>
);

export const Sparkles = icon(
  <>
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
  </>
);

export const Zap = icon(
  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
);

export const BarChart = icon(
  <>
    <path d="M12 20V10M18 20V4M6 20v-4" />
  </>
);

export const Globe = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </>
);

export const Play = icon(
  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
);

export const Pause = icon(
  <>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
  </>
);

export const RotateCcw = icon(
  <>
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
  </>
);

export const GripVertical = icon(
  <>
    <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
  </>
);

export const Workflow = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 17.5h7M17.5 14v7" />
  </>
);

export const ArrowRight = icon(<path d="M5 12h14M12 5l7 7-7 7" />);

export const Loader = icon(
  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
);

export const Activity = icon(
  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
);

export const CircleCheck = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </>
);

export const CircleX = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </>
);

export const CircleIcon = icon(
  <circle cx="12" cy="12" r="10" />
);

export const Square = icon(
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
);
