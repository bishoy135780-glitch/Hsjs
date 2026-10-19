import type { ReactNode } from "react";
import { HomeIcon, LibraryIcon, MusicIcon, PlusIcon, SearchIcon } from "../icons";
import { Link, match, useRouter } from "../router";
import { useLibrary } from "../store";
import { useUI } from "../ui";
import { arNum, cx } from "../util";
import { LikedCover, PlaylistCover } from "./Art";

export function useActive() {
  const { path } = useRouter();
  return {
    home: path === "/",
    search: path === "/search" || path.startsWith("/category/"),
    library: path === "/library" || path.startsWith("/playlist/"),
  };
}

export function BottomNav() {
  const active = useActive();
  const ui = useUI();
  const item = (to: string, label: string, icon: ReactNode, on: boolean) => (
    <Link to={to} className={cx(on && "active")} aria-current={on ? "page" : undefined}>
      {icon}
      {label}
    </Link>
  );
  return (
    <nav className="bottom-nav" aria-label="التنقل">
      {item("/", "الرئيسية", <HomeIcon size={26} />, active.home)}
      {item("/search", "بحث", <SearchIcon size={26} />, active.search)}
      {item("/library", "مكتبتك", <LibraryIcon size={26} />, active.library)}
      <button onClick={ui.openCreate}>
        <PlusIcon size={26} />
        إنشاء
      </button>
    </nav>
  );
}

export function Sidebar() {
  const active = useActive();
  const lib = useLibrary();
  const ui = useUI();
  const { path } = useRouter();
  const current = match("/playlist/:id", path)?.id;
  return (
    <aside className="sidebar">
      <div className="panel side-nav">
        <div className="brand">
          <i>
            <MusicIcon size={18} />
          </i>
          YMusic
        </div>
        <Link to="/" className={cx(active.home && "active")}>
          <HomeIcon size={24} filled={active.home} /> الرئيسية
        </Link>
        <Link to="/search" className={cx(active.search && "active")}>
          <SearchIcon size={24} /> بحث
        </Link>
      </div>
      <div className="panel side-lib">
        <div className="side-lib-head">
          <Link to="/library" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <LibraryIcon size={22} /> مكتبتك
          </Link>
          <span style={{ display: "flex" }}>
            <button className="icon-btn" aria-label="استيراد قائمة" onClick={ui.openImport}>
              <PlusIcon size={20} style={{ transform: "rotate(0deg)" }} />
            </button>
          </span>
        </div>
        <Link to="/playlist/liked" className="lib-row" style={current === "liked" ? { background: "rgba(255,255,255,.1)" } : undefined}>
          <LikedCover />
          <span>
            <h3>الأغاني المفضلة</h3>
            <p>قائمة • {arNum(lib.liked.length)} أغنية</p>
          </span>
        </Link>
        {lib.playlists.map(p => (
          <Link
            key={p.id}
            to={`/playlist/${p.id}`}
            className="lib-row"
            style={current === p.id ? { background: "rgba(255,255,255,.1)" } : undefined}
          >
            <PlaylistCover playlist={p} />
            <span>
              <h3 className="clamp-1">{p.name}</h3>
              <p>قائمة • {arNum(p.tracks.length)} أغنية</p>
            </span>
          </Link>
        ))}
        <div style={{ padding: "12px 16px" }}>
          <button className="btn ghost" onClick={ui.openCreate}>
            إنشاء قائمة
          </button>
        </div>
      </div>
    </aside>
  );
}
