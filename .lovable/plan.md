## Why "Mathew 6:33" doesn't hyperlink

The Bible reference detector only recognizes a book if its lowercased, space/dot-stripped form matches the canonical name or one of the explicit aliases in `src/lib/bible/refs.js`. Matthew's aliases are `matt`, `mt`, `mat` — none of which cover the common misspelling **"Mathew"** (single `t`). So `parseReference` returns `null`, the Tiptap input rule doesn't apply the `bibleRef` mark, and the hover popover never triggers.

## Fix

Add common misspellings as extra aliases for the affected books in `BOOKS` inside `src/lib/bible/refs.js`. Proposed additions:

- Matthew → add `mathew`
- Philippians → add `philipians`, `phillipians`, `phillippians`
- Revelation → add `revelations`, `reveleation`, `reveleations`
- Isaiah → add `isiah`, `esaias`
- Ecclesiastes → add `ecclesiastes` variants: `eclesiastes`, `ecclesiaste`
- Deuteronomy → add `deutronomy`, `deuteronomy` variants: `deut`, `duet`
- Nehemiah → add `nehemia`
- Habakkuk → add `habakuk`, `habbakuk`
- Zechariah → add `zecharia`
- Song of Solomon → add `songs` (bare)

Scope: strictly the `BOOKS` alias arrays. No changes to the regex, parser, Tiptap extension, or popover. Existing correctly-spelled references continue to work unchanged.

## Verification

After the change, typing "Mathew 6:33 " (with a trailing space/punctuation) in the sermon editor should:
1. Auto-convert the text into a dotted-underline link.
2. Show the KJV verse in the hover popover.

Same test for the other misspellings above.

## Not in scope

- Fuzzy/Levenshtein matching for arbitrary misspellings (higher complexity, risk of false positives). Can be a follow-up if you want broader tolerance.
- Adding non-KJV translations.
