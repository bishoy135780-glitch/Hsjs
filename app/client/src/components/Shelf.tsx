import { useSearch } from "../api";
import { useInView } from "../hooks";
import { Link } from "../router";
import { usePlayer } from "../player";
import type { Track } from "../types";
import { cleanTitle, cx } from "../util";
import { TrackArt } from "./Art";

export function TrackCard({ track, list, label }: { track: Track; list: Track[]; label: string }) {
  const player = usePlayer();
  const active = player.current?.id === track.id;
  return (
    <button className={cx("card", active && "playing")} onClick={() => player.playTrack(track, list, label)}>
      <TrackArt track={track} />
      <h3 className="clamp-2">{cleanTitle(track.title)}</h3>
      <p className="clamp-1">{track.channel}</p>
    </button>
  );
}

function Skeletons() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="card card-skeleton" aria-hidden="true">
          <div className="art skeleton" />
          <div className="l1 skeleton" />
          <div className="l2 skeleton" />
        </div>
      ))}
    </>
  );
}

export function ErrorBox({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="error-box">
      <span>{message || "تعذر التحميل. اتأكد من الاتصال وجرب تاني."}</span>
      <button className="btn" onClick={onRetry}>
        إعادة المحاولة
      </button>
    </div>
  );
}

/** A horizontally scrolling row of tracks loaded from a YouTube search (lazy). */
export function Shelf({ title, query, seeAll = true }: { title: string; query: string; seeAll?: boolean }) {
  const [ref, seen] = useInView<HTMLElement>();
  const { data, error, retry } = useSearch(query, 12, seen);
  return (
    <section className="section" ref={ref}>
      <div className="section-head">
        <h2>{title}</h2>
        {seeAll && (
          <Link className="see-all" to={`/search?q=${encodeURIComponent(query)}`}>
            عرض الكل
          </Link>
        )}
      </div>
      {error ? (
        <ErrorBox onRetry={retry} />
      ) : (
        <div className="shelf-row">
          {data ? data.map(t => <TrackCard key={t.id} track={t} list={data} label={title} />) : <Skeletons />}
        </div>
      )}
    </section>
  );
}

/** Same look, but for tracks we already have (recents, liked...). */
export function TrackShelf({ title, tracks, to }: { title: string; tracks: Track[]; to?: string }) {
  if (!tracks.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {to && (
          <Link className="see-all" to={to}>
            عرض الكل
          </Link>
        )}
      </div>
      <div className="shelf-row">
        {tracks.slice(0, 12).map(t => (
          <TrackCard key={t.id} track={t} list={tracks} label={title} />
        ))}
      </div>
    </section>
  );
}
