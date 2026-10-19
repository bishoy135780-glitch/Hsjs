import { useEffect, useState } from "react";

type Item = { id: number; text: string };
const listeners = new Set<(item: Item) => void>();
let counter = 0;

/** Fire-and-forget toast usable from anywhere (including non-React code). */
export function toast(text: string) {
  counter += 1;
  const item = { id: counter, text };
  listeners.forEach(fn => fn(item));
}

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const add = (item: Item) => {
      setItems(prev => [...prev.slice(-2), item]);
      window.setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), 3200);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map(item => (
        <div key={item.id} className="toast">
          {item.text}
        </div>
      ))}
    </div>
  );
}
