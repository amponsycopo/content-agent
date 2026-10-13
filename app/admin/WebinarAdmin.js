'use client';
import {useEffect,useState} from 'react';
const empty=()=>({slug:'',title:'',description:'',starts_local:'',duration_minutes:90,zoom_url:'',scalev_product_id:412147,status:'draft'});
function dateInput(d){
 if(!d)return '';
 const ms=new Date(d).getTime(),j=new Date(ms+7*60*60*1000);
 return j.toISOString().slice(0,16);
}
function displayDate(d){return new Date(d).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})+' WIB'}
export default function WebinarAdmin({session}){
 const [events,setEvents]=useState([]),[edit,setEdit]=useState(empty()),[selected,setSelected]=useState(null),[registrations,setRegistrations]=useState([]);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [showArchived,setShowArchived]=useState(false);
 const visibleEvents=events.filter(e=>Boolean(e.archived_at)===showArchived);
 async function call(q,method='GET',body){
  const headers={Authorization:'Bearer '+session.access_token};
  if(body)headers['Content-Type']='application/json';
  const r=await fetch('/api/admin/webinars'+q,{method,headers,body:body?JSON.stringify(body):undefined});
  const j=await r.json();if(!r.ok)throw Error(j.error||'Permintaan gagal');return j;
 }
 async function loadEvents(){
  const j=await call('?view=events');setEvents(j.events||[]);
 }
 useEffect(()=>{loadEvents().catch(e=>setNotice(e.message))},[session?.access_token]);
 function editing(e){setEdit({...e,starts_local:dateInput(e.starts_at)});setNotice('')}
 function patch(k,v){setEdit(x=>({...x,[k]:v}))}
 async function save(){
  setBusy(true);setNotice('');
  try{
   if(!edit.starts_local)throw Error('Isi tanggal dan jam webinar.');
   // Input uses WIB regardless of admin browser timezone.
   const start=new Date(edit.starts_local+':00+07:00').toISOString();
   const body={...edit,starts_at:start};
   const j=await call('','POST',body);
   setEdit(x=>({...x,id:j.id}));setNotice('Webinar tersimpan.');
   await loadEvents();
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function lifecycle(e,action){
  if(busy)return;
  const prompt=action==='delete'?`Hapus draft "${e.title}" secara permanen? Tindakan ini tidak bisa dibatalkan.`:action==='archive'?`Arsipkan "${e.title}"? Pendaftaran ditutup; data peserta tetap tersimpan.`:null;
  if(prompt&&!window.confirm(prompt))return;
  setBusy(true);setNotice('');
  try{
   if(action==='delete')await call('?id='+encodeURIComponent(e.id),'DELETE');
   else await call('','PATCH',{id:e.id,action});
   if(edit.id===e.id)setEdit(empty());
   if(selected?.id===e.id){setSelected(null);setRegistrations([])}
   await loadEvents();
   setNotice(action==='delete'?'Draft webinar dihapus.':action==='archive'?'Webinar diarsipkan. Data peserta tetap tersimpan.':'Webinar dipulihkan dengan registrasi tetap ditutup. Edit untuk membuka kembali.');
  }catch(err){setNotice(err.message)}finally{setBusy(false)}
 }
 async function viewParticipants(e){
  setSelected(e);setRegistrations([]);setNotice('');
  try{const j=await call('?view=registrations&event_id='+encodeURIComponent(e.id));setRegistrations(j.registrations||[])}
  catch(err){setNotice(err.message)}
 }
 async function screenshot(id){
  try{
   const j=await call('?view=screenshot&id='+encodeURIComponent(id));
   window.open(j.url,'_blank','noopener,noreferrer');
  }catch(e){setNotice(e.message)}
 }
 function exportCsv(){
  const rows=[['Tanggal','Nama','Email','WhatsApp','Keluhan','Izin Review','Screenshot'],...registrations.map(r=>[
   r.registered_at,r.full_name,r.email,r.whatsapp,r.problem||'',r.review_consent?'YA':'TIDAK',
   (r.webinar_screenshots||[]).map(a=>a.platform).join(',')
  ])];
  const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^([=+@-])/,"'$1").replaceAll('"','""')+'"').join(',')).join('\r\n');
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
  a.href=u;a.download='peserta-webinar-'+selected.slug+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),250);
 }
 return <div>
  <div className="panel">
   <h2>Manajemen Webinar</h2>
   <p className="muted">Satu sesi menggunakan satu jadwal dan link Zoom tersendiri. Semua registrasi diverifikasi berdasarkan order kelas lunas di Scalev.</p>
   <button className="outline" disabled={busy} onClick={()=>{setEdit(empty());setNotice('')}}>+ Buat webinar baru</button>
   <div className="tabs"><button disabled={busy} className={!showArchived?'chosen':''} onClick={()=>setShowArchived(false)}>Webinar ({events.filter(e=>!e.archived_at).length})</button><button disabled={busy} className={showArchived?'chosen':''} onClick={()=>setShowArchived(true)}>Arsip ({events.filter(e=>e.archived_at).length})</button></div>
   {visibleEvents.length===0?<p className="muted">{showArchived?'Belum ada webinar di arsip.':'Belum ada webinar.'}</p>:<div className="tablewrap"><table><thead><tr><th>Webinar</th><th>Jadwal</th><th>Status</th><th>Kelola</th></tr></thead><tbody>
    {visibleEvents.map(e=><tr key={e.id}><td><strong>{e.title}</strong><p className="small">{e.slug}</p></td><td>{displayDate(e.starts_at)}</td><td>{e.archived_at?'Diarsipkan':e.status==='open'?'Registrasi dibuka':e.status==='closed'?'Registrasi ditutup':'Draft'}</td><td><div className="actions" style={{margin:0}}>{e.archived_at?<button className="outline" disabled={busy} onClick={()=>lifecycle(e,'restore')}>Pulihkan</button>:<><button className="outline" disabled={busy} onClick={()=>editing(e)}>Edit</button><button className="outline" disabled={busy} onClick={()=>lifecycle(e,'archive')}>Arsipkan</button>{e.status==='draft'&&!e.published_at&&e.webinar_registrations?.[0]?.count===0&&<button className="outline" disabled={busy} onClick={()=>lifecycle(e,'delete')}>Hapus draft</button>}</>}<button disabled={busy} onClick={()=>viewParticipants(e)}>Peserta</button></div></td></tr>)}
   </tbody></table></div>}
  </div>
  {notice&&<p className="error">{notice}</p>}
  <div className="panel stack">
   <h2>{edit.id?'Edit webinar':'Webinar baru'}</h2>
   <div className="grid2"><label>Judul webinar<input value={edit.title} onChange={e=>patch('title',e.target.value)} placeholder="Bedah Toko Ojol #01"/></label><label>Slug URL<input value={edit.slug} onChange={e=>patch('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="bedah-toko-ojol-01"/></label></div>
   <p className="muted">Judul boleh sama untuk sesi berulang. Slug harus unik, termasuk terhadap webinar di arsip.</p>
   <label>Deskripsi<textarea rows={3} value={edit.description} onChange={e=>patch('description',e.target.value)}/></label>
   <div className="grid2"><label>Waktu (WIB)<input type="datetime-local" value={edit.starts_local} onChange={e=>patch('starts_local',e.target.value)}/></label><label>Durasi (menit)<input type="number" min={15} max={480} value={edit.duration_minutes} onChange={e=>patch('duration_minutes',Number(e.target.value))}/></label></div>
   <label>Link Zoom sesi ini<input type="url" value={edit.zoom_url} onChange={e=>patch('zoom_url',e.target.value)} placeholder="https://us06web.zoom.us/j/..."/></label>
   <div className="grid2"><label>ID produk Scalev<input type="number" value={edit.scalev_product_id} onChange={e=>patch('scalev_product_id',Number(e.target.value))}/><span className="muted">412147 = Kelas Laris Jualan di Ojol</span></label><label>Status<select value={edit.status} onChange={e=>patch('status',e.target.value)}><option value="draft">Draft</option><option value="open">Registrasi dibuka</option><option value="closed">Registrasi ditutup</option></select></label></div>
   <button disabled={busy} onClick={save}>{busy?'Menyimpan...':'Simpan webinar'}</button>
   {edit.id&&<p className="muted">Halaman pendaftaran: <a href={'/webinar/'+edit.slug} target="_blank" rel="noopener noreferrer">{location.origin+'/webinar/'+edit.slug}</a></p>}
  </div>
  {selected&&<div className="panel"><h2>Peserta · {selected.title}</h2><p className="muted">{registrations.length} pendaftar ditampilkan. Screenshot dan kendala bersifat privat; tampilkan kasus hanya jika peserta memberikan izin.</p><button onClick={exportCsv} disabled={!registrations.length}>Export peserta CSV</button>
   <div className="tablewrap"><table><thead><tr><th>Peserta</th><th>Kendala</th><th>Izin review</th><th>Screenshot</th></tr></thead><tbody>
    {registrations.map(r=><tr key={r.id}><td><strong>{r.full_name}</strong><p className="small">{r.email}</p><p className="small">{r.whatsapp}</p></td><td style={{minWidth:220}}>{r.problem||'—'}</td><td>{r.review_consent?'Ya':'Tidak'}</td><td>{(r.webinar_screenshots||[]).map(a=><p key={a.id}><button className="outline" onClick={()=>screenshot(a.id)}>{a.platform}</button></p>)}</td></tr>)}
   </tbody></table></div>
  </div>}
 </div>
}
