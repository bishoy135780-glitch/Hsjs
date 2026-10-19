import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Playlist, Track } from "./types";
import { newId, readJson, writeJson } from "./util";

type Library = {
  playlists: Playlist[];
  liked: Track[]; // newest first
  recents: Track[]; // newest first
  searches: string[]; // newest first
  name: string;
};

type Actions = {
  isLiked: (id: string) => boolean;
  toggleLike: (track: Track) => boolean; // returns new liked state
  createPlaylist: (name: string, tracks?: Track[], sourceId?: string) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, track: Track) => "added" | "exists";
  removeFromPlaylist: (id: string, trackId: string) => void;
  pushRecent: (track: Track) => void;
  pushSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearSearches: () => void;
  setName: (name: string) => void;
};

const KEY = "ymusic-library-v2";
const empty: Library = { playlists: [], liked: [], recents: [], searches: [], name: "" };

/** Reads v2, migrating the old v1 keys (ymusic-liked / ymusic-playlists) once. */
function load(): Library {
  const saved = readJson<Library | null>(KEY, null);
  if (saved) return { ...empty, ...saved };

  const old = readJson<Array<{ id: string; name: string; tracks: Track[]; sourceUrl?: string }>>(
    "ymusic-playlists",
    []
  );
  const migrated: Library = {
    ...empty,
    liked: old.find(p => p.id === "liked")?.tracks.slice().reverse() ?? [],
    playlists: old
      .filter(p => p.id !== "liked" && p.tracks.length > 0)
      .map(p => ({ id: p.id, name: p.name, tracks: p.tracks, createdAt: Date.now() })),
  };
  return migrated;
}

const Ctx = createContext<(Library & Actions) | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [lib, setLib] = useState<Library>(load);

  useEffect(() => writeJson(KEY, lib), [lib]);

  const likedIds = useMemo(() => new Set(lib.liked.map(t => t.id)), [lib.liked]);

  const isLiked = useCallback((id: string) => likedIds.has(id), [likedIds]);

  const toggleLike = useCallback(
    (track: Track) => {
      const liked = likedIds.has(track.id);
      setLib(prev => ({
        ...prev,
        liked: liked ? prev.liked.filter(t => t.id !== track.id) : [track, ...prev.liked],
      }));
      return !liked;
    },
    [likedIds]
  );

  const createPlaylist = useCallback((name: string, tracks: Track[] = [], sourceId?: string) => {
    const playlist: Playlist = {
      id: newId(),
      name: name.trim() || "قائمة جديدة",
      tracks,
      createdAt: Date.now(),
      sourceId,
    };
    setLib(prev => ({ ...prev, playlists: [playlist, ...prev.playlists] }));
    return playlist;
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLib(prev => ({
      ...prev,
      playlists: prev.playlists.map(p => (p.id === id ? { ...p, name: trimmed } : p)),
    }));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setLib(prev => ({ ...prev, playlists: prev.playlists.filter(p => p.id !== id) }));
  }, []);

  const addToPlaylist = useCallback(
    (id: string, track: Track) => {
      const target = lib.playlists.find(p => p.id === id);
      if (!target || target.tracks.some(t => t.id === track.id)) return "exists" as const;
      setLib(prev => ({
        ...prev,
        playlists: prev.playlists.map(p =>
          p.id === id ? { ...p, tracks: [...p.tracks, track] } : p
        ),
      }));
      return "added" as const;
    },
    [lib.playlists]
  );

  const removeFromPlaylist = useCallback((id: string, trackId: string) => {
    setLib(prev => ({
      ...prev,
      playlists: prev.playlists.map(p =>
        p.id === id ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p
      ),
    }));
  }, []);

  const pushRecent = useCallback((track: Track) => {
    setLib(prev => ({
      ...prev,
      recents: [track, ...prev.recents.filter(t => t.id !== track.id)].slice(0, 30),
    }));
  }, []);

  const pushSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setLib(prev => ({
      ...prev,
      searches: [q, ...prev.searches.filter(s => s !== q)].slice(0, 10),
    }));
  }, []);

  const removeSearch = useCallback((query: string) => {
    setLib(prev => ({ ...prev, searches: prev.searches.filter(s => s !== query) }));
  }, []);
  const clearSearches = useCallback(() => setLib(prev => ({ ...prev, searches: [] })), []);
  const setName = useCallback((name: string) => setLib(prev => ({ ...prev, name })), []);

  const value = useMemo(
    () => ({
      ...lib,
      isLiked,
      toggleLike,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      pushRecent,
      pushSearch,
      removeSearch,
      clearSearches,
      setName,
    }),
    [
      lib,
      isLiked,
      toggleLike,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      pushRecent,
      pushSearch,
      removeSearch,
      clearSearches,
      setName,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("LibraryProvider missing");
  return ctx;
}
