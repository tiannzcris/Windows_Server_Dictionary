// search.js — fuzzy search, ranking, and combinable filtering.
//
// Search matches on term name, abbreviation (the text inside parentheses,
// e.g. "AD" in "Active Directory (AD)"), category, and definition text. It
// tolerates typos via a small Levenshtein-distance check per word, so
// "hyer-v" still finds "Hyper-V" and "activ directry" still finds
// "Active Directory (AD)".

/** Classic Levenshtein edit distance between two lowercase strings. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** How many typo'd characters we tolerate, scaled to word length. */
function fuzzyThreshold(len) {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

function wordsOf(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Pull the abbreviation out of "Active Directory (AD)" → "AD". */
function extractAbbreviation(term) {
  const match = /\(([^)]+)\)/.exec(term || "");
  return match ? match[1] : "";
}

/**
 * Precompute the searchable shape of every term once per data load, so
 * each keystroke only re-scores lightweight precomputed fields instead of
 * re-normalizing full definition text every time.
 */
export function buildSearchIndex(terms) {
  return terms.map((term) => {
    const nameLower = (term.term || "").toLowerCase();
    const abbreviation = extractAbbreviation(term.term);
    return {
      term,
      nameLower,
      nameWords: wordsOf(term.term),
      abbrevWords: wordsOf(abbreviation),
      categoryWords: wordsOf(term.category),
      defLower: `${term.shortDefinition || ""} ${term.extendedDefinition || ""}`.toLowerCase(),
    };
  });
}

function wordMatchScore(queryWord, candidateWords) {
  let best = 0;
  // Single-character tokens (e.g. the "v" left over from splitting "hyer-v"
  // on its hyphen) are near-meaningless as a search signal — score them low
  // so they don't inflate matches on every term whose name happens to
  // contain a lone "V" (Hyper-V, VM, VDI, VSS, …).
  if (queryWord.length <= 1) {
    return candidateWords.includes(queryWord) ? 8 : 0;
  }

  for (const candidate of candidateWords) {
    if (candidate === queryWord) return 100;
    if (candidate.startsWith(queryWord)) best = Math.max(best, 85);
    if (queryWord.length >= 3) {
      const threshold = fuzzyThreshold(Math.max(queryWord.length, candidate.length));
      const dist = levenshtein(queryWord, candidate);
      if (dist <= threshold) best = Math.max(best, 70 - dist * 12);
    }
  }
  return best;
}

/** Score one indexed term against the query words. 0 means "no match". */
function scoreEntry(entry, queryWords) {
  let total = 0;
  for (const qw of queryWords) {
    let wordScore = wordMatchScore(qw, entry.nameWords);
    if (!wordScore) wordScore = wordMatchScore(qw, entry.abbrevWords);
    if (!wordScore) wordScore = wordMatchScore(qw, entry.categoryWords) * 0.5;
    if (!wordScore && qw.length >= 3 && entry.defLower.includes(qw)) wordScore = 25;

    if (!wordScore) return 0; // every query word must match something
    total += wordScore;
  }
  if (entry.nameLower.startsWith(queryWords.join(" "))) total += 40;
  return total;
}

/**
 * Rank an indexed term list against a free-text query.
 * Returns [{ term, score }, …] sorted best-first, query words that match
 * nothing excluded entirely.
 */
export function rankTerms(index, query) {
  const queryWords = wordsOf(query);
  if (!queryWords.length) return index.map((entry) => ({ term: entry.term, score: 0 }));

  const results = [];
  for (const entry of index) {
    const score = scoreEntry(entry, queryWords);
    if (score > 0) results.push({ term: entry.term, score });
  }
  results.sort((a, b) => b.score - a.score || a.term.term.localeCompare(b.term.term));
  return results;
}

/**
 * Full filter pipeline: text query (fuzzy-ranked) + category + favorites,
 * combinable. Powers both the main grid and the A–Z view.
 */
export function filterTerms(index, { query = "", category = "all", favoritesOnly = false } = {}) {
  let results = query.trim() ? rankTerms(index, query).map((r) => r.term) : index.map((e) => e.term).sort((a, b) => a.term.localeCompare(b.term));

  if (category && category !== "all") {
    results = results.filter((t) => t.category === category);
  }
  if (favoritesOnly) {
    results = results.filter((t) => t.favorite);
  }
  return results;
}

/** Top N suggestions for the autocomplete dropdown. */
export function getSuggestions(index, query, limit = 8) {
  if (!query.trim()) return [];
  return rankTerms(index, query)
    .slice(0, limit)
    .map((r) => r.term);
}

/**
 * Split `text` into [{ value, matched }] segments so the UI layer can
 * highlight matches with a real <mark> element instead of building HTML
 * strings out of (potentially visitor-authored) text.
 */
export function highlightSegments(text, query) {
  const queryWords = wordsOf(query).filter((w) => w.length >= 2);
  if (!queryWords.length || !text) return [{ value: text || "", matched: false }];

  const escaped = queryWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  // A single capturing group makes String.split() interleave the text as
  // [nonMatch, match, nonMatch, match, …] — odd indices are always matches.
  const parts = text.split(pattern);
  return parts
    .map((value, i) => ({ value, matched: i % 2 === 1 }))
    .filter((segment) => segment.value !== undefined && segment.value !== "");
}
