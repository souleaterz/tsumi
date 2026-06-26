export interface AnilistTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface AnilistCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
  color?: string | null;
}

export interface AnilistDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface AnilistTrailer {
  id?: string | null;
  site?: string | null;
  thumbnail?: string | null;
}

export interface AnilistStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface AnilistMedia {
  id: number;
  idMal?: number | null;
  title: AnilistTitle;
  description?: string | null;
  coverImage?: AnilistCoverImage;
  bannerImage?: string | null;
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  startDate?: AnilistDate;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  genres?: string[];
  trailer?: AnilistTrailer | null;
  studios?: { nodes: AnilistStudio[] };
  nextAiringEpisode?: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  } | null;
}

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: number | boolean;
  perPage: number;
}

export type MediaSort =
  | 'TRENDING_DESC'
  | 'POPULARITY_DESC'
  | 'SCORE_DESC'
  | 'FAVOURITES_DESC'
  | 'START_DATE_DESC'
  | 'UPDATED_AT_DESC';

export type MediaSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
