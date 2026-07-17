// Bible reference parsing + KJV lookup.
// KJV JSON is loaded lazily on first use and cached in-module.

let _kjvPromise = null;
function loadKjv() {
  if (!_kjvPromise) {
    _kjvPromise = import("@/assets/bible/kjv.json").then((m) => m.default || m);
  }
  return _kjvPromise;
}

// Prewarm on idle so first hover is instant, without blocking initial render.
export function prewarmBible() {
  if (typeof window === "undefined") return;
  const kick = () => loadKjv().catch(() => {});
  if ("requestIdleCallback" in window) window.requestIdleCallback(kick, { timeout: 3000 });
  else setTimeout(kick, 1500);
}

// [ canonicalName, index, [aliases...] ]
export const BOOKS = [
  ["Genesis", 0, ["gen", "ge", "gn"]],
  ["Exodus", 1, ["ex", "exo", "exod"]],
  ["Leviticus", 2, ["lev", "lv"]],
  ["Numbers", 3, ["num", "nm", "nu"]],
  ["Deuteronomy", 4, ["deut", "dt", "de", "deutronomy", "duet", "duetronomy"]],
  ["Joshua", 5, ["josh", "jos", "js"]],
  ["Judges", 6, ["judg", "jdg", "jud"]],
  ["Ruth", 7, ["ru", "rt"]],
  ["1 Samuel", 8, ["1sam", "1sm", "1sa", "isam", "isa m"]],
  ["2 Samuel", 9, ["2sam", "2sm", "2sa", "iisam"]],
  ["1 Kings", 10, ["1kgs", "1ki", "1kg", "ikgs"]],
  ["2 Kings", 11, ["2kgs", "2ki", "2kg", "iikgs"]],
  ["1 Chronicles", 12, ["1chr", "1ch", "1chron", "ichr"]],
  ["2 Chronicles", 13, ["2chr", "2ch", "2chron", "iichr"]],
  ["Ezra", 14, ["ezr"]],
  ["Nehemiah", 15, ["neh", "ne", "nehemia"]],
  ["Esther", 16, ["est", "esth", "et"]],
  ["Job", 17, ["jb"]],
  ["Psalms", 18, ["ps", "psa", "psalm", "pss"]],
  ["Proverbs", 19, ["prov", "prv", "pr", "pro"]],
  ["Ecclesiastes", 20, ["eccl", "ecc", "ec", "qoh", "eclesiastes", "ecclesiaste", "ecclessiastes"]],
  ["Song of Solomon", 21, ["song", "songs", "sos", "so", "songofsongs", "canticles", "cant"]],
  ["Isaiah", 22, ["isa", "is", "isiah", "esaias"]],
  ["Jeremiah", 23, ["jer", "jr"]],
  ["Lamentations", 24, ["lam", "lm"]],
  ["Ezekiel", 25, ["ezek", "ez", "eze"]],
  ["Daniel", 26, ["dan", "dn", "da"]],
  ["Hosea", 27, ["hos", "ho"]],
  ["Joel", 28, ["jl", "joe"]],
  ["Amos", 29, ["am", "amo"]],
  ["Obadiah", 30, ["obad", "ob"]],
  ["Jonah", 31, ["jon", "jnh"]],
  ["Micah", 32, ["mic", "mi"]],
  ["Nahum", 33, ["nah", "na"]],
  ["Habakkuk", 34, ["hab", "hk", "habakuk", "habbakuk", "habakkuk"]],
  ["Zephaniah", 35, ["zeph", "zep", "zp"]],
  ["Haggai", 36, ["hag", "hg"]],
  ["Zechariah", 37, ["zech", "zec", "zc", "zecharia"]],
  ["Malachi", 38, ["mal", "ml"]],
  ["Matthew", 39, ["matt", "mt", "mat", "mathew", "mattew", "matthews"]],
  ["Mark", 40, ["mk", "mrk"]],
  ["Luke", 41, ["lk", "luk"]],
  ["John", 42, ["jn", "joh", "jhn"]],
  ["Acts", 43, ["act", "ac"]],
  ["Romans", 44, ["rom", "rm", "ro"]],
  ["1 Corinthians", 45, ["1cor", "1co", "icor"]],
  ["2 Corinthians", 46, ["2cor", "2co", "iicor"]],
  ["Galatians", 47, ["gal", "gl", "ga"]],
  ["Ephesians", 48, ["eph", "ep"]],
  ["Philippians", 49, ["phil", "php", "ph"]],
  ["Colossians", 50, ["col", "cl"]],
  ["1 Thessalonians", 51, ["1thess", "1thes", "1th", "1ts", "ithess"]],
  ["2 Thessalonians", 52, ["2thess", "2thes", "2th", "2ts", "iithess"]],
  ["1 Timothy", 53, ["1tim", "1ti", "1tm", "itim"]],
  ["2 Timothy", 54, ["2tim", "2ti", "2tm", "iitim"]],
  ["Titus", 55, ["tit", "tt"]],
  ["Philemon", 56, ["philem", "phm", "phlm"]],
  ["Hebrews", 57, ["heb", "hb"]],
  ["James", 58, ["jas", "jm", "jam"]],
  ["1 Peter", 59, ["1pet", "1pe", "1pt", "ipet"]],
  ["2 Peter", 60, ["2pet", "2pe", "2pt", "iipet"]],
  ["1 John", 61, ["1john", "1jn", "1jo", "1jhn", "ijohn"]],
  ["2 John", 62, ["2john", "2jn", "2jo", "iijohn"]],
  ["3 John", 63, ["3john", "3jn", "3jo", "iiijohn"]],
  ["Jude", 64, ["jud", "jd", "jde"]],
  ["Revelation", 65, ["rev", "re", "rv", "apoc", "apocalypse"]],
];

