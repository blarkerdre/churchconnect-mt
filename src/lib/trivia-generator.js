// Builds Bible trivia questions from the bundled KJV text.
// Runs client-side (admin only) and the results are saved into trivia_questions.
import { getKjv, BOOKS } from "@/lib/bible/refs";

function rand(n) {
  return Math.floor(Math.random() * n);
}

function pickDistinct(pool, count, exclude) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < 500) {
    guard += 1;
    const candidate = pool[rand(pool.length)];
    if (candidate === exclude || out.includes(candidate)) continue;
    out.push(candidate);
  }
  return out;
}

function shuffleWithAnswer(answer, distractors) {
  const options = [answer, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, correct_index: options.indexOf(answer) };
}

function randomVerse(kjv) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bookIdx = rand(BOOKS.length);
    const book = kjv[bookIdx];
    if (!book?.c?.length) continue;
    const chapterIdx = rand(book.c.length);
    const chapter = book.c[chapterIdx];
    if (!chapter?.length) continue;
    const verseIdx = rand(chapter.length);
    const text = String(chapter[verseIdx] || "").trim();
    if (text.split(/\s+/).length < 8 || text.length > 260) continue;
    return {
      bookIdx,
      bookName: BOOKS[bookIdx][0],
      chapter: chapterIdx + 1,
      verse: verseIdx + 1,
      text,
      reference: `${BOOKS[bookIdx][0]} ${chapterIdx + 1}:${verseIdx + 1}`,
    };
  }
  return null;
}

const BOOK_NAMES = BOOKS.map((b) => b[0]);

function bookQuestion(v) {
  const distractors = pickDistinct(BOOK_NAMES, 3, v.bookName);
  if (distractors.length < 3) return null;
  const { options, correct_index } = shuffleWithAnswer(v.bookName, distractors);
  return {
    prompt: `Which book of the Bible contains this verse?\n\n"${v.text}"`,
    options,
    correct_index,
    reference: v.reference,
    explanation: `This verse is ${v.reference} (KJV).`,
    difficulty: "medium",
    source: "generated",
  };
}

function blankQuestion(v, kjv) {
  const words = v.text.split(/\s+/);
  const candidates = words
    .map((w, i) => ({ w: w.replace(/[^A-Za-z']/g, ""), i }))
    .filter((x) => x.w.length >= 5);
  if (!candidates.length) return null;
  const chosen = candidates[rand(candidates.length)];
  const answer = chosen.w;
  const masked = words
    .map((w, i) => (i === chosen.i ? w.replace(answer, "______") : w))
    .join(" ");

  // Pull distractor words from other random verses
  const pool = [];
  for (let i = 0; i < 12 && pool.length < 12; i++) {
    const other = randomVerse(kjv);
    if (!other) continue;
    other.text
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-z']/g, ""))
      .filter((w) => w.length >= 5 && w.toLowerCase() !== answer.toLowerCase())
      .forEach((w) => pool.push(w));
  }
  const distractors = pickDistinct(pool, 3, answer);
  if (distractors.length < 3) return null;
  const { options, correct_index } = shuffleWithAnswer(answer, distractors);
  return {
    prompt: `Complete the verse (${v.reference}):\n\n"${masked}"`,
    options,
    correct_index,
    reference: v.reference,
    explanation: `${v.reference} — "${v.text}"`,
    difficulty: "easy",
    source: "generated",
  };
}

function chapterQuestion(v) {
  const answer = `${v.bookName} ${v.chapter}`;
  const pool = [];
  for (let i = 1; i <= 8; i++) {
    pool.push(`${v.bookName} ${Math.max(1, v.chapter + i)}`);
    if (v.chapter - i >= 1) pool.push(`${v.bookName} ${v.chapter - i}`);
  }
  const distractors = pickDistinct(pool, 3, answer);
  if (distractors.length < 3) return null;
  const { options, correct_index } = shuffleWithAnswer(answer, distractors);
  return {
    prompt: `In which chapter of ${v.bookName} do we read:\n\n"${v.text}"`,
    options,
    correct_index,
    reference: v.reference,
    explanation: `This verse is ${v.reference} (KJV).`,
    difficulty: "hard",
    source: "generated",
  };
}

/**
 * Generate `count` trivia questions from the KJV text.
 */
export async function generateTriviaQuestions(count = 10) {
  const kjv = await getKjv();
  const builders = [bookQuestion, blankQuestion, chapterQuestion];
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard += 1;
    const v = randomVerse(kjv);
    if (!v) continue;
    const builder = builders[rand(builders.length)];
    const q = builder === blankQuestion ? blankQuestion(v, kjv) : builder(v);
    if (!q) continue;
    if (out.some((existing) => existing.prompt === q.prompt)) continue;
    out.push(q);
  }
  return out;
}
