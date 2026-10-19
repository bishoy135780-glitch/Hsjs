import { useEffect, useRef } from "react";
import { BottomNav, Sidebar } from "./components/Nav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MiniPlayer } from "./components/MiniPlayer";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerBar } from "./components/PlayerBar";
import Category from "./pages/Category";
import Home from "./pages/Home";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";
import Playlist from "./pages/Playlist";
import Search from "./pages/Search";
import { PlayerProvider, usePlayer } from "./player";
import { RouterProvider, match, useRouter } from "./router";
import { LibraryProvider } from "./store";
import { Toaster } from "./toast";
import { UIProvider } from "./ui";
import { cx } from "./util";

function Routes() {
  const { path } = useRouter();
  if (path === "/") return <Home />;
  if (path === "/search") return <Search />;
  if (path === "/library") return <Library />;
  if (match("/category/:id", path)) return <Category />;
  if (match("/playlist/:id", path)) return <Playlist />;
  return <NotFound />;
}

function Shell() {
  const { current } = usePlayer();
  const { path } = useRouter();
  const mainRef = useRef<HTMLElement | null>(null);

  // On desktop <main> is the scroll container, so reset it on navigation.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [path]);

  return (
    <div className={cx("app", !current && "no-player")}>
      <Sidebar />
      <main className="main" ref={mainRef}>
        <Routes />
      </main>
      <PlayerBar />
      <MiniPlayer />
      <BottomNav />
      <NowPlaying />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LibraryProvider>
        <RouterProvider>
          <PlayerProvider>
            <UIProvider>
              <Shell />
            </UIProvider>
          </PlayerProvider>
        </RouterProvider>
      </LibraryProvider>
    </ErrorBoundary>
  );
}
