/**
 * Score WSF centres by proximity to a member's address/postcode.
 * Returns sorted array of centres with scores > 0, best match first.
 */
export function suggestClosestWSFCentre(centres, { postcode, address, city }) {
  if (!centres?.length) return null;
  const postcodePrefix = (postcode || "").trim().split(" ")[0]?.toLowerCase();
  const memberArea = `${postcode || ""} ${address || ""} ${city || ""}`.toLowerCase();

  const scored = centres.map(c => {
    const loc = (c.location || "").toLowerCase();
    let score = 0;
    if (postcodePrefix && loc.includes(postcodePrefix)) score += 10;
    if (postcode && loc.includes(postcode.toLowerCase())) score += 8;
    if (city && loc.includes(city.toLowerCase())) score += 5;
    const words = memberArea.split(/\s+/).filter(w => w.length > 2);
    words.forEach(w => { if (loc.includes(w)) score += 2; });
    return { ...c, score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0] : null;
}
