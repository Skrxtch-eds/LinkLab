import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dailyActivity, num, shortURL } from '../statistics';
import { Icon, IconButton, Badge } from './UI';

function remaining(expiresAt) {
  if (!expiresAt) return 'Без срока';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Истёк';
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days} дн.`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours} ч.`;
  return `${Math.max(1, Math.floor(diff / 60000))} мин.`;
}

function ProjectCard({ project, onOpen }) {
  const hue = ((project.id - 1) * 137.508) % 360;
  return <button className="project-card" style={{'--planet-hue':`${hue}deg`}} onClick={onOpen}>
    <span className="project-card-top"><span>PROJECT / {String(project.id).padStart(3,'0')}</span><Icon name="arrow"/></span>
    <span className="project-art"><img src="/assets/project-planet.png" alt=""/><span className="art-label">LINKS IN ORBIT</span></span>
    <span className="project-card-title">{project.name}</span>
    <span className="project-card-description">{project.description || 'У проекта пока нет описания.'}</span>
    <span className="project-stats"><span><b>{num(project.link_count)}</b> ССЫЛОК</span><span><b>{num(project.clicks)}</b> ПЕРЕХОДОВ</span><span><b>{num(project.active_count)}</b> АКТИВНЫХ ССЫЛОК</span></span>
    <span className="project-card-foot"><span><i className="live-dot"/>PROJECT SPACE</span><span>ОТКРЫТЬ <Icon name="arrow"/></span></span>
  </button>;
}

function ProjectLinkCard({ link, onEdit, onStats, onToggle, onDelete, onCopy, pending }) {
  const left = link.max_clicks == null ? '∞' : Math.max(0, link.max_clicks - link.clicks);
  return <article className={`project-link-card ${link.status}`}>
    <div className="link-card-top"><span className="link-type"><Icon name="link"/> SHORT LINK / {link.id}</span><Badge status={link.status}/></div>
    <h3>{link.title}</h3>
    <p className="link-card-description">{link.description || link.url}</p>
    <a className="link-card-url" href={shortURL(link)} target="_blank" rel="noreferrer">/{link.code}<Icon name="arrow"/></a>
    <div className="link-card-stats"><div><b>{num(link.clicks)}</b><span>ПЕРЕХОДЫ</span></div><div><b>{typeof left==='number'?num(left):left}</b><span>ОСТАЛОСЬ</span></div><div><b>{remaining(link.expires_at)}</b><span>ДО ЗАВЕРШЕНИЯ</span></div></div>
    <div className="link-card-actions"><button onClick={() => onCopy(shortURL(link))}><Icon name="copy"/>Копировать</button><button onClick={() => onStats(link.id)}><Icon name="chart"/>Статистика</button><IconButton name="edit" label="Изменить ссылку" onClick={() => onEdit(link)}/><IconButton name={link.enabled?'pause':'play'} label={link.enabled?'Приостановить':'Включить'} disabled={pending===link.id} onClick={() => onToggle(link)}/><IconButton name="trash" className="delete" label="Удалить ссылку" onClick={() => onDelete(link)}/></div>
  </article>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><span>{label}</span><strong>{num(payload[0].value)} переходов</strong></div>;
}

