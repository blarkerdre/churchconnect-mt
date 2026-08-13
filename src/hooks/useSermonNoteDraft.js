import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "sermon-draft:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEBOUNCE_MS = 1500;

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function draftKey(userId, noteId) {
  return `${PREFIX}${userId || "anon"}:${noteId || "new"}`;
}

/** Drop drafts older than 30 days so localStorage never grows unbounded. */
export function pruneSermonDrafts() {
  if (typeof localStorage === "undefined") return;
  const now = Date.now();
  const stale = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const parsed = safeParse(localStorage.getItem(key));
    const ts = parsed?.updatedAt ? Date.parse(parsed.updatedAt) : 0;
    if (!ts || now - ts > MAX_AGE_MS) stale.push(key);
  }
  stale.forEach((k) => localStorage.removeItem(k));
}

export function readSermonDraft(userId, noteId) {
  if (typeof localStorage === "undefined") return null;
  return safeParse(localStorage.getItem(draftKey(userId, noteId)));
}

export function clearSermonDraft(userId, noteId) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(draftKey(userId, noteId));
}

/**
 * Debounced local autosave for the sermon note form.
 *
 * - `values` is the current form state; it is written ~1.5s after typing stops.
 * - `flush()` writes immediately (used on dialog close / page unload).
 * - `pendingDraft` holds a stored draft that is newer than the saved note,
 *   for the caller to offer as "Restore draft".
 */
export default function useSermonNoteDraft({ userId, noteId, note, open, values, enabled = true }) {
  const [status, setStatus] = useState("idle"); // idle | saving | saved
  const [savedAt, setSavedAt] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const valuesRef = useRef(values);
  const timerRef = useRef(null);
  const dirtyRef = useRef(false);

  valuesRef.current = values;

  const write = useCallback(() => {
    if (!enabled || typeof localStorage === "undefined") return;
    const v = valuesRef.current || {};
    const stripped = String(v.content || "").replace(/<[^>]*>/g, "").trim();
    const hasAnything = stripped || String(v.title || "").trim();
    const key = draftKey(userId, noteId);
    if (!hasAnything) {
      localStorage.removeItem(key);
      return;
    }
    const payload = { ...v, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      setSavedAt(payload.updatedAt);
      setStatus("saved");
    } catch {
      /* quota exceeded — drafts are best-effort */
    }
  }, [enabled, userId, noteId]);

  // Look for an existing draft each time the dialog opens.
  useEffect(() => {
    if (!open || !enabled) return;
    pruneSermonDrafts();
    dirtyRef.current = false;
    setStatus("idle");
    setSavedAt(null);
    const existing = readSermonDraft(userId, noteId);
    if (!existing) {
      setPendingDraft(null);
      return;
    }
    const draftTs = Date.parse(existing.updatedAt || 0) || 0;
    const noteTs = note?.updated_at ? Date.parse(note.updated_at) : 0;
    const sameContent = (existing.content || "") === (note?.content || "");
    if (sameContent || (noteTs && draftTs <= noteTs)) {
      clearSermonDraft(userId, noteId);
      setPendingDraft(null);
      return;
    }
    setPendingDraft(existing);
  }, [open, enabled, userId, noteId, note]);

  // Debounced autosave whenever the form values change.
  useEffect(() => {
    if (!open || !enabled) return undefined;
    if (!dirtyRef.current) {
      // Skip the initial hydration pass.
      dirtyRef.current = true;
      return undefined;
    }
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(write, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, enabled, write, values]);

  // Persist on tab close / refresh.
  useEffect(() => {
    if (!open || !enabled) return undefined;
    const handler = () => write();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, enabled, write]);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    write();
  }, [write]);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearSermonDraft(userId, noteId);
    setPendingDraft(null);
    setStatus("idle");
    setSavedAt(null);
  }, [userId, noteId]);

  const dismissPending = useCallback(() => {
    clearSermonDraft(userId, noteId);
    setPendingDraft(null);
  }, [userId, noteId]);

  return { status, savedAt, pendingDraft, flush, clear, dismissPending };
}
