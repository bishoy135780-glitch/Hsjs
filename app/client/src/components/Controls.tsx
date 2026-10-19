import { NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon } from "../icons";
import { usePlayer } from "../player";
import { cx } from "../util";

export function Controls({ big }: { big?: boolean }) {
  const p = usePlayer();
  const size = big ? 28 : 22;
  return (
    <div className={big ? "controls" : "pb-controls"}>
      <button className={cx("icon-btn", p.shuffle && "on")} aria-label="عشوائي" aria-pressed={p.shuffle} onClick={p.toggleShuffle}>
        <ShuffleIcon size={size - 4} />
      </button>
      <button className="icon-btn" aria-label="السابق" onClick={p.prev}>
        <PrevIcon size={size + 4} />
      </button>
      <button className="play" aria-label={p.isPlaying ? "إيقاف مؤقت" : "تشغيل"} onClick={p.toggle}>
        {p.buffering && !p.isPlaying ? (
          <span className="spin" />
        ) : p.isPlaying ? (
          <PauseIcon size={big ? 32 : 18} />
        ) : (
          <PlayIcon size={big ? 32 : 18} />
        )}
      </button>
      <button className="icon-btn" aria-label="التالي" onClick={p.next}>
        <NextIcon size={size + 4} />
      </button>
      <button
        className={cx("icon-btn", p.repeat !== "off" && "on")}
        aria-label={`تكرار: ${p.repeat === "off" ? "إيقاف" : p.repeat === "all" ? "الكل" : "أغنية واحدة"}`}
        onClick={p.cycleRepeat}
      >
        {p.repeat === "one" ? <RepeatOneIcon size={size - 4} /> : <RepeatIcon size={size - 4} />}
      </button>
    </div>
  );
}
