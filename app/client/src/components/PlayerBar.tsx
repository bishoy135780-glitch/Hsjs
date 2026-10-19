import { HeartIcon, QueueIcon, VolumeIcon, VolumeMuteIcon } from "../icons";
import { usePlayer } from "../player";
import { useLibrary } from "../store";
import { useUI } from "../ui";
import { cleanTitle, cx } from "../util";
import { TrackArt } from "./Art";
import { Controls } from "./Controls";
import { SeekInline } from "./SeekBar";
import type { CSSProperties } from "react";

export function PlayerBar() {
  const p = usePlayer();
  const lib = useLibrary();
  const ui = useUI();
  const track = p.current;
  if (!track) return null;
  const liked = lib.isLiked(track.id);
  return (
    <footer className="player-bar">
      <div className="pb-info">
        <TrackArt track={track} />
        <div style={{ minWidth: 0 }}>
          <div className="track-title clamp-1">{cleanTitle(track.title)}</div>
          <div className="track-sub">
            <span className="clamp-1">{track.channel}</span>
          </div>
        </div>
        <button className={cx("icon-btn", liked && "on")} aria-label="المفضلة" onClick={() => lib.toggleLike(track)}>
          <HeartIcon size={20} filled={liked} />
        </button>
      </div>
      <div className="pb-center">
        <Controls />
        <SeekInline />
      </div>
      <div className="pb-right">
        <button className="icon-btn" aria-label="المشغل الكامل" onClick={ui.openPlayer}>
          <QueueIcon size={20} />
        </button>
        <button className="icon-btn" aria-label={p.volume === 0 ? "إلغاء الكتم" : "كتم"} onClick={() => p.setVolume(p.volume === 0 ? 70 : 0)}>
          {p.volume === 0 ? <VolumeMuteIcon size={20} /> : <VolumeIcon size={20} />}
        </button>
        <input
          className="slider green"
          type="range"
          min={0}
          max={100}
          value={p.volume}
          aria-label="مستوى الصوت"
          style={{ "--p": `${p.volume}%` } as CSSProperties}
          onChange={e => p.setVolume(Number(e.target.value))}
        />
      </div>
    </footer>
  );
}
