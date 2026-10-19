import { LikedCover, PlaylistCover } from "../components/Art";
import { TopBar } from "../components/TopBar";
import { TrackRow } from "../components/TrackRow";
import { ImportIcon, PlusIcon } from "../icons";
import { Link } from "../router";
import { useLibrary } from "../store";
import { useUI } from "../ui";
import { arNum } from "../util";

export default function Library() {
  const lib = useLibrary();
  const ui = useUI();
  return (
    <>
      <TopBar title="مكتبتك">
        <button className="icon-btn" aria-label="استيراد قائمة من YouTube" onClick={ui.openImport}>
          <ImportIcon size={24} />
        </button>
        <button className="icon-btn" aria-label="إنشاء قائمة" onClick={ui.openCreate}>
          <PlusIcon size={26} />
        </button>
      </TopBar>

      <Link to="/playlist/liked" className="lib-row">
        <LikedCover />
        <span>
          <h3>الأغاني المفضلة</h3>
          <p>قائمة • {arNum(lib.liked.length)} أغنية</p>
        </span>
      </Link>
      {lib.playlists.map(p => (
        <Link key={p.id} to={`/playlist/${p.id}`} className="lib-row">
          <PlaylistCover playlist={p} />
          <span style={{ minWidth: 0 }}>
            <h3 className="clamp-1">{p.name}</h3>
            <p>قائمة • {arNum(p.tracks.length)} أغنية</p>
          </span>
        </Link>
      ))}
      {lib.playlists.length === 0 && (
        <div className="empty" style={{ paddingBlock: 28 }}>
          <h3>أنشئ أول قائمة تشغيل</h3>
          <p>اجمع أغانيك المفضلة، أو استورد قائمة جاهزة من YouTube.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn green" onClick={ui.openCreate}>
              إنشاء قائمة
            </button>
            <button className="btn ghost" onClick={ui.openImport}>
              استيراد من YouTube
            </button>
          </div>
        </div>
      )}

      {lib.recents.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>شغّلته مؤخراً</h2>
          </div>
          <div className="track-list">
            {lib.recents.slice(0, 15).map(t => (
              <TrackRow key={t.id} track={t} list={lib.recents} label="شغّلته مؤخراً" />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
