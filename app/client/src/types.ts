export type Track = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  views?: string;
  published?: string;
  thumbnail: string;
  url: string;
};

export type Playlist = {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  /** Original YouTube playlist id when imported. */
  sourceId?: string;
};

export type RepeatMode = "off" | "all" | "one";
