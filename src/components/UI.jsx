import { useEffect, useId, useRef } from 'react';
import {
  ArrowUpRight, ChartLineUp, Check, Clock, Copy, Cursor, DownloadSimple,
  Info, LinkSimple, MagnifyingGlass, Pause, PencilSimple, Play, Plus,
  SquaresFour, Trash, Users, X, List,
} from '@phosphor-icons/react';
import { STATUS } from '../statistics';

const icons = { arrow:ArrowUpRight, chart:ChartLineUp, check:Check, clock:Clock, copy:Copy,
  click:Cursor, download:DownloadSimple, info:Info, link:LinkSimple, search:MagnifyingGlass,
  pause:Pause, edit:PencilSimple, play:Play, plus:Plus, grid:SquaresFour, trash:Trash,
  users:Users, close:X, menu:List };
export function Icon({ name, ...props }) {
  const Component = icons[name] || Info;
  return <Component size={20} weight="regular" aria-hidden="true" {...props} />;
}
export function Brand() {
  return <a className="brand" href="/" aria-label="LinkLab — главная"><img className="brand-mark" src="/favicon.svg" alt=""/><span>Link<span className="brand-light">Lab</span><span className="brand-dot">.</span></span></a>;
}
export function IconButton({ name, label, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} title={label} aria-label={label} {...props}><Icon name={name}/></button>;
}
export function Badge({ status, children }) {
  return <span className={`badge ${status}`}>{children || STATUS[status]}</span>;
}
export function Breakdown({ visits, field, max = 5, empty = 'Пока нет данных' }) {
  const counts = new Map();
  visits.forEach(v => counts.set(v[field],(counts.get(v[field]) || 0)+1));
  if (!visits.length) return <p className="breakdown-empty">{empty}</p>;
  return [...counts].sort((a,b) => b[1]-a[1]).slice(0,max).map(([label,count]) => <div className="source-row" key={label}><div className="source-label"><span title={label}>{label}</span><span>{count.toLocaleString('ru-RU')} · {Math.round(count/visits.length*100)}%</span></div><div className="bar-track"><div className="bar-fill" style={{width:`${count/visits.length*100}%`}}/></div></div>);
}
export function Modal({ title, eyebrow, description, children, onClose, className = '' }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={id}
    onCancel={event => {event.preventDefault();onClose();}}
    onClick={event => {if(event.target !== ref.current)return;const r=ref.current.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}>
    <div className="modal-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2></div><IconButton name="close" label="Закрыть" onClick={onClose}/></div>
    {description && <p className="modal-description">{description}</p>}{children}
  </dialog>;
}
