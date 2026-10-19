import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api } from "./api";
import { TrackArt } from "./components/Art";
import {
  CheckCircleIcon,
  CloseIcon,
  EditIcon,
  ExternalIcon,
  HeartIcon,
  ImportIcon,
  LinkIcon,
  PlusCircleIcon,
  PlusIcon,
  QueueIcon,
  SkipNextTrackIcon,
  TrashIcon,
} from "./icons";
import { usePlayer } from "./player";
import { useRouter } from "./router";
import { useLibrary } from "./store";
import { toast } from "./toast";
import type { Track } from "./types";
import { cleanTitle } from "./util";

type SheetState =
  | { kind: "track"; track: Track; playlistId?: string }
  | { kind: "addTo"; track: Track }
  | { kind: "create"; thenAdd?: Track }
  | { kind: "import" }
  | { kind: "playlist"; id: string }
  | { kind: "profile" }
  | null;

type UIApi = {
  playerOpen: boolean;
  openPlayer: () => void;
  closePlayer: () => void;
  openTrackMenu: (track: Track, playlistId?: string) => void;
  openAddTo: (track: Track) => void;
  openCreate: () => void;
  openImport: () => void;
  openPlaylistMenu: (id: string) => void;
  openProfile: () => void;
  closeSheet: () => void;
};

const Ctx = createContext<UIApi | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const openPlayer = useCallback(() => {
    window.history.pushState({ np: true }, "");
    setPlayerOpen(true);
  }, []);
  const closePlayer = useCallback(() => {
    if ((window.history.state as { np?: boolean } | null)?.np) window.history.back();
    else setPlayerOpen(false);
  }, []);

  // Android/browser back button closes the full-screen player first.
  useEffect(() => {
    const onPop = () => setPlayerOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value = useMemo<UIApi>(
    () => ({
      playerOpen,
      openPlayer,
      closePlayer,
      openTrackMenu: (track, playlistId) => setSheet({ kind: "track", track, playlistId }),
      openAddTo: track => setSheet({ kind: "addTo", track }),
      openCreate: () => setSheet({ kind: "create" }),
      openImport: () => setSheet({ kind: "import" }),
      openPlaylistMenu: id => setSheet({ kind: "playlist", id }),
      openProfile: () => setSheet({ kind: "profile" }),
      closeSheet: () => setSheet(null),
    }),
    [playerOpen, openPlayer, closePlayer]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheets sheet={sheet} setSheet={setSheet} />
    </Ctx.Provider>
  );
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("UIProvider missing");
  return ctx;
}

/* ------------------------------- sheets -------------------------------- */

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

function Sheets({ sheet, setSheet }: { sheet: SheetState; setSheet: (s: SheetState) => void }) {
  if (!sheet) return null;
  const close = () => setSheet(null);
  switch (sheet.kind) {
    case "track":
      return <TrackMenu track={sheet.track} playlistId={sheet.playlistId} close={close} setSheet={setSheet} />;
    case "addTo":
      return <AddToPlaylist track={sheet.track} close={close} setSheet={setSheet} />;
    case "create":
      return <CreatePlaylist thenAdd={sheet.thenAdd} close={close} />;
    case "import":
      return <ImportPlaylist close={close} />;
    case "playlist":
      return <PlaylistMenu id={sheet.id} close={close} />;
    case "profile":
      return <Profile close={close} />;
  }
}

function TrackMenu({
  track,
  playlistId,
  close,
  setSheet,
}: {
  track: Track;
  playlistId?: string;
  close: () => void;
  setSheet: (s: SheetState) => void;
}) {
  const lib = useLibrary();
  const player = usePlayer();
  const liked = lib.isLiked(track.id);
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(track.url);
      toast("اتنسخ الرابط");
    } catch {
      toast(track.url);
    }
  };
  return (
    <Modal onClose={close}>
      <div className="sheet-head">
        <TrackArt track={track} />
        <div style={{ minWidth: 0 }}>
          <h3 className="clamp-1">{cleanTitle(track.title)}</h3>
          <p className="clamp-1">{track.channel}</p>
        </div>
      </div>
      <button
        className={`menu-item ${liked ? "green" : ""}`}
        onClick={run(() => toast(lib.toggleLike(track) ? "اتضافت للأغاني المفضلة" : "اتشالت من المفضلة"))}
      >
        <HeartIcon size={22} filled={liked} />
        {liked ? "إزالة من الأغاني المفضلة" : "إضافة للأغاني المفضلة"}
      </button>
      <button className="menu-item" onClick={() => setSheet({ kind: "addTo", track })}>
        <PlusCircleIcon size={22} /> إضافة لقائمة تشغيل
      </button>
      {playlistId && (
        <button
          className="menu-item danger"
          onClick={run(() => {
            if (playlistId === "liked") lib.toggleLike(track);
            else lib.removeFromPlaylist(playlistId, track.id);
            toast("اتشالت من القائمة");
          })}
        >
          <TrashIcon size={22} /> حذف من هذه القائمة
        </button>
      )}
      <button className="menu-item" onClick={run(() => player.playNext(track))}>
        <SkipNextTrackIcon size={22} /> تشغيل بعد الأغنية الحالية
      </button>
      <button className="menu-item" onClick={run(() => player.addToQueue(track))}>
        <QueueIcon size={22} /> إضافة لقائمة الانتظار
      </button>
      <a className="menu-item" href={track.url} target="_blank" rel="noreferrer" onClick={close}>
        <ExternalIcon size={22} /> فتح في YouTube
      </a>
      <button className="menu-item" onClick={run(() => void copy())}>
        <LinkIcon size={22} /> نسخ الرابط
      </button>
    </Modal>
  );
}