export default function ProjectSpace({ projects, links, visits, projectId, onProjectChange, onCreateProject, onCreateLink, onEdit, onStats, onToggle, onDelete, onCopy, pending, isLoading }) {
  const project = projects.find(item => item.id === projectId);
  const scopedLinks = useMemo(() => links.filter(link => link.project_id === projectId),[links,projectId]);
  const scopedVisits = useMemo(() => visits.filter(visit => visit.project_id === projectId),[visits,projectId]);
  const points = useMemo(() => dailyActivity(scopedVisits,30),[scopedVisits]);
  const clicks30 = points.reduce((sum,item) => sum + item.count,0);

  if (project) return <div className="project-view" key={project.id} style={{'--planet-hue':`${((project.id - 1) * 137.508) % 360}deg`}}>
    <div className="project-toolbar"><button className="back-link" onClick={() => onProjectChange(null)}><Icon name="arrow"/>ВСЕ ПРОЕКТЫ</button><span>PROJECT / {String(project.id).padStart(3,'0')}</span></div>
    <section className="project-hero"><div className="project-hero-art"><img src="/assets/project-planet.png" alt=""/><span className="scan-ring scan-one"/><span className="scan-ring scan-two"/><span className="crosshair">+</span></div><div className="project-hero-copy"><p className="pixel-eyebrow"><i className="live-dot"/> PROJECT SPACE / ACTIVE</p><h1>{project.name}</h1><p>{project.description || 'Соберите ссылки проекта в одном месте.'}</p><div className="project-hero-meta"><span>CREATED {new Date(project.created_at).toLocaleDateString('ru-RU')}</span><span>ID {String(project.id).padStart(4,'0')}</span></div></div></section>
    <div className="folder-create-band"><span>SHORT LINKS / READY TO DEPLOY</span><button className="create-project-button" onClick={onCreateLink}><span>+</span>Создать ссылку<Icon name="arrow"/></button><span>PROJECT {String(project.id).padStart(3,'0')}</span></div>
    <div className="project-kpis"><div><span>ВСЕ ПЕРЕХОДЫ</span><b>{num(project.clicks)}</b><small>по ссылкам этого проекта</small></div><div><span>АКТИВНЫЕ ССЫЛКИ</span><b>{num(project.active_count)}<em> / {num(project.link_count)}</em></b><small>готовы к переходам</small></div></div>
    <section className="traffic-section"><div className="section-topline"><div><p className="pixel-eyebrow">SIGNAL / LAST 30 DAYS</p><h2>Трафик проекта</h2></div><span className="chart-total"><b>{num(clicks30)}</b> ВСЕГО</span></div><div className="project-chart" role="img" aria-label={`${num(clicks30)} переходов по проекту за последние 30 дней`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:20,right:10,left:0,bottom:0}}><defs><linearGradient id="projectFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b9ff4a" stopOpacity={.27}/><stop offset="100%" stopColor="#b9ff4a" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#243129" strokeDasharray="2 7" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'#758b6b',fontSize:10}} minTickGap={28}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{fill:'#758b6b',fontSize:10}} width={32}/><Tooltip content={<ChartTooltip/>} cursor={{stroke:'#b9ff4a',strokeDasharray:'4 4'}}/><Area type="monotone" dataKey="count" stroke="#c1ff59" strokeWidth={2} fill="url(#projectFill)" isAnimationActive animationDuration={1000} activeDot={{r:4,fill:'#c1ff59',stroke:'#0a0c0b',strokeWidth:2}}/></AreaChart></ResponsiveContainer>{clicks30===0&&<div className="chart-empty pixel-chart-empty">NO SIGNAL YET<span>Переходы появятся после открытия ссылки</span></div>}</div></section>
    <section className="link-inventory"><div className="section-topline"><div><p className="pixel-eyebrow">ENDPOINTS / {String(scopedLinks.length).padStart(2,'0')}</p><h2>Ссылки проекта</h2></div></div>
      {scopedLinks.length ? <div className="project-link-grid">{scopedLinks.map(link => <ProjectLinkCard key={link.id} link={link} onEdit={onEdit} onStats={onStats} onToggle={onToggle} onDelete={onDelete} onCopy={onCopy} pending={pending}/>)}</div> : <div className="project-empty"><div className="empty-terminal"><span>LINKLAB://PROJECT/{project.id}</span><strong>_</strong></div><div><p className="pixel-eyebrow">EMPTY DIRECTORY</p><h3>В этой папке пока нет ссылок</h3><p>Создайте ссылку, задайте адрес, срок действия и лимит переходов.</p></div></div>}
    </section>
  </div>;

  return <div className="projects-home">
    <header className="project-home-header"><div className="brand-lockup"><img src="/assets/project-planet.png" alt=""/><span>Link<span>Lab</span><i>.</i></span></div><div className="system-readout"><span><i className="live-dot"/>LOCAL SYSTEM / ONLINE</span><span>BUILD 02.26</span></div></header>
    <div className="project-create-wrap"><span className="create-cross cross-left">+</span><button className="create-project-button" onClick={onCreateProject}><span>+</span>Создать папку проекта<Icon name="arrow"/></button><span className="create-cross cross-right">+</span></div>
    <section className="projects-section"><div className="section-topline"><div><p className="pixel-eyebrow">DIRECTORY / {String(projects.length).padStart(2,'0')}</p><h2>Папки проектов</h2></div></div>
      {projects.length ? <div className="project-grid">{projects.map(project=><ProjectCard key={project.id} project={project} onOpen={()=>onProjectChange(project.id)}/>)}</div> : <div className="projects-empty"><div className="globe-thumb"><img src="/assets/project-planet.png" alt=""/></div><p className="pixel-eyebrow">NO PROJECTS FOUND</p><h3>{isLoading?'Загружаем пространство…':'Создайте первую папку'}</h3><p>Проект объединит ссылки и покажет переходы по ним за последние 30 дней.</p></div>}
    </section>
  </div>;
}
