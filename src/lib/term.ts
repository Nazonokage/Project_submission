/** Philippine-style academic calendar: June–Oct 1st sem, Nov–Mar 2nd, Apr–May summer. */
export function defaultAcademicTerm(now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  const start = month >= 5 ? year : year - 1;
  const end = start + 1;
  let sem = 'Summer';
  if (month >= 5 && month <= 9) sem = '1st Sem';
  else if (month >= 10 || month <= 2) sem = '2nd Sem';
  return `AY ${start}-${end}, ${sem}`;
}

export function termPresets(now = new Date()) {
  const year = now.getFullYear();
  const start = now.getMonth() >= 5 ? year : year - 1;
  const options: string[] = [];
  for (const ayStart of [start, start - 1, start + 1]) {
    options.push(`AY ${ayStart}-${ayStart + 1}, 1st Sem`);
    options.push(`AY ${ayStart}-${ayStart + 1}, 2nd Sem`);
    options.push(`AY ${ayStart}-${ayStart + 1}, Summer`);
  }
  const current = defaultAcademicTerm(now);
  return [current, ...options.filter((t) => t !== current)];
}
