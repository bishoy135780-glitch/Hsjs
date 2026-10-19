import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePlayer, usePlayerTime } from "../player";
import { formatTime, parseDuration } from "../util";

/** Shared seek logic: dragging previews locally, releasing (or pausing input) seeks once. */
function useSeek() {
  const { t, d } = usePlayerTime();
  const player = usePlayer();
  const [drag, setDrag] = useState<number | null>(null);
  const pointerDown = useRef(false);
  const timer = useRef(0);
  const dragRef = useRef<number | null>(null);
  dragRef.current = drag;

  const max = d || parseDuration(player.current?.duration) || 1;
  const value = Math.min(drag ?? t, max);

  const commit = () => {
    window.clearTimeout(timer.current);
    const v = dragRef.current;
    if (v !== null) {
      player.seek(v);
      setDrag(null);
    }
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    max,
    value,
    pct: `${(value / max) * 100}%`,
    inputProps: {
      type: "range" as const,
      min: 0,
      max,
      step: 0.5,
      value,
      "aria-label": "شريط التقدم",
      onChange: (e: { target: { value: string } }) => {
        setDrag(Number(e.target.value));
        window.clearTimeout(timer.current);
        // Keyboard / assistive input has no pointer-up: commit shortly after the last change.
        if (!pointerDown.current) timer.current = window.setTimeout(commit, 250);
      },
      onPointerDown: () => {
        pointerDown.current = true;
      },
      onPointerUp: () => {
        pointerDown.current = false;
        commit();
      },
      onPointerCancel: () => {
        pointerDown.current = false;
        commit();
      },
      onBlur: commit,
    },
  };
}

export function SeekBar({ className = "" }: { className?: string }) {
  const { max, value, pct, inputProps } = useSeek();
  return (
    <div className={className}>
      <input className="slider" style={{ "--p": pct } as CSSProperties} {...inputProps} />
      <div className="times">
        <span>{formatTime(value)}</span>
        <span>{formatTime(max)}</span>
      </div>
    </div>
  );
}

/** Inline variant for the desktop bar: [0:12] ───●─── [3:45] */
export function SeekInline() {
  const { max, value, pct, inputProps } = useSeek();
  return (
    <div className="pb-seek">
      <span>{formatTime(value)}</span>
      <input className="slider green" style={{ "--p": pct } as CSSProperties} {...inputProps} />
      <span>{formatTime(max)}</span>
    </div>
  );
}
