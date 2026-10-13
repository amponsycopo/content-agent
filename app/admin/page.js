'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import WebinarAdmin from './WebinarAdmin';
const blank=()=>({slug:'',title:'',product_name:'',description:'',status:'draft',questions:[{prompt:'',step:2,input_type:'long_text',help_text:'',options:[],is_required:true}]});
const blankQ=()=>({prompt:'',step:3,input_type:'long_text',help_text:'',options:[],is_required:true});
export default function Admin(){
 const [client,setClient]=useState(null),[session,setSession]=useState(null),[email,setEmail]=useState(''),[notice,setNotice]=useState(''),[campaigns,setCampaigns]=useState([]),[submissions,setSubmissions]=useState([]),[edit,setEdit]=useState(blank()),[view,setView]=useState('campaigns'),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!u||!k){setNotice('Konfigurasi Supabase belum lengkap.');return}
  const c=createClient(u,k);setClient(c);
  c.auth.getSession().then(({data})=>setSession(data.session));
  const {data:a}=c.auth.onAuthStateChange((_event,s)=>setSession(s));
  return ()=>a.subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(session)refresh()},[session]);
 async function call(path,method='GET',body){
  if(!session)throw Error('Silakan login dulu.');
  const h={Authorization:'Bearer '+session.access_token};
  if(body&&!(body instanceof FormData))h['Content-Type']='application/json';
  const r=await fetch('/api/admin'+path,{method,headers:h,body});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Permintaan gagal.');return d;
 }
 async function refresh(){
  try{const a=await call('?view=campaigns'),b=await call('?view=submissions');setCampaigns(a.campaigns||[]);setSubmissions(b.submissions||[])}
  catch(e){setNotice(e.message)}
 }
 async function login(e){e.preventDefault();if(!client)return;const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin+'/admin'}});setNotice(error?error.message:'Cek email untuk link login admin.')}
 function load(c){setEdit({...c,questions:(c.bonus_questions||[]).slice().sort((x,y)=>x.position-y.position).map(q=>({prompt:q.prompt,step:q.step,input_type:q.input_type,help_text:q.help_text||'',options:q.options||[],is_required:q.is_required}))});setNotice('')}
 async function save(){setBusy(true);setNotice('');try{const d=await call('?action=save','POST',JSON.stringify(edit));setEdit(x=>({...x,id:d.id}));await refresh();setNotice('Campaign tersimpan.')}catch(e){setNotice(e.message)}finally{setBusy(false)}}
 async function upload(file){if(!file||!edit.id)return setNotice('Simpan campaign terlebih dahulu.');setBusy(true);try{const f=new FormData();f.set('file',file);f.set('campaign_id',edit.id);const d=await call('?action=upload','POST',f);setNotice('File bonus tersimpan: '+d.filename);await refresh()}catch(e){setNotice(e.message)}finally{setBusy(false)}}
 async function attachment(id){try{const d=await call('?view=attachment&id='+encodeURIComponent(id));window.open(d.url,'_blank','noopener,noreferrer')}catch(e){setNotice(e.message)}}
 function exportCsv(){
  const rows=[['Tanggal','Nama','Brand','Kategori','WhatsApp','Email','Testimoni','Izin Promosi','Jawaban (JSON)'],...submissions.map(s=>[s.submitted_at,s.full_name,s.brand_name||'',s.brand_category||'',s.whatsapp||'',s.email||'',s.testimonial,s.promo_consent?'YA':'TIDAK',JSON.stringify(s.answers)])];
  const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^([=+@-])/,"'$1").replaceAll('"','""')+'"').join(',')).join('\r\n');
  const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='testimoni-member.csv';a.click();URL.revokeObjectURL(a.href);
 }
 const patch=(k,v)=>setEdit(x=>({...x,[k]:v}));
 const patchQ=(i,k,v)=>setEdit(x=>({...x,questions:x.questions.map((q,j)=>i===j?{...q,[k]:v}:q)}));
 if(!session)return <main className="wrap"><header className="nav"><strong>ERLAN<span className="accent">.</span></strong><span>ADMIN</span></header><section className="hero"><p className="eyebrow">AKSES TERBATAS</p><h1>Dashboard Bonus</h1><p>Hanya email admin yang didaftarkan di Vercel yang bisa mengelola data.</p></section><form className="panel" onSubmit={login}><label>Email admin<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><button type="submit">Kirim link login →</button>{notice&&<p className="muted">{notice}</p>}</form></main>;
 return <main className="wrap admin"><header className="nav"><Link href="/">ERLAN.</Link><span>ADMIN</span><button className="outline" onClick={()=>client?.auth.signOut()}>Keluar</button></header><section className="hero"><p className="eyebrow">MEMBER EXPERIENCE</p><h1>Bonus & Webinar Member</h1><p>{campaigns.length} campaign · {submissions.length} testimoni masuk · {submissions.filter(s=>s.promo_consent).length} izin promosi</p></section>
 <div className="tabs"><button className={view==='campaigns'?'chosen':''} onClick={()=>setView('campaigns')}>Kuesioner</button><button className={view==='submissions'?'chosen':''} onClick={()=>setView('submissions')}>Testimoni</button><button className={view==='webinars'?'chosen':''} onClick={()=>setView('webinars')}>Webinar</button><button className="outline" onClick={refresh}>Refresh</button></div>
 {notice&&<p className="error">{notice}</p>}
 {view==='webinars'?<WebinarAdmin session={session}/>:view==='campaigns'?<div className="grid2"><div className="panel"><h2>Daftar campaign</h2><button className="outline" onClick={()=>setEdit(blank())}>+ Campaign baru</button>{campaigns.map(c=><p key={c.id}><button className="outline" onClick={()=>load(c)}>{c.product_name} · {c.status}</button></p>)}</div><div className="panel stack"><h2>{edit.id?'Edit campaign':'Campaign baru'}</h2>
 <label>Nama produk<input value={edit.product_name} onChange={e=>patch('product_name',e.target.value)}/></label><label>Judul<input value={edit.title} onChange={e=>patch('title',e.target.value)}/></label><label>Slug URL<input value={edit.slug} onChange={e=>patch('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/></label><label>Deskripsi<textarea value={edit.description} onChange={e=>patch('description',e.target.value)}/></label><label>Status<select value={edit.status} onChange={e=>patch('status',e.target.value)}><option value="draft">Draft</option><option value="active">Aktif</option><option value="archived">Arsip</option></select></label>
 <h2>Pertanyaan</h2>{edit.questions.map((q,i)=><div className="formQ stack" key={i}><strong>Pertanyaan {i+1}</strong><label>Teks<input value={q.prompt} onChange={e=>patchQ(i,'prompt',e.target.value)}/></label><label>Tahap<select value={q.step} onChange={e=>patchQ(i,'step',Number(e.target.value))}><option value={2}>Sebelum kelas</option><option value={3}>Sesudah kelas</option><option value={4}>Evaluasi</option></select></label><label>Jenis<select value={q.input_type} onChange={e=>patchQ(i,'input_type',e.target.value)}>{['short_text','long_text','single_choice','multiple_choice','rating','number','yes_no'].map(t=><option key={t} value={t}>{t}</option>)}</select></label>{['single_choice','multiple_choice'].includes(q.input_type)&&<label>Opsi, satu baris per opsi<textarea value={q.options.join('\n')} onChange={e=>patchQ(i,'options',e.target.value.split('\n').filter(Boolean))}/></label>}<label className="check"><input type="checkbox" checked={q.is_required} onChange={e=>patchQ(i,'is_required',e.target.checked)}/>Wajib dijawab</label><button className="outline" onClick={()=>patch('questions',edit.questions.filter((_q,j)=>i!==j))} disabled={edit.questions.length===1}>Hapus</button></div>)}
 <button className="outline" onClick={()=>patch('questions',[...edit.questions,blankQ()])}>+ Pertanyaan</button><button disabled={busy} onClick={save}>Simpan campaign</button>
 {edit.id&&<div className="stack"><h2>File bonus</h2><p className="muted">PDF, ZIP, XLSX, CSV, DOCX maksimal 3 MB.</p><input type="file" accept=".pdf,.zip,.xlsx,.csv,.docx" onChange={e=>upload(e.target.files?.[0])}/>{campaigns.find(c=>c.id===edit.id)?.reward_filename&&<p className="small">File tersimpan: {campaigns.find(c=>c.id===edit.id).reward_filename}</p>}</div>}</div></div>:
 <div className="panel"><h2>Testimoni member</h2><p className="muted">Hanya gunakan testimoni untuk promosi bila izin promosi diberikan.</p><button onClick={exportCsv} disabled={!submissions.length}>Export CSV</button><div className="tablewrap"><table><thead><tr><th>Member</th><th>Brand</th><th>Ulasan</th><th>Izin</th><th>Lampiran</th></tr></thead><tbody>{submissions.map(s=><tr key={s.id}><td>{s.full_name}<p className="small">{s.whatsapp}</p></td><td>{s.brand_name||'Belum ada'}<p className="small">{s.brand_category}</p></td><td>{s.testimonial}<details><summary>Jawaban lengkap</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(s.answers,null,2)}</pre></details></td><td>{s.promo_consent?'Ya':'Tidak'}</td><td>{s.bonus_attachments?.map(a=><p key={a.id}><button className="outline" onClick={()=>attachment(a.id)}>Lihat foto</button></p>)}</td></tr>)}</tbody></table></div></div>}
 </main>;
}
