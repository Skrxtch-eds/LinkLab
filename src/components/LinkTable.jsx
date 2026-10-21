import { useMemo, useState } from 'react';
import { date, filterLinks, num, shortURL, STATUS, time } from '../statistics';
import { Badge, Icon, IconButton } from './UI';

export default function LinkTable({ links, loading, onEdit, onStats, onToggle, onDelete, onCopy, pending }) {
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('all');
  const [sort,setSort] = useState('new');
  const visible = useMemo(() => filterLinks(links,query,filter,sort),[links,query,filter,sort]);
  return <section className="panel links-panel" id="links-section">
    <div className="links-heading"><div className="links-title"><h2>Мои ссылки</h2><span className="count-badge">{num(links.length)}</span></div><a className="button subtle export-button" href="/api/export" download><Icon name="download"/>Экспорт CSV</a></div>
    <div className="table-toolbar"><div className="search-box"><Icon name="search"/><label className="sr-only" htmlFor="search">Поиск ссылок</label><input id="search" placeholder="Поиск по названию или адресу…" type="search" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <div className="filter-box"><label className="sr-only" htmlFor="status-filter">Статус</label><select id="status-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Все статусы</option>{Object.entries(STATUS).map(([value,label]) => <option key={value} value={value}>{value==='active'?'Активные':label}</option>)}</select></div>
      <label className="sr-only" htmlFor="sort">Сортировка</label><select id="sort" className="sort-select" value={sort} onChange={e => setSort(e.target.value)}><option value="new">Сначала новые</option><option value="clicks">По переходам</option><option value="old">Сначала старые</option></select>
    </div>
    <div className="table-scroll"><table><thead><tr><th>ССЫЛКА</th><th>СТАТУС</th><th>ПЕРЕХОДЫ</th><th>СРОК ДЕЙСТВИЯ</th><th className="actions-th">ДЕЙСТВИЯ</th></tr></thead><tbody>{visible.map(link => <tr key={link.id}>
      <td><div className="link-cell"><div className="link-avatar"><Icon name="link"/></div><div className="link-text"><button className="link-name text-button" onClick={() => onStats(link.id)} title={`${link.title} — статистика`}>{link.title}</button><div className="link-short"><a href={`/${link.code}`} target="_blank" rel="noopener" title="Открыть короткую ссылку: переход будет засчитан">{location.host}/{link.code}</a><button type="button" className="inline-copy" onClick={() => onCopy(shortURL(link))} title="Копировать ссылку" aria-label={`Копировать ссылку ${link.title}`}><Icon name="copy"/></button></div><span className="link-original" title={link.url}>{link.url}</span></div></div></td>
      <td><Badge status={link.status}/></td><td className="clicks-cell"><span className="clicks-number">{num(link.clicks)}{link.max_clicks!==null && <small> / {num(link.max_clicks)}</small>}</span>{link.max_clicks!==null && <div className="limit-progress"><span style={{width:`${Math.min(100,link.clicks/link.max_clicks*100)}%`}}/></div>}</td>
      <td className="date-cell">{link.expires_at?date(link.expires_at,{year:'numeric'}):'Бессрочно'}<small>{link.expires_at?`до ${time(link.expires_at)}`:`Создана ${date(link.created_at)}`}</small></td>
      <td><div className="row-actions"><IconButton name="chart" label={`Статистика ${link.title}`} onClick={() => onStats(link.id)}/><IconButton name="edit" label={`Редактировать ${link.title}`} onClick={() => onEdit(link)}/><IconButton name={link.enabled?'pause':'play'} label={`${link.enabled?'Приостановить':'Возобновить'} ${link.title}`} disabled={pending===link.id} onClick={() => onToggle(link)}/><IconButton name="trash" label={`Удалить ${link.title}`} className="delete" onClick={() => onDelete(link)}/></div></td>
    </tr>)}</tbody></table></div>
    {loading && <div className="empty-state loading-state" role="status"><Icon name="clock"/><h3>Загружаем ссылки…</h3></div>}
    {!loading && !links.length && <div className="empty-state"><img className="empty-image" src="/assets/link-empty.png" alt="" width="76" height="60"/><h3>Большие возможности начинаются с короткой ссылки</h3><p>Добавьте первый адрес. Все его переходы и настройки будут здесь.</p></div>}
    {!!links.length && !visible.length && <div className="empty-state small-empty"><Icon name="search"/><h3>Ничего не нашлось</h3><p>Попробуйте другой запрос или измените фильтр.</p><button className="button subtle" onClick={() => {setQuery('');setFilter('all');}}>Сбросить фильтры</button></div>}
    <footer className="table-footer"><span>{loading?'Загрузка…':links.length?`Показано ${num(visible.length)} из ${num(links.length)}`:'Пока нет ссылок'}</span><span><span className="status-dot"/>Сохраняется автоматически</span></footer>
  </section>;
}
