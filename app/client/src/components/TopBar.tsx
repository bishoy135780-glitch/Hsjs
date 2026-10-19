import type { ReactNode } from "react";
import { useLibrary } from "../store";
import { useUI } from "../ui";

export function Avatar() {
  const lib = useLibrary();
  const ui = useUI();
  return (
    <button className="avatar" aria-label="الملف الشخصي" onClick={ui.openProfile}>
      {(lib.name.trim()[0] || "ت").toUpperCase()}
    </button>
  );
}

export function TopBar({ children, title }: { children?: ReactNode; title?: string }) {
  return (
    <header className="top-bar">
      <Avatar />
      {title && <h1 className="page-title">{title}</h1>}
      {children}
    </header>
  );
}
