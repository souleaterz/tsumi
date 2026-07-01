// Fire TV build stub for `aniwatch`.
//
// The TV app streams via Real-Debrid / torrents and never enables the HiAnime
// provider (ENABLE_HIANIME is unset), so the shared lib/stream/provider.ts only
// touches HiAnime inside a gated code path that never runs here. Aliasing
// `aniwatch` to this stub keeps its heavy, conflict-prone tree (cheerio →
// parse5 → entities) out of the TV bundle entirely. See tv/next.config.js.
class Scraper {}
module.exports = { HiAnime: { Scraper } };
