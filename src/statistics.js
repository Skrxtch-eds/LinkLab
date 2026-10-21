export const EMPTY_DATA = { projects: [], links: [], visits: [], unique: 0 };
export const STATUS = { active: 'Активна', paused: 'На паузе', expired: 'Срок истёк', limit: 'Лимит исчерпан' };
export const num = value => new Intl.NumberFormat('ru-RU').format(value);
export const date = (value, options = {}) => new Date(value).toLocaleDateString('ru-RU', { day:'numeric', month:'short', ...options });
export const time = value => new Date(value).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
export const shortURL = link => `${location.origin}/${link.code}`;
export function dayKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function dailyActivity(visits, days, currentDate = new Date()) {
  const dates = Array.from({length:days}, (_, index) => {
    const d = new Date(currentDate);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()-days+1+index);
    return { key:dayKey(d), label:date(d), count:0 };
  });
  const byDay = new Map(dates.map(d => [d.key,d]));
  for (const visit of visits) {
    if (visit.outcome !== 'ok') continue;
    const bucket = byDay.get(dayKey(visit.at));
    if (bucket) bucket.count++;
  }
  return dates;
}
export function groupVisits(visits, key, max = 5) {
  const counts = new Map();
  for (const visit of visits) counts.set(visit[key],(counts.get(visit[key]) || 0)+1);
  return [...counts].sort((a,b) => b[1]-a[1]).slice(0,max).map(([label,count]) => ({label,count,percent:count/visits.length*100}));
}
export function filterLinks(links, query, status, sort) {
  const search = query.trim().toLowerCase();
  return links.filter(link => (status === 'all' || link.status === status) && `${link.title} ${link.url} ${link.code}`.toLowerCase().includes(search))
    .sort((a,b) => sort === 'clicks' ? b.clicks-a.clicks || b.id-a.id : sort === 'old' ? a.id-b.id : b.id-a.id);
}
export function localDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