function AddToPlaylist({
  track,
  close,
  setSheet,
}: {
  track: Track;
  close: () => void;
  setSheet: (s: SheetState) => void;
}) {
  const lib = useLibrary();
  const liked = lib.isLiked(track.id);
  return (
    <Modal onClose={close}>
      <div className="sheet-title">إضافة إلى قائمة</div>
      <button className="menu-item" onClick={() => setSheet({ kind: "create", thenAdd: track })}>
        <PlusIcon size={22} /> قائمة جديدة
      </button>
      <button
        className={`menu-item ${liked ? "green" : ""}`}
        onClick={() => {
          toast(lib.toggleLike(track) ? "اتضافت للأغاني المفضلة" : "اتشالت من المفضلة");
          close();
        }}
      >
        {liked ? <CheckCircleIcon size={22} /> : <HeartIcon size={22} />} الأغاني المفضلة
      </button>
      {lib.playlists.map(p => {
        const has = p.tracks.some(t => t.id === track.id);
        return (
          <button
            key={p.id}
            className={`menu-item ${has ? "green" : ""}`}
            onClick={() => {
              toast(lib.addToPlaylist(p.id, track) === "added" ? `اتضافت إلى ${p.name}` : "الأغنية موجودة بالفعل");
              close();
            }}
          >
            {has ? <CheckCircleIcon size={22} /> : <PlusCircleIcon size={22} />} {p.name}
          </button>
        );
      })}
    </Modal>
  );
}

function CreatePlaylist({ thenAdd, close }: { thenAdd?: Track; close: () => void }) {
  const lib = useLibrary();
  const { navigate } = useRouter();
  const [name, setName] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const playlist = lib.createPlaylist(name, thenAdd ? [thenAdd] : []);
    close();
    if (thenAdd) toast(`اتضافت إلى ${playlist.name}`);
    else navigate(`/playlist/${playlist.id}`);
  };
  return (
    <Modal onClose={close}>
      <div className="sheet-title">اسم القائمة</div>
      <form className="field" onSubmit={submit}>
        <input
          autoFocus
          value={name}
          maxLength={60}
          placeholder={`قائمتي رقم ${lib.playlists.length + 1}`}
          onChange={e => setName(e.target.value)}
        />
        <button className="btn green" type="submit">
          إنشاء
        </button>
      </form>
    </Modal>
  );
}

