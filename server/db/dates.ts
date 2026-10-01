// Returns Mon-Fri ISO dates between start and end (inclusive), skipping past dates.
export function getWeekdaysBetween(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startStr);
  const end = new Date(endStr);
  const todayStr = new Date().toISOString().slice(0, 10);

  while (cur <= end) {
    const day = cur.getUTCDay();
    const isoStr = cur.toISOString().slice(0, 10);
    if (day >= 1 && day <= 5 && isoStr >= todayStr) {
      dates.push(isoStr);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}
