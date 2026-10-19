import { useState, type ReactNode } from "react";
import { HeartIcon, MusicIcon } from "../icons";
import type { Playlist, Track } from "../types";
import { colorFor, cx } from "../util";

export function Art({
  src,
  seed = "",
  className,
  round,
  children,
}: {
  src?: string;
  seed?: string;
  className?: string;
  round?: boolean;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const ok = src && failed !== src;
  return (
    <div
      className={cx("art", round && "round", className)}
      style={{ background: ok ? undefined : colorFor(seed || src || "x", 45, 30) }}
    >
      {ok ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src ?? null)} />
      ) : (
        <div className="art-fallback">
          <MusicIcon size={24} />
        </div>
      )}
      {children}
    </div>
  );
}

export function TrackArt({ track, className }: { track: Track; className?: string }) {
  return <Art src={track.thumbnail} seed={track.id} className={className} />;
}

export function LikedCover({ className }: { className?: string }) {
  return (
    <div className={cx("art heart-cover", className)}>
      <HeartIcon size={28} filled />
    </div>
  );
}

export function PlaylistCover({ playlist, className }: { playlist: Pick<Playlist, "id" | "tracks">; className?: string }) {
  const tracks = playlist.tracks;
  if (tracks.length >= 4) {
    return (
      <div className={cx("art mosaic", className)}>
        {tracks.slice(0, 4).map(t => (
          <img key={t.id} src={t.thumbnail} alt="" loading="lazy" />
        ))}
      </div>
    );
  }
  if (tracks.length > 0) return <Art src={tracks[0].thumbnail} seed={playlist.id} className={className} />;
  return <Art seed={playlist.id} className={className} />;
}
