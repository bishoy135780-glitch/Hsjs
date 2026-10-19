import { useState, type ReactNode } from "react";
import { categories, homeChips, homeShelves, starterMixes } from "../catalog";
import { LikedCover, PlaylistCover, TrackArt } from "../components/Art";
import { Shelf, TrackShelf } from "../components/Shelf";
import { TopBar } from "../components/TopBar";
import { usePlayer } from "../player";
import { useRouter } from "../router";
import { useLibrary } from "../store";
import { Art } from "../components/Art";
import { cleanTitle, cx } from "../util";

type Tile = { key: string; title: string; art: ReactNode; onClick: () => void; playing?: boolean };

export default function Home() {
  const [chip, setChip] = useState("all");
  const lib = useLibrary();
  const player = usePlayer();
  const { navigate } = useRouter();

  const tiles: Tile[] = [
    {
      key: "liked",
      title: "الأغاني المفضلة",
      art: <LikedCover />,
      onClick: () => navigate("/playlist/liked"),
    },
    ...lib.playlists.slice(0, 3).map(p => ({
      key: `pl-${p.id}`,
      title: p.name,
      art: <PlaylistCover playlist={p} />,
      onClick: () => navigate(`/playlist/${p.id}`),
    })),
    ...lib.recents.slice(0, 4).map(t => ({
      key: `rc-${t.id}`,
      title: cleanTitle(t.title),
      art: <TrackArt track={t} />,
      playing: player.current?.id === t.id,
      onClick: () => player.playTrack(t, lib.recents, "شغّلته مؤخراً"),
    })),
  ];
  for (const mix of starterMixes) {
    if (tiles.length >= 8) break;
    tiles.push({
      key: `mix-${mix.query}`,
      title: mix.title,
      art: <Art seed={mix.query} />,
      onClick: () => navigate(`/search?q=${encodeURIComponent(mix.query)}`),
    });
  }

  const category = categories.find(c => c.id === chip);

  return (
    <>
      <TopBar>
        <div className="chips" role="tablist">
          {homeChips.map(c => (
            <button
              key={c.id}
              role="tab"
              aria-selected={chip === c.id}
              className={cx("chip", chip === c.id && "active")}
              onClick={() => setChip(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </TopBar>

      {category ? (
        category.sections.map(s => <Shelf key={s.query} title={s.title} query={s.query} />)
      ) : (
        <>
          <div className="quick-grid">
            {tiles.map(t => (
              <button key={t.key} className={cx("quick-tile", t.playing && "playing")} onClick={t.onClick}>
                {t.art}
                <span className="clamp-2">{t.title}</span>
              </button>
            ))}
          </div>
          <TrackShelf title="شغّلته مؤخراً" tracks={lib.recents} />
          <TrackShelf title="اسمع الموسيقى اللي حبيتها زمان" tracks={lib.liked} to="/playlist/liked" />
          {homeShelves.map(s => (
            <Shelf key={s.query} title={s.title} query={s.query} />
          ))}
        </>
      )}
    </>
  );
}