function ImportPlaylist({ close }: { close: () => void }) {
  const lib = useLibrary();
  const { navigate } = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.playlist(value.trim());
      const playlist = lib.createPlaylist(data.title || "قائمة مستوردة", data.tracks, data.id);
      toast(`اتستوردت ${data.tracks.length} أغنية`);
      close();
      navigate(`/playlist/${playlist.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الاستيراد");
      setBusy(false);
    }
  };
  return (
    <Modal onClose={close}>
      <div className="sheet-title">استيراد قائمة من YouTube</div>
      <form className="field" onSubmit={e => void submit(e)}>
        <input
          autoFocus
          dir="ltr"
          value={value}
          placeholder="https://youtube.com/playlist?list=..."
          onChange={e => setValue(e.target.value)}
        />
        <div className="hint">الصق رابط القائمة (لازم تكون عامة أو غير مدرجة).</div>
        {error && <div className="err">{error}</div>}
        <button className="btn green" type="submit" disabled={busy || !value.trim()}>
          <ImportIcon size={18} /> {busy ? "جاري الاستيراد..." : "استيراد"}
        </button>
      </form>
    </Modal>
  );
}

function PlaylistMenu({ id, close }: { id: string; close: () => void }) {
  const lib = useLibrary();
  const { navigate } = useRouter();
  const playlist = lib.playlists.find(p => p.id === id);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(playlist?.name ?? "");
  const [confirm, setConfirm] = useState(false);
  if (!playlist) return null;

  if (renaming) {
    return (
      <Modal onClose={close}>
        <div className="sheet-title">إعادة تسمية</div>
        <form
          className="field"
          onSubmit={e => {
            e.preventDefault();
            lib.renamePlaylist(id, name);
            close();
          }}
        >
          <input autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} />
          <button className="btn green" type="submit">
            حفظ
          </button>
        </form>
      </Modal>
    );
  }
  return (
    <Modal onClose={close}>
      <div className="sheet-title clamp-1">{playlist.name}</div>
      <button className="menu-item" onClick={() => setRenaming(true)}>
        <EditIcon size={22} /> إعادة تسمية
      </button>
      {playlist.sourceId && (
        <a
          className="menu-item"
          href={`https://www.youtube.com/playlist?list=${playlist.sourceId}`}
          target="_blank"
          rel="noreferrer"
          onClick={close}
        >
          <ExternalIcon size={22} /> فتح في YouTube
        </a>
      )}
      <button
        className="menu-item danger"
        onClick={() => {
          if (!confirm) return setConfirm(true);
          lib.deletePlaylist(id);
          toast("اتحذفت القائمة");
          close();
          navigate("/library", true);
        }}
      >
        <TrashIcon size={22} /> {confirm ? "اضغط تاني للتأكيد" : "حذف القائمة"}
      </button>
    </Modal>
  );
}

function Diagnostics() {
  const player = usePlayer();
  const [d, setD] = useState(player.getDiagnostics());
  useEffect(() => {
    const id = window.setInterval(() => setD(player.getDiagnostics()), 1000);
    return () => window.clearInterval(id);
  }, [player]);
  const rows: Array<[string, string]> = [
    ["وضع المشغّل", d.mode === "api" ? `YouTube API (${d.attempt})` : d.mode === "embed" ? `Embed احتياطي (${d.reason})` : "جاري البدء"],
    ["جاهزية الـ API", d.methods ? "جاهز" : d.apiLoaded ? "محمّل — بانتظار الجاهزية" : "غير محمّل"],
    ["أحداث المشغّل", d.eventsAlive ? "شغّالة" : "لا تصل (العدّاد يعمل بالساعة الداخلية)"],
    ["آخر حالة / خطأ", `${d.lastState} / ${d.lastError || "-"}`],
    ["الموضع", `${d.position}s`],
    ["Origin", d.origin + (d.native ? " (تطبيق)" : "")],
  ];
  return (
    <div className="field" style={{ fontSize: 13, color: "var(--sub)", gap: 4 }}>
      <div style={{ color: "#fff", fontWeight: 800, marginTop: 6 }}>تشخيص المشغّل</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>{k}</span>
          <span dir="ltr" style={{ color: "#fff", textAlign: "end" }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

function Profile({ close }: { close: () => void }) {
  const lib = useLibrary();
  const [name, setName] = useState(lib.name);
  return (
    <Modal onClose={close}>
      <div className="sheet-title">الملف الشخصي</div>
      <form
        className="field"
        onSubmit={e => {
          e.preventDefault();
          lib.setName(name.trim());
          close();
        }}
      >
        <input value={name} maxLength={30} placeholder="اسمك" onChange={e => setName(e.target.value)} />
        <button className="btn green" type="submit">
          حفظ
        </button>
      </form>
      <button
        className="menu-item danger"
        onClick={() => {
          lib.clearSearches();
          toast("اتمسح سجل البحث");
          close();
        }}
      >
        <CloseIcon size={22} /> مسح سجل البحث
      </button>
      <Diagnostics />
    </Modal>
  );
}


