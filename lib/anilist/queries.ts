// Reusable GraphQL fragment for the media fields the UI needs.
export const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large medium color }
  bannerImage
  format
  status
  episodes
  duration
  season
  seasonYear
  startDate { year month day }
  averageScore
  meanScore
  popularity
  genres
  trailer { id site thumbnail }
  studios(isMain: true) { nodes { id name isAnimationStudio } }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

export const TRENDING_QUERY = `
  query Trending($perPage: Int = 24) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const SEASONAL_QUERY = `
  query Seasonal($season: MediaSeason, $seasonYear: Int, $perPage: Int = 24) {
    Page(page: 1, perPage: $perPage) {
      media(
        type: ANIME
        season: $season
        seasonYear: $seasonYear
        sort: POPULARITY_DESC
        isAdult: false
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const POPULAR_QUERY = `
  query Popular($perPage: Int = 12) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const DETAIL_QUERY = `
  query Detail($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      relations {
        edges {
          relationType
          node { id title { romaji english } coverImage { large } format }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 12) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large color }
            averageScore
            format
          }
        }
      }
    }
  }
`;

export const SEARCH_QUERY = `
  query Search(
    $search: String
    $genre: String
    $seasonYear: Int
    $format: MediaFormat
    $status: MediaStatus
    $sort: [MediaSort]
    $page: Int = 1
    $perPage: Int = 28
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(
        type: ANIME
        search: $search
        genre: $genre
        seasonYear: $seasonYear
        format: $format
        status: $status
        sort: $sort
        isAdult: false
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

export const GENRES_QUERY = `
  query {
    GenreCollection
  }
`;

// Aggregate recommendations for a set of seed anime (the user's history/list).
export const RECS_QUERY = `
  query Recs($ids: [Int], $perPage: Int = 6) {
    Page(page: 1, perPage: $perPage) {
      media(id_in: $ids, type: ANIME) {
        id
        recommendations(sort: RATING_DESC, perPage: 10) {
          nodes {
            mediaRecommendation {
              ${MEDIA_FIELDS}
            }
          }
        }
      }
    }
  }
`;

// Lightweight query for search-as-you-type suggestions.
export const SUGGEST_QUERY = `
  query Suggest($search: String, $perPage: Int = 8) {
    Page(page: 1, perPage: $perPage) {
      media(type: ANIME, search: $search, sort: SEARCH_MATCH, isAdult: false) {
        id
        title { romaji english }
        coverImage { medium color }
        format
        seasonYear
        averageScore
      }
    }
  }
`;

// Same suggestion shape, fetched by id (for "did you mean" typo correction).
export const SUGGEST_BY_IDS_QUERY = `
  query SuggestByIds($ids: [Int]) {
    Page(page: 1, perPage: 12) {
      media(type: ANIME, id_in: $ids, sort: POPULARITY_DESC) {
        id
        title { romaji english }
        coverImage { medium color }
        format
        seasonYear
        averageScore
      }
    }
  }
`;

// Minimal title index (popular anime) used for fuzzy typo correction.
export const TITLE_INDEX_QUERY = `
  query TitleIndex($page: Int = 1, $perPage: Int = 50) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english }
      }
    }
  }
`;
