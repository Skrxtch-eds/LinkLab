import { useState } from 'react';
import { date, num, shortURL, time } from '../statistics';
import { Badge, Breakdown, Icon, IconButton, Modal } from './UI';

export function CreatedDialog({ link, onCopy, onStats, onClose }) {
  return <Modal title="Длинная история. Короткая ссылка." eyebrow="ВСЁ ГОТОВО" description="Копируйте адрес и используйте его для переходов." onClose={onClose} className="created-modal"><div className="created-result"><a href={`/${link.code}`} target="_blank" rel="noopener">{shortURL(link)}</a><IconButton name="copy" label="Копировать созданную ссылку" onClick={() => onCopy(shortURL(link))}/></div><p className="field-hint">Открытие адреса засчитывается как переход. Копирование — нет.</p><div className="modal-footer"><button className="button subtle" onClick={onClose}>Закрыть</button><button className="button secondary" onClick={() => onStats(link.id)} disabled={!link.id}><Icon name="chart"/>Статистика ссылки</button></div></Modal>;
}

export function StatsDialog({ link, visits, onClose }) {
  const all = visits.filter(v => v.link_id === link.id);
  const ok = all.filter(v => v.outcome === 'ok');
  return <Modal title={link.title} eyebrow="АНАЛИТИКА ССЫЛКИ" onClose={onClose} className="stats-modal"><p className="stats-url">{shortURL(link)}</p><div className="stats-metrics"><div><strong>{num(link.clicks)}</strong><span>Успешных переходов</span></div><div><strong>{num(all.length-ok.length)}</strong><span>Заблокировано</span></div></div><div className="breakdown-grid"><div><h3>Устройства</h3><Breakdown visits={ok} field="device"/></div><div><h3>Браузеры</h3><Breakdown visits={ok} field="browser"/></div></div><h3>Последние обращения</h3><div className="table-scroll recent-table"><table><thead><tr><th>ВРЕМЯ</th><th>УСТРОЙСТВО / ИСТОЧНИК</th><th>РЕЗУЛЬТАТ</th></tr></thead><tbody>{all.length ? all.slice(0,20).map((v,i) => <tr key={`${v.at}-${i}`}><td>{date(v.at,{year:'numeric'})}<small>{time(v.at)}</small></td><td>{v.device} · {v.browser}<small>{v.referrer}</small></td><td><Badge status={v.outcome==='ok'?'active':v.outcome}>{v.outcome==='ok'?'Переход':undefined}</Badge></td></tr>) : <tr><td colSpan="3">Обращений пока нет. Откройте короткую ссылку, чтобы увидеть первый переход.</td></tr>}</tbody></table></div><p className="field-hint">Боты и предпросмотры тоже могут расходовать лимит переходов.</p><div className="modal-footer"><button className="button subtle" onClick={onClose}>Закрыть</button></div></Modal>;
}

export function HelpDialog({ onClose }) {
  return <Modal title="Всё начинается со ссылки" eyebrow="НЕБОЛЬШОЙ ГИД" onClose={onClose} className="help-modal"><div className="help-steps">{[
    ['Вставьте адрес','Создайте короткую ссылку, задайте название и при желании собственный код.'],
    ['Задайте правила','Ограничьте срок и число переходов. Повторное открытие тоже считается. Настройки можно изменить позже.'],
    ['Следите за результатом','Копирование не увеличивает счётчик. Переход по короткому адресу — увеличивает. Статистика появится автоматически.'],
  ].map(([title,description],i) => <article key={title}><span>0{i+1}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div><div className="help-note"><Icon name="info"/><div><strong>Это ваше локальное пространство</strong><p>Адрес localhost работает на этом компьютере, пока запущен сервер. Для доступа с других устройств нужно отдельно настроить сетевой доступ. Панель управления не имеет авторизации.</p><p>Ограничения действуют на короткую ссылку. Исходный сайт остаётся доступен по своему адресу. IP-адреса не сохраняются.</p></div></div><div className="modal-footer"><button className="button primary" onClick={onClose}>Всё понятно<Icon name="check"/></button></div></Modal>;
}

export function DeleteDialog({ link, onDelete, onClose }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const close = () => {if(!busy)onClose();};
  const remove = async () => {
    setBusy(true);setError('');
    try {await onDelete(link);} catch(e) {setBusy(false);setError(e.message);}
  };
  return <Modal title="Удалить ссылку?" onClose={close} className="confirm-modal"><p className="modal-description">«{link.title}» — {location.host}/{link.code}</p><p className="field-hint">Короткий адрес перестанет работать. История переходов будет удалена.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button subtle" onClick={close} disabled={busy}>Отмена</button><button className="button danger" onClick={remove} disabled={busy}>{busy?'Удаляем…':'Удалить ссылку'}</button></div></Modal>;
}
