import { useEffect, useState, type FormEvent } from "react";
import { api, useAsync, usePlaylistSearch, useSearch } from "../api";
import { categories, type Category } from "../catalog";
import { Art } from "../components/Art";
import { ErrorBox } from "../components/Shelf";
import { TopBar } from "../components/TopBar";
import { TrackRow } from "../components/TrackRow";
import { useDebounced, useInView } from "../hooks";
import { ClockIcon, CloseIcon, PlayIcon, SearchIcon } from "../icons";
import { usePlayer } from "../player";
import { Link, useRouter } from "../router";
import { useLibrary } from "../store";
import { cleanTitle } from "../util";

function CategoryCard({ cat }: { cat: Category }) {
  const [ref, seen] = useInView<HTMLAnchorElement>();
  const { data } = useSearch(cat.sections[0].query, 12, seen);
  return (
    <Link ref={ref} to={`/category/${cat.id}`} className="cat-card" style={{ background: cat.color }}>
      <span>{cat.title}</span>
      {data?.[0] ? <Art src={data[0].thumbnail} seed={cat.id} /> : null}
    </Link>
  );
}

export default function Search() {
  const { search, navigate } = useRouter();
  const lib = useLibrary();
  const player = usePlayer();
  const q = search.get("q") ?? "";
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const typed = draft.trim();
  const editing = typed !== "" && typed !== q;
  const debounced = useDebounced(typed, 180);
  const suggestions = useAsync<string[]>(
    editing && debounced ? `suggest:${debounced}` : null,
    () => api.suggest(debounced),
    editing
  );
  const results = useSearch(q || null, 24, Boolean(q));
  const playlistResults = usePlaylistSearch(q || null, 8, Boolean(q));
  const [openingPlaylist, setOpeningPlaylist] = useState<string | null>(null);

  const go = (value: string) => {
    const v = value.trim();
    if (!v) return;
    lib.pushSearch(v);
    navigate(`/search?q=${encodeURIComponent(v)}`, Boolean(q));
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(draft);
  };

  const openPlaylist = async (id: string) => {
    if (openingPlaylist) return;
    setOpeningPlaylist(id);
    try {
      const data = await api.playlist(id);
      const local = lib.createPlaylist(data.title || "قائمة YouTube", data.tracks, data.id);
      navigate(`/playlist/${local.id}`);
    } finally {
      setOpeningPlaylist(null);
    }
  };

  const tracks = results.data ?? [];

  return (
    <>
      <TopBar title="بحث" />
      <form className="search-box" role="search" onSubmit={onSubmit}>
        <SearchIcon size={24} />
        <input
          type="search"
          enterKeyHint="search"
          value={draft}
          placeholder="عاوز تسمع إيه؟"
          aria-label="بحث"
          autoComplete="off"
          onChange={e => setDraft(e.target.value)}
        />
        {draft && (
          <button
            type="button"
            className="clear"
            aria-label="مسح"
            onClick={() => {
              setDraft("");
              if (q) navigate("/search", true);
            }}
          >
            <CloseIcon size={20} />
          </button>
        )}
      </form>

      {editing ? (
        <div className="suggest-list">
          <button className="suggest-item" onClick={() => go(draft)}>
            <SearchIcon size={22} />
            <span className="grow clamp-1">{typed}</span>
          </button>
          {(suggestions.data ?? [])
            .filter(s => s !== typed)
            .map(s => (
              <button key={s} className="suggest-item" onClick={() => go(s)}>
                <SearchIcon size={22} />
                <span className="grow clamp-1">{s}</span>
              </button>
            ))}
        </div>
      ) : q ? (
        <div>
          {results.error ? (
            <div style={{ marginTop: 16 }}>
              <ErrorBox message={results.error.message} onRetry={results.retry} />
            </div>
          ) : results.loading ? (
            <div className="track-list" aria-busy="true" style={{ paddingTop: 16 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="track" aria-hidden="true">
                  <div className="art skeleton" style={{ width: 48 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 13, width: "70%" }} />
                    <div className="skeleton" style={{ height: 10, width: "40%", marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : tracks.length === 0 ? (
            <div className="empty">
              <h3>مفيش نتائج لـ "{q}"</h3>
              <p>جرّب كلمات تانية أو تأكد من الإملاء.</p>
            </div>
          ) : (
            <>
              {(playlistResults.data ?? []).length > 0 && (
                <section className="section search-playlists">
                  <div className="section-head">
                    <h2>قوائم تشغيل من YouTube</h2>
                  </div>
                  <div className="playlist-search-grid">
                    {(playlistResults.data ?? []).map(item => (
                      <button
                        key={item.id}
                        className="playlist-search-card"
                        onClick={() => void openPlaylist(item.id)}
                        disabled={openingPlaylist !== null}
                      >
                        <div className="playlist-search-art">
                          <img src={item.thumbnail} alt="" loading="lazy" />
                          {openingPlaylist === item.id && <span className="playlist-search-loading">…</span>}
                        </div>
                        <strong className="clamp-2">{item.title}</strong>
                        <span className="muted clamp-1">
                          {item.channel || "قائمة YouTube"}{item.videoCount ? ` • ${item.videoCount}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <button className="top-result" onClick={() => player.playTrack(tracks[0], tracks, `بحث: ${q}`)}>
                <div className="art">
                  <img src={tracks[0].thumbnail} alt="" />
                </div>
                <h3 className="clamp-2">{cleanTitle(tracks[0].title)}</h3>
                <p>أفضل نتيجة • {tracks[0].channel}</p>
              </button>
              <div className="section-head" style={{ paddingTop: 20 }}>
                <h2>أغاني</h2>
                <button className="btn green" onClick={() => player.playList(tracks, { label: `بحث: ${q}` })}>
                  <PlayIcon size={16} /> تشغيل الكل
                </button>
              </div>
              <div className="track-list">
                {tracks.map(t => (
                  <TrackRow key={t.id} track={t} list={tracks} label={`بحث: ${q}`} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {lib.searches.length > 0 && (
            <div className="section" style={{ paddingTop: 10 }}>
              <div className="section-head">
                <h2>عمليات البحث الأخيرة</h2>
                <button className="see-all" onClick={lib.clearSearches}>
                  مسح
                </button>
              </div>
              <div className="suggest-list" style={{ paddingTop: 0 }}>
                {lib.searches.slice(0, 5).map(s => (
                  <div key={s} className="suggest-item">
                    <ClockIcon size={22} />
                    <button className="grow clamp-1" style={{ textAlign: "start" }} onClick={() => go(s)}>
                      {s}
                    </button>
                    <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="حذف" onClick={() => lib.removeSearch(s)}>
                      <CloseIcon size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="section">
            <div className="section-head">
              <h2>تصفّح الكل</h2>
            </div>
            <div className="cat-grid">
              {categories.map(c => (
                <CategoryCard key={c.id} cat={c} />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
