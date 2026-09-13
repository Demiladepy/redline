/** Load published 15-clip corpus counts from disk. No invented numbers. */

export async function loadCorpusStats() {
  const [rowsRes, manifestRes] = await Promise.all([
    fetch('/corpus-results-15.json'),
    fetch('/corpus-manifest.json'),
  ]);
  if (!rowsRes.ok) {
    throw new Error('corpus-results-15.json not found');
  }
  const rows = await rowsRes.json();
  const manifest = manifestRes.ok ? await manifestRes.json() : {};
  const counts = { total: rows.length, high: 0, medium: 0, clean: 0, none: 0 };
  for (const row of rows) {
    const v = row.verdict ?? 'none';
    if (v in counts) counts[v] += 1;
    else counts.clean += 0;
  }
  return { rows, manifest, counts };
}

export function applyMetricCards(counts, ids) {
  const { total, high, medium, clean } = counts;
  if (ids.total) ids.total.textContent = String(total);
  if (ids.high) ids.high.textContent = String(high);
  if (ids.medium) ids.medium.textContent = String(medium);
  if (ids.clean) ids.clean.textContent = String(clean);
}
