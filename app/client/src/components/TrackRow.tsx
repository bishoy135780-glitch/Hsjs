import { HeartIcon, MoreIcon } from "../icons";
import { usePlayer } from "../player";
import { useLibrary } from "../store";
import { useUI } from "../ui";
import type { Track } from "../types";
import { cleanTitle, cx } from "../util";
import { TrackArt } from "./Art";

export function Equalizer({ paused }: { paused?: boolean }) {
  return (
    <span className={cx("eq", paused && "paused")} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function TrackRow({
  track,
  list,
  label,
  playlistId,
}: {
  track: Track;
  list: Track[];
  label: string;
  playlistId?: string;
}) {
  const player = usePlayer();
  const lib = useLibrary();
  const ui = useUI();
  const active = player.current?.id === track.id;
  const liked = lib.isLiked(track.id);

  return (
    <div className={cx("track", active && "active")}>
      <button className="track-hit" onClick={() => player.playTrack(track, list, label)}>
        <TrackArt track={track} />
        <span className="track-main">
          <span className="track-title clamp-1">{cleanTitle(track.title)}</span>
          <span className="track-sub">
            {active && <Equalizer paused={!player.isPlaying} />}
            <span className="clamp-1">{track.channel}</span>
            {track.duration && <span>• {track.duration}</span>}
          </span>
        </span>
      </button>
      <div className="track-actions">
        <button
          className={cx("icon-btn", liked && "on")}
          aria-label={liked ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          onClick={() => lib.toggleLike(track)}
        >
          <HeartIcon size={22} filled={liked} />
        </button>
        <button className="icon-btn" aria-label="المزيد" onClick={() => ui.openTrackMenu(track, playlistId)}>
          <MoreIcon size={20} />
        </button>
      </div>
    </div>
  );
}
