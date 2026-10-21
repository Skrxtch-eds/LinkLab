import { useState } from 'react';
import { api } from '../api';
import { localDateInput } from '../statistics';
import { Icon, Modal } from './UI';
import ExpiryPicker from './ExpiryPicker';

export default function LinkEditor({ link, projectId, initialURL = '', onClose, onSaved }) {
  const [form,setForm] = useState({url:link?.url || initialURL,title:link?.title || '',description:link?.description || '',code:link?.code || '',expiry:localDateInput(link?.expires_at),limit:link?.max_clicks ?? ''});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const change = event => {
    const {name,value} = event.currentTarget;
    setForm(previous => ({...previous,[name]:value}));
  };
  function randomCode() {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(5)), byte => 'abcdefghjkmnpqrstuvwxyz23456789'[byte % 32]).join('');
    setForm(previous => ({...previous,code}));
  }
  const close = () => {if(!busy)onClose();};
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = {url:form.url,title:form.title,description:form.description,code:form.code,project_id:projectId,expires_at:form.expiry?new Date(form.expiry).toISOString():null,max_clicks:form.limit===''?null:Number(form.limit)};
      const result = await api(link?`/api/links/${link.id}`:'/api/links',{method:link?'PATCH':'POST',data});
      await onSaved(result,link);
    } catch (e) {setError(e.message || 'Не удалось сохранить ссылку.');setBusy(false);}
  }
  return <Modal title={link?'Настройки ссылки':'Новая короткая ссылка'} eyebrow={`LINKLAB / ${link?'УПРАВЛЕНИЕ':'СОЗДАНИЕ'}`} description="Один адрес. Все нужные настройки." onClose={close} className="link-editor-modal">
    <form id="link-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="form-fields">
        <label className="sr-only" htmlFor="link-url">Куда ведёт ссылка</label><input id="link-url" name="url" placeholder="Куда ведёт ссылка" aria-label="Куда ведёт ссылка" value={form.url} onChange={change} required maxLength={4096} autoComplete="url" data-autofocus/>
        <label className="sr-only" htmlFor="link-title">Название ссылки</label><input id="link-title" name="title" placeholder="Название ссылки" aria-label="Название ссылки" value={form.title} onChange={change} maxLength={120}/>
        <label className="sr-only" htmlFor="link-description">Описание ссылки</label><textarea id="link-description" name="description" placeholder="Описание ссылки" aria-label="Описание ссылки" value={form.description} onChange={change} maxLength={500} rows={2}/>
        <label className="sr-only" htmlFor="link-code">Короткий адрес</label><div className="code-input"><span>{location.host}/</span><input id="link-code" name="code" placeholder="Адрес" aria-label="Короткий адрес" pattern="[A-Za-z0-9_-]{3,40}" maxLength={40} value={form.code} onChange={change} disabled={!!link} aria-describedby="code-hint"/>{!link&&<button type="button" className="random-code" onClick={randomCode}>Случайный адрес</button>}</div><p className="field-hint" id="code-hint">{link?'Короткий адрес останется прежним.':'От 3 символов: латинские буквы, цифры, дефис или подчёркивание.'}</p>
        <div className="form-divider"><span>Контроль доступа</span><span className="optional">оставьте пустым для снятия ограничений</span></div>
        <div className="form-columns"><div><label className="sr-only" htmlFor="expiry-picker-trigger">Действует до</label><ExpiryPicker value={form.expiry} onChange={expiry => setForm(previous => ({...previous, expiry}))}/><p className="field-hint">Время вашего устройства</p></div><div><label className="sr-only" htmlFor="link-limit">Лимит переходов</label><input id="link-limit" name="limit" type="number" min="1" max="1000000000" step="1" placeholder="Лимит переходов" aria-label="Лимит переходов" value={form.limit} onChange={change}/><p className="field-hint">Каждое открытие расходует лимит</p></div></div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-footer"><button type="button" className="button subtle" onClick={close} disabled={busy}>Отмена</button><button type="submit" className="button primary" id="save-link" disabled={busy}>{busy?'Сохраняем…':link?'Сохранить изменения':'Создать ссылку'}<Icon name={link?'check':'arrow'}/></button></div>
    </form>
  </Modal>;
}
