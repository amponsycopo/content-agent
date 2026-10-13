'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
export default function Consent(){
 const [client,setClient]=useState(null),[session,setSession]=useState(null),[id,setId]=useState(''),[details,setDetails]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 useEffect(()=>{
  setId(new URL(location.href).searchParams.get('authorization_id')||'');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key){setError('Login belum dikonfigurasi.');return}
  const c=createClient(url,key,{auth:{persistSession:false,detectSessionInUrl:false}});setClient(c);
 },[]);
 async function call(action,s=session){
  const r=await fetch('/api/insights/consent?authorization_id='+encodeURIComponent(id),{method:action?'POST':'GET',headers:{Authorization:'Bearer '+s.access_token,...(action?{'Content-Type':'application/json'}:{})},body:action?JSON.stringify({action}):undefined});
  const d=await r.json();if(!r.ok)throw Error(d.error);return d;
 }
 async function login(e){
  e.preventDefault();if(!client||busy)return;setBusy(true);setError('');
  try{const {data,error}=await client.auth.signInWithPassword({email,password});setPassword('');if(error)throw Error('Email atau password tidak valid.');setSession(data.session);setDetails(await call(null,data.session))}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function decide(action){
  setBusy(true);setError('');try{const d=await call(action);location.assign(d.redirect_url)}catch(e){setError(e.message);setBusy(false)}
 }
 return <main className="wrap"><div className="panel stack"><h1>Hubungkan Instagram Insights</h1><p>Login dengan akun admin Erlan untuk menyambungkan ChatGPT.</p>{!details?<form className="stack" onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={!client||!id||busy}>{busy?'Memeriksa...':'Login'}</button></form>:<><h2>Izinkan ChatGPT membaca insight?</h2><p>ChatGPT dapat membaca profil akun admin dan insight Instagram erlandofp. Konektor tidak dapat mengirim DM, membalas komentar, publish, atau mengubah data bonus dan webinar.</p><p>Identitas akun yang diminta: <code>{details.scope}</code></p><div className="actions"><button disabled={busy} onClick={()=>decide('approve')}>Izinkan akses baca</button><button className="outline" disabled={busy} onClick={()=>decide('deny')}>Tolak</button></div></>}{error&&<p role="alert" className="error">{error}</p>}</div></main>
}
