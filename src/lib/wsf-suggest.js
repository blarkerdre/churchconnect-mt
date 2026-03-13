/**
 * Score WSF centres by proximity to a member's address/postcode.
 * Uses coverage_postcodes, postcode, address, city, and location fields.
 * Returns the best matching centre or null.
 */
export function suggestClosestWSFCentre(centres, { postcode, address, city }) {
  if (!centres?.length) return null;

  const memberPostcode = (postcode || "").trim().toUpperCase();
  const memberPrefix = memberPostcode.split(" ")[0]; // e.g. "CF10"
  const memberArea = `${postcode || ""} ${address || ""} ${city || ""}`.toLowerCase();

  const scored = centres.map(c => {
    let score = 0;

    // 1. Check coverage_postcodes (highest priority - explicit coverage area)
    if (c.coverage_postcodes && memberPrefix) {
      const coveragePrefixes = c.coverage_postcodes.split(",").map(p => p.trim().toUpperCase());
      if (coveragePrefixes.includes(memberPrefix)) score += 20;
      // Partial match (e.g. member CF10, coverage CF1)
      if (coveragePrefixes.some(cp => memberPrefix.startsWith(cp) || cp.startsWith(memberPrefix))) {
        score += 12;
      }
    }

    // 2. Exact postcode match
    if (c.postcode && memberPostcode) {
      const centrePostcode = c.postcode.trim().toUpperCase();
      if (centrePostcode === memberPostcode) score += 15;
      else if (centrePostcode.split(" ")[0] === memberPrefix) score += 10;
    }

    // 3. City match
    if (c.city && city && c.city.toLowerCase() === city.toLowerCase()) score += 5;

    // 4. Address word matching
    const centreText = `${c.address || ""} ${c.location || ""} ${c.postcode || ""} ${c.city || ""}`.toLowerCase();
    if (memberPrefix && centreText.includes(memberPrefix.toLowerCase())) score += 8;
    const words = memberArea.split(/\s+/).filter(w => w.length > 2);
    words.forEach(w => { if (centreText.includes(w)) score += 2; });

    return { ...c, score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0] : null;
}
