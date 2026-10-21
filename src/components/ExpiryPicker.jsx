import { useMemo, useState } from 'react';

const pad = value => String(value).padStart(2, '0');
const localValue = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const parseLocal = value => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]) : null;
};
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function ExpiryPicker({ value, onChange }) {
  const selected = parseLocal(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = selected || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);
  const display = selected
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(selected)
    : 'Без срока действия';

  function chooseDay(day) {
    const next = selected ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), selected.getHours(), selected.getMinutes()) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59);
    onChange(localValue(next));
  }
  function chooseTime(time) {
    if (!selected || !time) return;
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(selected);
    next.setHours(hours, minutes, 0, 0);
    onChange(localValue(next));
  }

  return <div className={`expiry-picker${open ? ' is-open' : ''}`}>
    <button id="expiry-picker-trigger" className="expiry-trigger" type="button" aria-label="Выбрать дату и время окончания" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="expiry-calendar-icon" aria-hidden="true">▦</span><span className={selected ? 'expiry-value' : 'expiry-placeholder'}>{display}</span><span className="expiry-trigger-mark" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="expiry-popover" role="dialog" aria-label="Срок действия ссылки">
      <div className="expiry-popover-top"><div><span className="expiry-kicker">СРОК ДЕЙСТВИЯ</span><strong>Выберите дату</strong></div><button type="button" className="expiry-close" aria-label="Закрыть календарь" onClick={() => setOpen(false)}>×</button></div>
      <div className="expiry-month-row"><button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(month)}</strong><button type="button" aria-label="Следующий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      <div className="expiry-calendar-grid expiry-weekdays" aria-hidden="true">{['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="expiry-calendar-grid">{days.map((day, index) => day
        ? <button key={day.toISOString()} type="button" className={`${sameDay(day, selected) ? 'selected' : ''}${sameDay(day, new Date()) ? ' today' : ''}`} aria-pressed={sameDay(day, selected)} onClick={() => chooseDay(day)}>{day.getDate()}</button>
        : <span key={`empty-${index}`} />)}</div>
      <div className="expiry-time-row"><label htmlFor="expiry-time">ВРЕМЯ</label><input id="expiry-time" type="time" value={selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : '23:59'} onChange={event => chooseTime(event.target.value)} disabled={!selected}/></div>
      <div className="expiry-actions"><button type="button" className="expiry-clear" onClick={() => { onChange(''); setOpen(false); }}>Без срока</button><button type="button" className="expiry-done" onClick={() => setOpen(false)}>{selected ? 'Готово' : 'Закрыть'}</button></div>
    </div>}
  </div>;
}
