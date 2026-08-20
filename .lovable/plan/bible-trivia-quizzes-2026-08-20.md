# Bible Trivia & Quizzes

A daily and weekly scripture quiz game for members, teens and preteens, with scores, streaks and a church leaderboard.

## How it works

- **Daily quiz**: 5 quick questions, released each day, one attempt per player per day.
- **Weekly challenge**: 15 questions, released every Monday, open until Sunday night, one attempt per player.
- **Question pool**: mix of admin-written questions and questions auto-built from the built-in KJV Bible text already bundled in the app (fill-in-the-blank verse, "which book is this verse from?", "complete the verse", chapter/verse lookup).
- **Scoring**: 10 points per correct answer, plus a small speed bonus. Streak increases for each consecutive day a player completes the daily quiz; missing a day resets it.
- **Leaderboard**: church-scoped, with All-time / This month / This week tabs, plus separate Adults and Youth boards so teens and preteens compete fairly.
- **Youth play**: teens and preteens play from the My Family area using their existing profile; parents see their child's scores. No public exposure of children's data beyond first name and initial.
- **Admin**: a Trivia admin tab to write questions, review/enable auto-generated ones, set difficulty, schedule the daily/weekly sets, and view participation reports.
- **Module toggle**: "Bible Trivia" added to the tenant module list so each church can turn it on or off.

## Screens

1. `/trivia` — Today's quiz card, weekly challenge card, my streak and score, leaderboard.
2. Quiz player — one question at a time, instant feedback with the verse reference, result summary at the end.
3. Admin tab (inside Settings/Management) — question bank, generator controls, schedule, participation report.
4. Dashboard widget — "Today's Bible Trivia" prompt with streak badge.

## Technical notes

New tenant-scoped tables (each created with GRANTs, RLS enabled and policies):

- `trivia_questions` — prompt, options, correct answer, reference, difficulty, source (`admin` | `generated`), active flag, `session`-independent, `tenant_id`.
- `trivia_quizzes` — one row per scheduled quiz: `kind` (`daily` | `weekly`), `starts_on`, `ends_on`, `audience` (`adult` | `youth` | `all`), `tenant_id`.
- `trivia_quiz_questions` — join table ordering questions inside a quiz.
- `trivia_attempts` — player (`member_id` or `teen_id`/`preteen_id`), quiz, score, correct count, duration, `completed_at`; unique per player per quiz.
- `trivia_answers` — per-question response, correctness computed server-side.
- `trivia_streaks` — current streak, longest streak, last played date, total points per player.

Security and correctness:

- Correct answers are never sent to the client. Questions are served through a `get_trivia_quiz_safe` SECURITY DEFINER RPC that strips answer keys; grading happens in a `submit_trivia_attempt` RPC that also updates streaks and totals atomically.
- Youth play is authorised by verifying the signed-in user is the registered guardian of that teen/preteen.
- All queries carry explicit `.eq("tenant_id", tenantId)` guards; leaderboards are tenant-scoped only.
- Question generation reuses `src/lib/bible/refs.js` and the bundled `kjv.json`, run client-side by an admin into the question bank (no external API).
- Attempts, question edits and quiz scheduling flow through the existing audit trigger; personal answer text is not logged.
- In-app notifications only (existing notification system) for "new weekly challenge" and "streak about to break". No SMS/email.

## Out of scope for this first build

Verse memorisation, reading streaks and sermon-note scavenger hunts — separate features that can reuse the same points/streak tables later.
