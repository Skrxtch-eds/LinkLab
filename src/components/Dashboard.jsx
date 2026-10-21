import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dailyActivity, dayKey, num } from '../statistics';
import { Breakdown, Icon } from './UI';

function Metric({ label, icon, value, note, children }) {
  return <article className="metric"><div className="metric-label">{label}<Icon name={icon}/></div><strong>{value}</strong><div className="metric-note">{note}</div>{children}</article>;
}

export function Metrics({ data, loading }) {
  const ok = data.visits.filter(v => v.outcome === 'ok');
  const active = data.links.filter(l => l.status === 'active').length;
  const activity = dailyActivity(data.visits,7);
  const value = n => loading ? '—' : num(n);
  return <section className="metrics" aria-label="Общая статистика">
    <Metric label="Всего переходов" icon="click" value={value(data.links.reduce((s,l) => s+l.clicks,0))} note={<><span className="mini-dot blue"/>Сегодня: {value(ok.filter(v => dayKey(v.at) === dayKey(new Date())).length)}</>}>
      <div className="metric-mini" aria-hidden="true"><BarChart width={70} height={36} data={activity}><Bar dataKey="count" fill="#457be5" radius={[2,2,0,0]}/></BarChart></div>
    </Metric>
    <Metric label="Активные ссылки" icon="link" value={<>{value(active)}<span className="metric-denom"> / {loading?'—':num(data.links.length)}</span></>} note={<><span className="mini-dot green"/>Готовы к переходам</>}>
      <div className="metric-ring" aria-hidden="true"><PieChart width={46} height={46}><Pie data={[{value:active},{value:Math.max(0,data.links.length-active) || (active ? 0:1)}]} dataKey="value" innerRadius={16} outerRadius={19} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}><Cell fill="#5bceab"/><Cell fill="#24344d"/></Pie></PieChart></div>
    </Metric>
    <Metric label="Уникальные браузеры" icon="users" value={value(data.unique)} note={<>По анонимным cookies <span className="info-hint" title="Один браузер с сохранённой cookie считается один раз. Это не точное число людей.">i</span></>}/>
    <Metric label="Заблокировано переходов" icon="clock" value={value(data.visits.length-ok.length)} note="Срок, лимит или пауза"/>
  </section>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><span>{label}</span><strong>{num(payload[0].value)} переходов</strong></div>;
}

export function Analytics({ visits }) {
  const [days,setDays] = useState(7);
  const points = useMemo(() => dailyActivity(visits,days),[visits,days]);
  const ok = visits.filter(v => v.outcome === 'ok');
  const total = points.reduce((sum,p) => sum+p.count,0);
  const max = Math.max(4,Math.ceil(Math.max(...points.map(p => p.count))/4)*4);
  return <section className="analytics-grid" id="analytics-section">
    <article className="panel chart-panel"><div className="panel-heading"><div><h2>Активность переходов</h2><p>Как работают ваши ссылки</p></div><div className="segmented" aria-label="Период графика">{[7,30].map(n => <button key={n} className={days===n?'selected':''} aria-pressed={days===n} onClick={() => setDays(n)}>{n} дней</button>)}</div></div>
      <div className="chart-topline"><strong>{num(total)}</strong><span>переходов за период</span><div className="chart-legend"><span className="mini-dot blue"/>Переходы</div></div>
      <div className="chart" role="img" aria-label={`${num(total)} переходов за ${days} дней`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={points} margin={{top:26,right:15,left:0,bottom:0}} accessibilityLayer>
            <CartesianGrid stroke="#26354e" strokeDasharray="3 6" vertical={false}/>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'#586e90',fontSize:10}} minTickGap={16} tickMargin={9} height={29}/>
            <YAxis domain={[0,max]} ticks={[0,max/4,max/2,max*3/4,max]} tickLine={false} axisLine={false} tick={{fill:'#586e90',fontSize:10}} width={29} tickFormatter={num}/>
            <Tooltip content={<ChartTooltip/>} cursor={{stroke:'#426292',strokeDasharray:'3 4'}}/>
            <Area type="linear" dataKey="count" stroke="#639cff" strokeWidth={2.5} fill="#4f8cff" fillOpacity={.10} isAnimationActive={false} dot={days===7?{r:2.5,fill:'#0e1729',stroke:'#71a7ff',strokeWidth:1.7}:false} activeDot={{r:4}}/>
          </AreaChart>
        </ResponsiveContainer>
        {!total && <div className="chart-empty">Здесь начнётся ваша история переходов<span>Создайте ссылку и откройте её</span></div>}
      </div>
    </article>
    <article className="panel sources-panel"><div className="panel-heading"><div><h2>Источники трафика</h2><p>Откуда приходят посетители</p></div><span className="panel-symbol"><Icon name="arrow"/></span></div><div className="sources">{ok.length ? <Breakdown visits={ok} field="referrer" max={3}/> : <div className="sources-empty"><Icon name="arrow"/><span>Источники появятся<br/>после первых переходов</span></div>}</div><div className="panel-footnote"><span className="mini-dot blue"/>По данным заголовка Referer</div></article>
  </section>;
}

export function Audience({ visits }) {
  const ok = visits.filter(v => v.outcome === 'ok');
  return <section className="panel detail-analytics"><div className="panel-heading"><div><h2>Аудитория и устройства</h2><p>Успешные переходы за всё время</p></div></div><div className="breakdown-grid"><div><h3>Устройства</h3><Breakdown visits={ok} field="device"/></div><div><h3>Браузеры</h3><Breakdown visits={ok} field="browser"/></div></div></section>;
}
