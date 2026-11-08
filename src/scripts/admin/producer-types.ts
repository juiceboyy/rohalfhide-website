export interface ProducerHeroData {
  eyebrowLeft: string;
  eyebrowRight: string;
  title: string;
  subtitle: string;
}

export interface ProducerStudioData {
  name: string;
  address: string;
  city: string;
  summary: string;
  approach: string;
  setupHighlights: string[];
}

export interface ProducerService {
  id: string;
  title: string;
  description: string;
}

export interface ProducerChapter {
  id: string;
  indexLabel: string;
  title: string;
  description: string;
  draft?: boolean;
}

export interface SongIdea {
  id: string;
  chapterId: string;
  title: string;
  mediaType: 'audio' | 'video';
  src: string;
  poster?: string;
  cover?: string;
  duration: string;
  note: string;
  year?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  width?: number;
  height?: number;
  instagramUrl?: string;
  draft?: boolean;
}

export interface ProductionCredit {
  id: string;
  title: string;
  artist: string;
  role: string;
  year: string;
  cover: string;
  audioPreview?: string;
  externalUrl?: string;
  notes?: string;
  draft?: boolean;
}

export interface ProducerTestimonial {
  id: string;
  quote: string;
  author: string;
  roleOrProject: string;
  draft?: boolean;
}

export interface ProducerPortfolioData {
  instagramHighlightsUrl: string;
  hero: ProducerHeroData;
  studio: ProducerStudioData;
  services: ProducerService[];
  chapters: ProducerChapter[];
  songIdeas: SongIdea[];
  credits: ProductionCredit[];
  testimonials: ProducerTestimonial[];
}
