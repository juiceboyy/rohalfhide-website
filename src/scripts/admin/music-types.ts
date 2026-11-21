export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  duration: string;
  cover: string;
  releaseDate?: string;
  draft?: boolean;
  links?: {
    spotify?: string;
    appleMusic?: string;
    bandcamp?: string;
    soundcloud?: string;
    youtube?: string;
  };
}
