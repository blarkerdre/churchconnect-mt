import React from "react";

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th" */
export function ordinal(n) {
  if (n == null || !isFinite(n)) return "—";
  const i = Math.round(n);
  const mod100 = i % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${i}th`;
  switch (i % 10) {
    case 1: return `${i}st`;
    case 2: return `${i}nd`;
    case 3: return `${i}rd`;
    default: return `${i}th`;
  }
}

/** Medal-style tint for the top three positions */
export function positionCls(pos) {
  if (pos === 1) return "bg-amber-100 text-amber-900 border border-amber-300";
  if (pos === 2) return "bg-slate-200 text-slate-800 border border-slate-300";
  if (pos === 3) return "bg-orange-100 text-orange-900 border border-orange-300";
  return "bg-muted text-muted-foreground";
}

export function PositionBadge({ pos }) {
  if (!pos) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${positionCls(pos)}`}>
      {ordinal(pos)}
    </span>
  );
}

/**
 * Dense-style ranking where ties share a position and the next distinct
 * value skips ahead (1, 2, 2, 4).
 * @param {Array} items
 * @param {(item:any)=>string} getKey - unique id for the item
 * @param {(item:any)=>number|null} getValue - value to rank on (null = unranked)
 * @param {"asc"|"desc"} direction - "asc" ranks smallest first
 * @returns {Map<string, number>}
 */
export function buildRankMap(items, getKey, getValue, direction = "desc") {
  const ranked = items
    .map((it) => ({ key: getKey(it), value: getValue(it) }))
    .filter((x) => x.key != null && x.value != null && isFinite(x.value));

  ranked.sort((a, b) => (direction === "asc" ? a.value - b.value : b.value - a.value));

  const map = new Map();
  let pos = 0;
  let prev = null;
  ranked.forEach((x, idx) => {
    if (prev === null || x.value !== prev) { pos = idx + 1; prev = x.value; }
    map.set(x.key, pos);
  });
  return map;
}
