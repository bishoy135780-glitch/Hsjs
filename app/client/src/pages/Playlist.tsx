import type { CSSProperties } from "react";
import { LikedCover, PlaylistCover } from "../components/Art";
import { TrackRow } from "../components/TrackRow";
import { ArrowRightIcon, MoreIcon, PauseIcon, PlayIcon, ShuffleIcon } from "../icons";
import { usePlayer } from "../player";
import { Link, match, useRouter } from "../router";
import { useLibrary } from "../store";
import { useUI } from "../ui";
import { arNum, colorFor, cx, totalMinutes } from "../util";
import NotFound from "./NotFound";

export default function Playlist() {
  const { path, navigate } = useRouter();
  const id = match("/playlist/:id", path)?.id ?? "";
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();

  const isLiked = id === "liked";
  const playlist = isLiked ? null : lib.playlists.find(p => p.id === id);
  if (!isLiked && !playlist) return <NotFound />;

  const name = isLiked ? "الأغاني المفضلة" : (playlist?.name ?? "");
  const tracks = isLiked ? lib.liked : (playlist?.tracks ?? []);
  const mins = totalMinutes(tracks);
  const playingHere = Boolean(player.current && tracks.some(t => t.id === player.current?.id));
  const hero = isLiked ? "#4b2fb5" : colorFor(id, 45, 30);

  const onPlay = () => {
    if (playingHere && player.queue.length === tracks.length) player.toggle();
    else player.playList(tracks, { label: name });
  };

  return (
    <>
      <div className="hero" style={{ "--hero": hero } as CSSProperties}>
        <button className="icon-btn back" aria-label="رجوع" onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/library"))}>
          <ArrowRightIcon size={26} />
        </button>
        {isLiked ? (
          <LikedCover className="hero-cover" />
        ) : (
          <PlaylistCover playlist={{ id, tracks }} className="hero-cover" />
        )}
        <div>
          <h1>{name}</h1>
          <p className="meta">
            {arNum(tracks.length)} أغنية{mins > 0 ? ` • ${arNum(mins)} دقيقة` : ""}
          </p>
        </div>
      </div>

      <div className="action-row">
        <div className="group">
          {!isLiked && (
            <button className="icon-btn" aria-label="خيارات القائمة" onClick={() => ui.openPlaylistMenu(id)}>
              <MoreIcon size={24} />
            </button>
          )}
        </div>
        <div className="group">
          <button
            className={cx("icon-btn", player.shuffle && "on")}
            aria-label="تشغيل عشوائي"
            disabled={!tracks.length}
            onClick={() => player.playList(tracks, { shuffle: true, label: name })}
          >
            <ShuffleIcon size={26} />
          </button>
          <button className="play-fab" aria-label="تشغيل" disabled={!tracks.length} onClick={onPlay}>
            {playingHere && player.isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
          </button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="empty">
          <h3>القائمة فاضية</h3>
          <p>ابحث عن أغاني وأضفها هنا من زر المزيد ⋮</p>
          <Link to="/search" className="btn green">
            ابحث عن أغاني
          </Link>
        </div>
      ) : (
        <div className="track-list">
          {tracks.map(t => (
            <TrackRow key={t.id} track={t} list={tracks} label={name} playlistId={id} />
          ))}
        </div>
      )}
    </>
  );
}
