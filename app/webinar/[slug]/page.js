'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';

const platforms=[['gofood','GoFood'],['grabfood','GrabFood'],['shopeefood','ShopeeFood']];
const fmt=d=>new Date(d).toLocaleString('id-ID',{
 timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'
})+' WIB';

export default function WebinarPage(){
 const {slug}=useParams();
 const [event,setEvent]=useState(null),[phase,setPhase]=useState('loading');
 const [email,setEmail]=useState(''),[wa,setWa]=useState(''),[name,setName]=useState('');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [problem,setProblem]=useState(''),[consent,setConsent]=useState(false),[photos,setPhotos]=useState({});
 const [links,setLinks]=useState(null),[uploadWarning,setUploadWarning]=useState(false);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const r=await fetch('/api/webinar/'+encodeURIComponent(slug),{cache:'no-store'});
    const j=await r.json();
    if(!r.ok)throw Error(j.error||'Webinar tidak tersedia.');
    if(active){setEvent(j.event);setPhase('identity')}
   }catch(err){
    if(active){setPhase('error');setNotice(err.message)}
   }
  })();
  return ()=>{active=false};
 },[slug]);

 async function verify(e){
  e.preventDefault();setBusy(true);setPhase('checking');setNotice('');
  try{
   const r=await fetch('/api/webinar/member',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug,email,whatsapp:wa})
   });
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Gagal memeriksa transaksi.');
   if(!j.eligible){
    setNotice(j.message||'Pembelian tidak ditemukan.');setPhase('not-member');return;
   }
   if(j.registered){
    setLinks(j);setPhase('done');return;
   }
   setName(j.full_name||'');setPhase('register');
  }catch(err){setNotice(err.message);setPhase('check-error')}
  finally{setBusy(false)}
 }
 async function register(e){
  e.preventDefault();setBusy(true);setNotice('');
  try{
   const body=new FormData();
   body.set('slug',slug);body.set('email',email);body.set('whatsapp',wa);
   body.set('name',name);body.set('problem',problem);
   body.set('review_consent',String(consent));
   for(const [id] of platforms)if(photos[id])body.set(id,photos[id]);
   const r=await fetch('/api/webinar/register',{method:'POST',body});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Registrasi gagal.');
   setLinks(j);setUploadWarning(!!j.upload_warning);setPhase('done');
   window.scrollTo({top:0,behavior:'smooth'});
  }catch(err){setNotice(err.message)}finally{setBusy(false)}
 }
 function editIdentity(){
  setPhase('identity');setNotice('');setLinks(null);
  setProblem('');setConsent(false);setPhotos({});
 }
 return <main className="wrap">
  <header className="nav">
   <Link href="/" style={{color:'inherit',textDecoration:'none'}}><strong>ERLAN<span className="accent">.</span></strong></Link>
   <span>WEBINAR KHUSUS MEMBER</span>
  </header>
  <section className="hero">
   <p className="eyebrow">WEBINAR MEMBER · KELAS OJOL</p>
   <h1>{event?.title||'Webinar Member'}</h1>
   {event&&<><p>{event.description}</p><p><strong>📅 {fmt(event.starts_at)}</strong> · {event.duration_minutes} menit</p></>}
  </section>
  {phase==='loading'&&<div className="panel">Memuat webinar...</div>}
  {phase==='error'&&<div className="panel"><h2>Webinar tidak tersedia</h2><p className="error">{notice}</p></div>}
  {phase==='identity'&&<form className="panel" onSubmit={verify}>
   <h2>Daftar atau ambil kembali link webinar</h2>
   <p className="muted">Masukkan email dan WhatsApp yang dipakai saat membeli Kelas Laris Jualan di Ojol. Sudah pernah daftar? Link Zoom akan langsung muncul, tanpa isi form ulang.</p>
   <label>Email pembelian
    <input type="email" autoComplete="email" required maxLength={254}
     value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com"/>
   </label>
   <label>Nomor WhatsApp pembelian
    <input type="tel" autoComplete="tel" required inputMode="tel"
     value={wa} onChange={e=>setWa(e.target.value)} placeholder="0812xxxxxxxx"/>
   </label>
   <button type="submit" disabled={busy}>Cek keanggotaan & lanjut →</button>
   {!event?.registration_open&&<p className="muted">Pendaftaran baru sudah ditutup. Member yang pernah daftar masih bisa mengambil link.</p>}
   <p className="muted small">Tidak perlu OTP. Sistem mencocokkan kedua data dengan transaksi kelas lunas di Scalev.</p>
  </form>}
  {phase==='checking'&&<div className="panel"><h2>Sedang memeriksa pembelian...</h2><p className="muted">Mohon tunggu, data sedang dicocokkan ke Scalev.</p></div>}
  {phase==='check-error'&&<div className="panel">
   <h2>Belum bisa memproses</h2><p className="error">{notice}</p>
   <button className="outline" disabled={busy} onClick={editIdentity}>Coba lagi</button>
  </div>}
  {phase==='not-member'&&<div className="panel">
   <h2>Data pembelian belum cocok</h2><p className="error">{notice}</p>
   <p className="muted">Pastikan email dan WhatsApp sama seperti saat checkout. Jika sudah membeli tetapi belum cocok, hubungi admin dengan bukti transaksi.</p>
   <button className="outline" onClick={editIdentity}>Periksa data lagi →</button>
  </div>}
  {phase==='register'&&<form className="panel stack" onSubmit={register}>
   <h2>Lengkapi registrasi sekali saja</h2>
   <p className="success">✓ Pembelian kelas sudah terverifikasi untuk {email}.</p>
   <p className="muted">Setelah terdaftar, cukup masukkan email dan WhatsApp yang sama untuk membuka link Zoom lagi, kapan pun diperlukan.</p>
   <label>Nama lengkap<input value={name} minLength={2} maxLength={150} required
    onChange={e=>setName(e.target.value)} placeholder="Nama sesuai pembelian"/></label>
   <label>Kendala jualan di ojol (opsional)
    <textarea rows={4} maxLength={2000} value={problem} onChange={e=>setProblem(e.target.value)}
     placeholder="Contoh: Toko GoFood sudah aktif tetapi belum banyak order..."/>
   </label>
   <h2>Screenshot toko (opsional)</h2>
   <p className="muted">Unggah sampai tiga screenshot, maksimal 1 MB per foto (JPG/PNG/WebP). Hindari gambar yang menampilkan data pelanggan.</p>
   {platforms.map(([id,label])=><label key={id}>Screenshot {label}
    <input type="file" accept="image/jpeg,image/png,image/webp"
     onChange={e=>setPhotos(x=>({...x,[id]:e.target.files?.[0]||null}))}/>
    {photos[id]?.size>1024*1024&&<span className="error">{label}: foto melebihi 1 MB.</span>}
   </label>)}
   <label className="option">
    <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
    <span>Saya mengizinkan nama, kendala, dan screenshot toko ditampilkan dalam sesi webinar untuk review. <strong>Tidak wajib.</strong></span>
   </label>
   <button type="submit" disabled={busy||Object.values(photos).some(f=>f?.size>1024*1024)}>
    {busy?'Mendaftarkan...':'Daftar & lihat link Zoom →'}
   </button>
   <button type="button" className="outline" disabled={busy} onClick={editIdentity}>Ubah email atau WhatsApp</button>
   {notice&&<p className="error">{notice}</p>}
  </form>}
  {phase==='done'&&<div className="panel">
   <p className="eyebrow">AKSES WEBINAR BERHASIL</p>
   <h2>🎉 Link webinar siap digunakan!</h2>
   <p>{event&&fmt(event.starts_at)}. Simpan webinar ke kalender agar tidak kelupaan.</p>
   <div className="actions" style={{justifyContent:'flex-start'}}>
    <a className="button" href={links?.calendar_url} target="_blank" rel="noopener noreferrer">
     + Tambahkan ke Google Calendar
    </a>
    <a className="button outline" href={links?.zoom_url} target="_blank" rel="noopener noreferrer">
     Buka link Zoom ↗
    </a>
   </div>
   <p className="muted">Klik <strong>Save</strong> di Google Calendar. Jadwal dan link Zoom sudah terisi otomatis.</p>
   <p className="success">Lupa link nanti? Buka halaman ini lagi, masukkan email dan WhatsApp pembelian yang sama. Tidak perlu daftar ulang.</p>
   {uploadWarning&&<p className="error">Registrasi berhasil, tetapi sebagian screenshot gagal disimpan. Silakan hubungi admin jika ingin memastikan lampiran terkirim.</p>}
  </div>}
  <footer>Hanya untuk pembeli kelas dengan transaksi lunas yang cocok di Scalev. Tidak memerlukan OTP. Screenshot disimpan privat; izin untuk ditampilkan saat webinar bersifat opsional.</footer>
 </main>;
}
