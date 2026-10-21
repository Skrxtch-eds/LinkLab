import { useState } from 'react';
import { api } from '../api';
import { Icon, Modal } from './UI';

export default function ProjectEditor({ onClose, onSaved }) {
  const [form,setForm] = useState({name:'',description:''});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const change = e => {const {name,value}=e.currentTarget;setForm(current=>({...current,[name]:value}));};
  async function submit(e) {
    e.preventDefault();setBusy(true);setError('');
    try {const result=await api('/api/projects',{method:'POST',data:form});await onSaved(result);}
    catch(err){setError(err.message || 'Не удалось создать проект.');setBusy(false);}
  }
  return <Modal title="Новая папка проекта" eyebrow="LINKLAB / PROJECT SETUP" description="Дайте проекту имя. Ссылки и статистика будут собраны здесь." onClose={()=>!busy&&onClose()} className="project-modal">
    <form onSubmit={submit}><fieldset className="form-fields" disabled={busy}><label className="sr-only" htmlFor="project-name">Название проекта</label><input id="project-name" name="name" placeholder="Название проекта" aria-label="Название проекта" value={form.name} onChange={change} required maxLength={80} data-autofocus/><label className="sr-only" htmlFor="project-description">Описание проекта</label><textarea id="project-description" name="description" placeholder="Описание проекта" aria-label="Описание проекта" value={form.description} onChange={change} rows={3} maxLength={500}/><p className="field-hint">{form.description.length} / 500</p></fieldset>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-footer"><button className="button subtle" type="button" onClick={onClose} disabled={busy}>Отмена</button><button className="button acid-button" type="submit" disabled={busy}>{busy?'Создаём…':'Создать папку'}<Icon name="arrow"/></button></div></form>
  </Modal>;
}
