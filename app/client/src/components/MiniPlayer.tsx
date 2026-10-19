import type { CSSProperties } from "react";
import { PauseIcon, PlayIcon } from "../icons";
import { usePlayer, usePlayerTime } from "../player";
import { useUI } from "../ui";
import { cleanTitle, colorFor, parseDuration } from "../util";
import { TrackArt } from "./Art";

export function MiniPlayer() {
  const p = usePlayer();
  const ui = useUI();
  const { t, d } = usePlayerTime();
  if (!p.current || ui.playerOpen) return null;
  const max = d || parseDuration(p.current.duration) || 1;
  return (
    <div
      className="mini"
      role="button"
      tabIndex={0}
      aria-label="فتح المشغل"
      style={{ "--mini-bg": colorFor(p.current.id, 38, 26) } as CSSProperties}
      onClick={ui.openPlayer}
      onKeyDown={e => e.key === "Enter" && ui.openPlayer()}
    >
      <TrackArt track={p.current} />
      <div className="info">
        <div className="t clamp-1">{cleanTitle(p.current.title)}</div>
        <div className="c clamp-1">{p.current.channel}</div>
      </div>
      <button
        className="icon-btn"
        aria-label={p.isPlaying ? "إيقاف مؤقت" : "تشغيل"}
        onClick={e => {
          e.stopPropagation();
          p.toggle();
        }}
      >
        {p.isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
      </button>
      <div className="bar">
        <i style={{ width: `${Math.min(100, (t / max) * 100)}%` }} />
      </div>
    </div>
  );
}
