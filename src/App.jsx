import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useDashboard } from './hooks/useDashboard';
import { EMPTY_DATA } from './statistics';
import { CreatedDialog, DeleteDialog, StatsDialog } from './components/Dialogs';
import LinkEditor from './components/LinkEditor';
import ProjectEditor from './components/ProjectEditor';
import ProjectSpace from './components/ProjectSpace';
import { Icon } from './components/UI';

export default function App() {
  const {data:result,connected,refresh} = useDashboard();
  const data = result || EMPTY_DATA;
  const [projectId,setProjectId] = useState(null);
  const [modal,setModal] = useState(null);
  const [pending,setPending] = useState(null);
  const [toasts,setToasts] = useState([]);
  const toastSequence = useRef(0);
  const toastTimers = useRef(new Set());
  const project = data.projects.find(item=>item.id===projectId);
  const statsLink = modal?.type==='stats' ? data.links.find(link=>link.id===modal.id):null;
  useEffect(()=>()=>toastTimers.current.forEach(clearTimeout),[]);
  function notify(message,error=false) {
    const id=++toastSequence.current;setToasts(items=>[...items,{id,message,error}]);
    const timer=setTimeout(()=>{setToasts(items=>items.filter(item=>item.id!==id));toastTimers.current.delete(timer);},4200);toastTimers.current.add(timer);
  }
  const close=()=>setModal(null);
  async function copy(value) {try {await navigator.clipboard.writeText(value);notify('Ссылка скопирована');}catch{notify('Браузер не разрешил копирование. Выделите адрес вручную.',true);}}
  async function projectSaved(response) {await refresh();setModal(null);setProjectId(response.id);notify('Папка проекта создана');}
  async function linkSaved(response,existing) {
    const next=await refresh();
    if(existing){close();notify('Настройки ссылки сохранены');}
    else setModal({type:'created',link:next?.links.find(link=>link.code===response.code)||{code:response.code}});
  }
  async function toggle(link) {
    setPending(link.id);
    try {await api(`/api/links/${link.id}`,{method:'PATCH',data:{enabled:!link.enabled}});await refresh();notify(link.enabled?'Ссылка приостановлена':'Ссылка включена. Срок и лимит продолжают действовать.');}
    catch(e){notify(e.message,true);}finally{setPending(null);}
  }
  async function remove(link) {await api(`/api/links/${link.id}`,{method:'DELETE',data:{}});close();await refresh();notify('Ссылка и её статистика удалены');}

  return <div className="application project-application">
    <div className="ambient-noise" aria-hidden="true"/>
    <main className="project-app-main">
      {connected===false&&<div className="connection-banner" role="alert"><Icon name="info"/><span>Нет связи с локальным сервером. {result?'Показаны последние полученные данные.':'Запустите LinkLab и повторите попытку.'}</span><button onClick={refresh}>Повторить</button></div>}
      <ProjectSpace projects={data.projects} links={data.links} visits={data.visits} projectId={projectId} onProjectChange={setProjectId} onCreateProject={()=>setModal({type:'project'})} onCreateLink={()=>setModal({type:'editor',projectId})} onEdit={link=>setModal({type:'editor',link,projectId:link.project_id})} onStats={id=>setModal({type:'stats',id})} onToggle={toggle} onDelete={link=>setModal({type:'delete',link})} onCopy={copy} pending={pending} isLoading={!result&&connected!==false}/>
    </main>
    {modal?.type==='project'&&<ProjectEditor onClose={close} onSaved={projectSaved}/>}
    {modal?.type==='editor'&&<LinkEditor key={modal.link?.id||`new-${modal.projectId}`} link={modal.link} projectId={modal.projectId} onClose={close} onSaved={linkSaved}/>}
    {modal?.type==='created'&&<CreatedDialog link={modal.link} onCopy={copy} onStats={id=>setModal({type:'stats',id})} onClose={close}/>}
    {modal?.type==='stats'&&(statsLink?<StatsDialog link={statsLink} visits={data.visits} onClose={close}/>:null)}
    {modal?.type==='delete'&&<DeleteDialog link={modal.link} onDelete={remove} onClose={close}/>}
    <div className="toast-region" role="status" aria-live="polite">{toasts.map(item=><div className={`toast${item.error?' error':''}`} key={item.id}><Icon name={item.error?'info':'check'}/><span>{item.message}</span></div>)}</div>
  </div>;
}
