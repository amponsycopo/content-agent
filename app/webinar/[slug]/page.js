'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
const sources=[['gofood','GoFood'],['grabfood','GrabFood'],['shopeefood','ShopeeFood']];
const fmt=d=>new Date(d).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+' WIB';
export default function WebinarPage(){
 const {slug}=useParams();
 const [event,setEvent]=useState(null),[client,setClient]=useState(null),[session,setSession]=useState(null);
 const [phase,setPhase]=useState('loading'),[email,setEmail]=useState(''),[otp,setOtp]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [name,setName]=useState(''),[wa,setWa]=useState(''),[problem,setProblem]=useState(''),[consent,setConsent]=useState(false),[photos,setPhotos]=useState({});
 const [links,setLinks]=useState(null);
 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    const r=await fetch('/api/webinar/'+encodeURIComponent(slug),{cache:'no-store'}),j=await r.json();
    if(!r.ok)throw Error(j.error||'Webinar tidak tersedia');
    const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const {data}=await c.auth.getSession();
    if(!live)return;
    setClient(c);setEvent(j.event);
    if(data.session){setSession(data.session);setEmail(data.session.user.email);await checkMember(data.session.access_token);}
    else setPhase('email');
   }catch(e){if(live){setNotice(e.message);setPhase('error')}}
  })();
  return ()=>{live=false};
 },[slug]);
 async function checkMember(token){
  setPhase('checking');setNotice('');
  try{
   const r=await fetch('/api/webinar/member',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({slug})});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal mengecek transaksi.');
   if(!j.eligible){setNotice(j.message||'Pembelian belum ditemukan');setPhase('not-member');return}
   if(j.registered){setLinks(j);setPhase('done')}
   else setPhase('register');
  }catch(e){setNotice(e.message);setPhase('check-error')}
 }
 async function sendOtp(e){
  e.preventDefault();if(!client)return;
  setBusy(true);setNotice('');
  try{
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Masukkan email yang valid.');
   const {error}=await client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{shouldCreateUser:true}});
   if(error)throw error;
   setPhase('otp');setNotice('Kode verifikasi dikirim. Cek inbox dan folder spam.');
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function verifyOtp(e){
  e.preventDefault();if(!client)return;
  setBusy(true);setNotice('');
  try{
   if(!/^\d{6}$/.test(otp))throw Error('Masukkan OTP 6 digit.');
   const {data,error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token:otp,type:'email'});
   if(error||!data?.session)throw Error(error?.message||'Kode belum valid.');
   setSession(data.session);await checkMember(data.session.access_token);
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function switchEmail(){
  await client?.auth.signOut();setSession(null);setEmail('');setOtp('');setLinks(null);setPhase('email');setNotice('');
 }
 async function register(e){
  e.preventDefault();setBusy(true);setNotice('');
  try{
   if(!session?.access_token)throw Error('Silakan verifikasi email dulu.');
   const f=new FormData();
   f.set('slug',slug);f.set('name',name);f.set('whatsapp',wa);f.set('problem',problem);f.set('review_consent',String(consent));
   for(const [id] of sources)if(photos[id])f.set(id,photos[id]);
   const r=await fetch('/api/webinar/register',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},body:f});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Pendaftaran gagal.');
   setLinks(j);setPhase('done');window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 return <main className="wrap">
  <header className="nav"><Link href="/" style={{color:'inherit',textDecoration:'none'}}><strong>ERLAN<span className="accent">.</span></strong></Link><span>WEBINAR KHUSUS MEMBER</span></header>
  <section className="hero"><p className="eyebrow">WEBINAR MEMBER · KELAS OJOL</p><h1>{event?.title||'Webinar Member'}</h1>
  {event&&<><p>{event.description}</p><p><strong>📅 {fmt(event.starts_at)}</strong> · {event.duration_minutes} menit</p></>}
  </section>
  {phase==='loading'&&<div className="panel">Memuat jadwal webinar...</div>}
  {phase==='error'&&<div className="panel"><h2>Webinar tidak tersedia</h2><p className="error">{notice}</p></div>}
  {phase==='email'&&<form className="panel" onSubmit={sendOtp}><h2>Verifikasi keanggotaan</h2><p className="muted">Gunakan email yang digunakan untuk membeli Kelas Laris Jualan di Ojol.</p>
   <label>Email pembelian<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com"/></label>
   <button disabled={busy} type="submit">{busy?'Mengirim...':'Kirim kode OTP →'}</button>
   {notice&&<p className="error">{notice}</p>}
  </form>}
  {phase==='otp'&&<form className="panel" onSubmit={verifyOtp}><h2>Masukkan kode 6 digit</h2><p className="muted">Kode dikirim ke <strong>{email}</strong>. Jangan bagikan OTP kepada siapa pun.</p>
   <label>Kode OTP<input inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="123456"/></label>
   <button type="submit" disabled={busy||otp.length!==6}>{busy?'Memeriksa...':'Verifikasi email →'}</button>
   <button className="outline" type="button" disabled={busy} onClick={sendOtp}>Kirim ulang kode</button>
   <button className="outline" type="button" onClick={switchEmail}>Ganti email</button>
   {notice&&<p className="muted">{notice}</p>}
  </form>}
  {phase==='checking'&&<div className="panel"><h2>Memeriksa pembelian di Scalev...</h2><p className="muted">Kami hanya membuka registrasi untuk member yang pembelian kelasnya sudah lunas.</p></div>}
  {phase==='check-error'&&<div className="panel"><h2>Verifikasi belum tersedia</h2><p className="error">{notice}</p><button onClick={()=>checkMember(session?.access_token)}>Coba lagi</button></div>}
  {phase==='not-member'&&<div className="panel"><h2>Pembelian belum ditemukan</h2><p>{notice}</p><button className="outline" onClick={switchEmail}>Coba email pembelian lain</button><p className="muted">Jika sudah membeli tetapi belum terdeteksi, hubungi admin dengan bukti transaksi. Kami tidak menampilkan data pesanan lain.</p></div>}
  {phase==='register'&&<form className="panel stack" onSubmit={register}><h2>Daftar webinar</h2><p className="success">✓ Pembelian kelas terverifikasi untuk {email}.</p>
   <div className="grid2"><label>Nama lengkap *<input required minLength={2} maxLength={150} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label>WhatsApp *<input type="tel" required value={wa} onChange={e=>setWa(e.target.value)} placeholder="08xxxxxxxxxx"/></label></div>
   <label>Apa kendala terbesarmu dalam berjualan di ojol? (opsional)<textarea rows={4} maxLength={2000} value={problem} onChange={e=>setProblem(e.target.value)} placeholder="Contoh: toko sudah aktif di GoFood tapi order masih sedikit..."/></label>
   <h2>Screenshot toko (opsional)</h2><p className="muted">Bisa unggah sampai tiga screenshot. Masing-masing maksimal 1 MB, JPG/PNG/WebP. Hindari screenshot yang berisi informasi pelanggan.</p>
   {sources.map(([id,label])=><label key={id}>Screenshot {label}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPhotos(x=>({...x,[id]:e.target.files?.[0]||null}))}/>{photos[id]?.size>1024*1024&&<span className="error">{label}: gambar lebih besar dari 1 MB.</span>}</label>)}
   <label className="option"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Saya mengizinkan nama brand, kendala, dan screenshot toko saya ditampilkan saat webinar untuk bahan review. <strong>Opsional</strong>—registrasi tetap bisa dilakukan tanpa izin ini.</span></label>
   <button type="submit" disabled={busy||Object.values(photos).some(f=>f?.size>1024*1024)}>{busy?'Mendaftarkan...':'Daftar & dapatkan link webinar →'}</button>
   {notice&&<p className="error">{notice}</p>}
  </form>}
  {phase==='done'&&<div className="panel"><p className="eyebrow">REGISTRASI BERHASIL</p><h2>🎉 Sampai bertemu di webinar!</h2><p>{fmt(event.starts_at)}. Simpan jadwalnya agar tidak ketinggalan.</p>
   <div className="actions" style={{justifyContent:'flex-start'}}>
    <a className="button" href={links?.zoom_url} target="_blank" rel="noopener noreferrer">Gabung lewat Zoom ↗</a>
    <a className="button outline" href={links?.calendar_url} target="_blank" rel="noopener noreferrer">+ Google Calendar</a>
   </div><p className="muted">Google Calendar akan terbuka dengan jadwal dan link Zoom sudah terisi. Klik Save untuk menyimpannya.</p>
  </div>}
  <footer>Registrasi webinar hanya untuk pembeli kelas yang lunas. Email diperiksa melalui Scalev. Screenshot disimpan privat; izin ditampilkan saat webinar bersifat opsional.</footer>
 </main>;
}