const _bookMap = new Map();
for (const [name, idx, aliases] of BOOKS) {
  const key = (s) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  _bookMap.set(key(name), idx);
  for (const a of aliases) _bookMap.set(key(a), idx);
}
// Disambiguation: Jude/Judges collision on "jud" — prefer Judges when followed by a chapter, since Jude has only 1 chapter; handled at parse time when needed.

function normalizeBookToken(raw) {
  const k = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
  return _bookMap.has(k) ? _bookMap.get(k) : null;
}

// Regex matches:  Book [ws] chapter[:verse[-verse]][, verse[-verse]]*
// Book can be "1 John", "I John", "First John", "Song of Solomon", or a single word.
const BOOK_PREFIX = "(?:(?:1|2|3|I{1,3})\\s*)?";
const BOOK_WORD = "[A-Za-z][A-Za-z.]*";
const BOOK_RE_SRC = `\\b(${BOOK_PREFIX}(?:Song\\s+of\\s+Solomon|Song\\s+of\\s+Songs|${BOOK_WORD}(?:\\s+of\\s+${BOOK_WORD})?))\\.?\\s+(\\d{1,3})(?::(\\d{1,3}(?:\\s*-\\s*\\d{1,3})?(?:\\s*,\\s*\\d{1,3}(?:\\s*-\\s*\\d{1,3})?)*))?\\b`;

export const REFERENCE_REGEX_GLOBAL = new RegExp(BOOK_RE_SRC, "g");
export const REFERENCE_REGEX = new RegExp("^" + BOOK_RE_SRC + "$");

export function parseReference(text) {
  if (!text) return null;
  const m = String(text).trim().match(REFERENCE_REGEX);
  if (!m) return null;
  const bookIdx = normalizeBookToken(m[1]);
  if (bookIdx == null) return null;
  const chapter = parseInt(m[2], 10);
  const versesPart = m[3];
  const verses = [];
  if (versesPart) {
    for (const seg of versesPart.split(",")) {
      const [a, b] = seg.split("-").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(a)) verses.push({ start: a, end: !isNaN(b) ? b : a });
    }
  }
  const canonical = BOOKS[bookIdx][0];
  return { bookIdx, book: canonical, chapter, verses };
}

export function formatReference(ref) {
  if (!ref) return "";
  if (!ref.verses.length) return `${ref.book} ${ref.chapter}`;
  const parts = ref.verses.map((v) => (v.start === v.end ? `${v.start}` : `${v.start}-${v.end}`));
  return `${ref.book} ${ref.chapter}:${parts.join(",")}`;
}

// Scan free text for candidate references; returns array of {start,end,match,ref}.
export function findReferencesInText(text) {
  if (!text) return [];
  const results = [];
  const re = new RegExp(BOOK_RE_SRC, "g");
  let m;
  while ((m = re.exec(text)) != null) {
    const ref = parseReference(m[0]);
    if (ref) results.push({ start: m.index, end: m.index + m[0].length, match: m[0], ref });
  }
  return results;
}

export async function lookupVerses(refOrString) {
  const ref = typeof refOrString === "string" ? parseReference(refOrString) : refOrString;
  if (!ref) return null;
  const kjv = await loadKjv();
  const book = kjv[ref.bookIdx];
  if (!book) return null;
  const chapter = book.c[ref.chapter - 1];
  if (!chapter) return { ref, verses: [], notFound: true };
  const items = [];
  if (!ref.verses.length) {
    for (let i = 0; i < chapter.length; i++) items.push({ n: i + 1, text: chapter[i] });
  } else {
    for (const range of ref.verses) {
      for (let i = range.start; i <= range.end; i++) {
        const t = chapter[i - 1];
        if (t != null) items.push({ n: i, text: t });
      }
    }
  }
  return { ref, verses: items, notFound: items.length === 0 };
}

export function chapterVerseCount(bookIdx, chapter, kjv) {
  const book = kjv?.[bookIdx];
  if (!book) return 0;
  const ch = book.c[chapter - 1];
  return ch ? ch.length : 0;
}

export function getKjv() {
  return loadKjv();
}
