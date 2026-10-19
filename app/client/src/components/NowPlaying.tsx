import { useState, type CSSProperties } from "react";
import { ChevronDownIcon, CloseIcon, HeartIcon, MoreIcon, QueueIcon, VideoIcon } from "../icons";
import { usePlayer } from "../player";
import { useLibrary } from "../store";
import { useUI } from "../ui";
import { cleanTitle, colorFor, cx } from "../util";
import { TrackArt } from "./Art";
import { Controls } from "./Controls";
import { SeekBar } from "./SeekBar";
import { Equalizer } from "./TrackRow";

export function NowPlaying() {
  const p = usePlayer();
  const lib = useLibrary();
  const ui = useUI();
  const [view, setView] = useState<"stage" | "queue">("stage");
  const track = p.current;
  if (!ui.playerOpen || !track) return null;
  const liked = lib.isLiked(track.id);

  return (
    <div className="np" style={{ "--np": colorFor(track.id, 42, 34) } as CSSProperties}>
      <div className="np-head">
        <button className="icon-btn" style={{ color: "#fff" }} aria-label="إغلاق" onClick={ui.closePlayer}>
          <ChevronDownIcon size={30} />
        </button>
        <div className="ctx">
          <small>{view === "queue" ? "قائمة الانتظار" : "يتم التشغيل من"}</small>
          <b className="clamp-1">{view === "queue" ? `${p.queue.length} أغنية` : p.sourceLabel || "YMusic"}</b>
        </div>
        <button className="icon-btn" style={{ color: "#fff" }} aria-label="المزيد" onClick={() => ui.openTrackMenu(track)}>
          <MoreIcon size={22} />
        </button>
      </div>

      {view === "queue" ? (
        <div className="np-stage" style={{ alignItems: "start", placeItems: "stretch" }}>
          <div className="track-list" style={{ marginInline: -22 }}>
            {p.queue.map((t, i) => (
              <div key={`${t.id}-${i}`} className={cx("track", i === p.index && "active")}>
                <button className="track-hit" onClick={() => p.jumpTo(i)}>
                  <TrackArt track={t} />
                  <span className="track-main">
                    <span className="track-title clamp-1">{cleanTitle(t.title)}</span>
                    <span className="track-sub">
                      {i === p.index && <Equalizer paused={!p.isPlaying} />}
                      <span className="clamp-1">{t.channel}</span>
                    </span>
                  </span>
                </button>
                {i !== p.index && (
                  <button className="icon-btn" aria-label="إزالة من الانتظار" onClick={() => p.removeFromQueue(i)}>
                    <CloseIcon size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="np-stage">
          {p.videoMode ? (
            <div className="np-video" ref={p.setVideoSlot} />
          ) : (
            <TrackArt track={track} className="np-art" />
          )}
        </div>
      )}

      <div className="np-info">
        <div style={{ minWidth: 0 }}>
          <h2 className="clamp-2">{cleanTitle(track.title)}</h2>
          <p className="clamp-1">{track.channel}</p>
        </div>
        <button className={cx("icon-btn", liked && "on")} aria-label="المفضلة" onClick={() => lib.toggleLike(track)}>
          <HeartIcon size={28} filled={liked} />
        </button>
      </div>

      <SeekBar className="seek" />
      <Controls big />

      <div className="np-foot">
        <button
          className={cx("icon-btn", p.videoMode && "on")}
          aria-label={p.videoMode ? "عرض الغلاف" : "عرض الفيديو"}
          aria-pressed={p.videoMode}
          onClick={() => {
            setView("stage");
            p.setVideoMode(!p.videoMode);
          }}
        >
          <VideoIcon size={24} />
        </button>
        <button
          className={cx("icon-btn", view === "queue" && "on")}
          aria-label="قائمة الانتظار"
          onClick={() => setView(v => (v === "queue" ? "stage" : "queue"))}
        >
          <QueueIcon size={24} />
        </button>
      </div>
    </div>
  );
}
