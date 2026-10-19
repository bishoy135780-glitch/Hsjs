import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type Ref,
  type ReactNode,
} from "react";

/** Minimal History-API router (no dependencies). */

type Nav = { path: string; search: URLSearchParams; navigate: (to: string, replace?: boolean) => void };
const RouterContext = createContext<Nav | null>(null);

function read() {
  return { path: window.location.pathname, search: window.location.search };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(read);

  useEffect(() => {
    const onPop = () => setLoc(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    const current = window.location.pathname + window.location.search;
    if (to !== current) {
      if (replace) window.history.replaceState(null, "", to);
      else window.history.pushState(null, "", to);
    }
    setLoc(read());
    if (!replace) window.scrollTo(0, 0);
  }, []);

  const value = useMemo<Nav>(
    () => ({ path: loc.path, search: new URLSearchParams(loc.search), navigate }),
    [loc, navigate]
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("RouterProvider missing");
  return ctx;
}

export function Link({
  to,
  ref,
  onClick,
  children,
  ...rest
}: { to: string; ref?: Ref<HTMLAnchorElement> } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handle} ref={ref} {...rest}>
      {children}
    </a>
  );
}

/** Matches "/playlist/:id" style patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
