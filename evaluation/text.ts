/** Text helpers: normalisation, stemming, stop words, a pronounceability-based real-word test. */

export const STOPWORDS = new Set(
  `a an the and or but if so of to in on at by for with from as is are was were be been being am do does did have has had
  i me my mine we our you your he she it its they them their this that these those there here what which who whom when where
  why how can could should would will shall may might must not no yes also very just than then too about into over under
  up down out off again more most some any each other such only own same both few all can't don't won't`
    .split(/\s+/)
    .filter(Boolean),
);

/** Common English words that are neither stop words nor in a rubric, so the gibberish check does not misfire. */
const COMMON = new Set(
  `name raj student study studying college university school degree engineering computer science project work worked working
  team time good great make made use used using get got give gave take took know think thing things way ways like want need
  learn learned learning build built building help helped people person problem solve solved solution result results
  example approach step steps first second third finally because therefore however while after before during one two three
  many much well best better new old big small long short fast slow high low large first last next same different difference
  between each every both either neither always never often sometimes usually mostly really actually basically simple complex
  easy hard clear clearly explain explained understand company role job career goal goals future interest interested passion
  skill skills experience internship intern developer software web app application code coding program programming language
  data database table row column query key value store storage memory access fast speed reduce reduced improve improved
  deliver delivered lead led manage managed plan planned test tested debug fix fixed find found issue issues bug bugs
  user users client server request response api system design implement implemented create created update delete insert
  add remove list node element elements item items order sequence size fixed dynamic location position random direct`
    .split(/\s+/)
    .filter(Boolean),
);

const KEYBOARD_RUNS = ["qwert", "werty", "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "zxcv", "xcvb", "cvbn", "vbnm", "yuiop", "uiop", "poiu", "lkjh", "mnbv"];

/** O(1), O(n), O(log n) → bigo1, bigon, bigologn so they survive tokenisation. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bo\s*\(\s*([^)]{1,12}?)\s*\)/g, (_m, inner: string) => ` bigo${inner.replace(/[^a-z0-9]/g, "")} `)
    .replace(/[^a-z0-9'|\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compact suffix-stripping stemmer: pointers≈pointer, linked≈link, indexing≈index, stacks≈stack. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/'s$/, "");
  if (w.length <= 3 || w.startsWith("bigo")) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (/(ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("ly") && w.length > 5) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  if (/(.)\1$/.test(w) && w.length > 4 && !/(ss|ll)$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return normalise(text).split(" ").filter(Boolean);
}

export function stems(text: string): string[] {
  return tokens(text).map(stem);
}

/** Stems with stop words removed (the "meaningful" words). */
export function contentStems(text: string): string[] {
  return tokens(text)
    .filter((t) => !STOPWORDS.has(t))
    .map(stem);
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 2);
}

/**
 * Is this token a plausible real word? Known words (stop words, common words, anything from the question's own vocabulary)
 * pass; otherwise it must be pronounceable: has a vowel, no long consonant clusters, no keyboard-row runs, no tripled letters.
 */
export function isRealWord(token: string, vocab: Set<string>): boolean {
  const t = token.toLowerCase();
  if (/^\d+$/.test(t) || t.startsWith("bigo")) return true;
  if (STOPWORDS.has(t) || COMMON.has(t) || vocab.has(stem(t)) || vocab.has(t)) return true;
  if (t.length <= 2) return /[aeiouy]/.test(t) && t.length === 2;
  if (!/[aeiouy]/.test(t)) return false;
  if (/(.)\1\1/.test(t)) return false;
  if (/[^aeiouy]{5,}/.test(t)) return false;
  if (KEYBOARD_RUNS.some((k) => t.includes(k))) return false;
  const vowels = (t.match(/[aeiouy]/g) ?? []).length;
  if (t.length >= 6 && vowels / t.length < 0.2) return false;
  return true;
}

/** Share of unordered pairs of adjacent tokens that repeat. 1 = same word over and over. */
export function repetitionRatio(toks: string[]): number {
  if (toks.length < 4) return 0;
  const counts = new Map<string, number>();
  for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return top / toks.length;
}
