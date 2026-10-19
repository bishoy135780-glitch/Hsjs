import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number; filled?: boolean };

function make(paths: ReactNode, opts: { fill?: boolean } = {}) {
  return function Icon({ size = 24, filled, ...rest }: IconProps) {
    const solid = opts.fill || filled;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={solid ? "currentColor" : "none"}
        stroke={opts.fill ? "none" : "currentColor"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const HomeIcon = make(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />);
export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4.2-4.2" />
  </>
);
export const LibraryIcon = make(<path d="M4 4v16M9 4v16M14.5 5.5l4.5 14" />);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const PlusCircleIcon = make(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 8v8M8 12h8" />
  </>
);
export const CheckCircleIcon = make(
  <>
    <circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" />
    <path d="m7.5 12.5 3 3 6-6.5" stroke="#000" />
  </>
);
export const PlayIcon = make(
  <path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z" />,
  { fill: true }
);
export const PauseIcon = make(
  <>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
  </>,
  { fill: true }
);
export const NextIcon = make(
  <>
    <path d="M5 5.2v13.6a.8.8 0 0 0 1.2.7l10.3-6.8a.8.8 0 0 0 0-1.4L6.2 4.5A.8.8 0 0 0 5 5.2z" />
    <rect x="17.5" y="4.5" width="2.5" height="15" rx="1.1" />
  </>,
  { fill: true }
);
export const PrevIcon = make(
  <>
    <path d="M19 5.2v13.6a.8.8 0 0 1-1.2.7L7.5 12.7a.8.8 0 0 1 0-1.4l10.3-6.8A.8.8 0 0 1 19 5.2z" />
    <rect x="4" y="4.5" width="2.5" height="15" rx="1.1" />
  </>,
  { fill: true }
);
export const ShuffleIcon = make(
  <>
    <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
    <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
    <path d="m18 14 4 4-4 4" />
  </>
);
export const RepeatIcon = make(
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </>
);
export const RepeatOneIcon = make(
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    <path d="M11 10h1v4" />
  </>
);
export const HeartIcon = make(
  <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />
);
export const MoreIcon = make(
  <>
    <circle cx="12" cy="5" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="19" r="1.6" fill="currentColor" />
  </>
);
export const ChevronDownIcon = make(<path d="m6 9 6 6 6-6" />);
export const ChevronLeftIcon = make(<path d="m15 18-6-6 6-6" />);
export const ArrowRightIcon = make(<path d="M5 12h14m-7-7 7 7-7 7" />);
export const CloseIcon = make(<path d="M18 6 6 18M6 6l12 12" />);
export const QueueIcon = make(
  <>
    <path d="M3 6h14M3 12h14M3 18h8" />
    <path d="m15 15 6 3.5-6 3.5z" fill="currentColor" />
  </>
);
export const VideoIcon = make(
  <>
    <rect x="2" y="5" width="14" height="14" rx="2.5" />
    <path d="m16 10 6-3v10l-6-3" />
  </>
);
export const MusicIcon = make(
  <>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>
);
export const TrashIcon = make(
  <>
    <path d="M3 6h18M8 6V4h8v2" />
    <path d="m19 6-1 14H6L5 6" />
  </>
);
export const LinkIcon = make(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>
);
export const ExternalIcon = make(
  <>
    <path d="M15 3h6v6M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>
);
export const VolumeIcon = make(
  <>
    <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </>
);
export const VolumeMuteIcon = make(
  <>
    <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" />
    <path d="m22 9-6 6M16 9l6 6" />
  </>
);
export const EditIcon = make(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </>
);
export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3 2" />
  </>
);
export const ImportIcon = make(
  <>
    <path d="M12 3v12m0 0-4-4m4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </>
);
export const SkipNextTrackIcon = make(
  <>
    <path d="M5 4v16M9 6l10 6-10 6z" />
  </>
);
export const TrendIcon = make(
  <>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </>
);
