'use client';
import {useEffect,useMemo,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
const steps=[['Kenalan dulu','Isi data diri dan cerita singkat tentang brand atau produk.'],['Sebelum ikut kelas','Ceritakan titik awal perjalanan bisnismu.'],['Setelah ikut kelas','Apa yang dipelajari, dipraktikkan, dan dirasakan?'],['Evaluasi & harapan','Review jujurmu membantu kelas menjadi lebih baik.']];
const categories=['Makanan berat','Camilan & snack','Minuman','Bakery & dessert','Frozen food','Lainnya','Belum menentukan produk'];
const IMG=['image/jpeg','image/png','image/webp'];
export default function BonusForm(){
 const {slug}=useParams(),[campaign,setCampaign]=useState(null),[questions,setQuestions]=useState([]),[stage,setStage]=useState(0),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(''),[wa,setWa]=useState(''),[email,setEmail]=useState(''),[brand,setBrand]=useState(''),[category,setCategory]=useState(''),[photo,setPhoto]=useState(null);
 const [answers,setAnswers]=useState({}),[testimonial,setTestimonial]=useState(''),[consent,setConsent]=useState(false),[receipt,setReceipt]=useState(null);
 const currentQuestions=useMemo(()=>questions.filter(q=>q.step===stage+1),[questions,stage]);
 useEffect(()=>{
  let alive=true;
  fetch('/api/campaign/'+encodeURIComponent(slug),{cache:'no-store'})
   .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Tidak tersedia.');return j})
   .then(j=>{if(alive){setCampaign(j.campaign);setQuestions(j.questions||[]);try{const saved=localStorage.getItem('bonus-receipt:'+slug);if(saved)setReceipt(JSON.parse(saved))}catch{}}})
   .catch(e=>{if(alive)setError(e.message)})
   .finally(()=>{if(alive)setLoading(false)});
  return ()=>{alive=false};
 },[slug]);
 function answer(id,value){setAnswers(old=>({...old,[id]:value}))}
 function filled(value){return value!==undefined&&value!==null&&value!==''&&(!Array.isArray(value)||value.length>0)}
 function check(){
  if(stage===0){
   if(name.trim().length<2)return 'Isi nama lengkap dulu.';
   if(!/^\+?[\d\s()-]{8,25}$/.test(wa.trim()))return 'Nomor WhatsApp tidak valid.';
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return 'Email tidak valid.';
   if(!category)return 'Pilih kategori produk, termasuk jika belum menentukan produk.';
   if(photo&&(!IMG.includes(photo.type)||photo.size>3*1024*1024))return 'Foto maksimal 3 MB, berformat JPG, PNG atau WebP.';
  }
  for(const q of currentQuestions){if(q.is_required&&!filled(answers[q.id]))return 'Jawab dulu: '+q.prompt}
  if(stage===3&&testimonial.trim().length<12)return 'Tulis kesan atau kritik minimal 12 karakter.';
  return '';
 }
 function go(next){setError('');setStage(next);window.scrollTo({top:0,behavior:'smooth'})}
 function next(){const issue=check();if(issue){setError(issue);return}go(Math.min(stage+1,3))}
 async function submit(){
  const issue=check();if(issue){setError(issue);return}
  setSaving(true);setError('');
  try{
   const data={slug,full_name:name,whatsapp:wa,email,brand_name:brand,brand_category:category,testimonial,promo_consent:consent,answers,website:''};
   const f=new FormData();f.set('data',JSON.stringify(data));if(photo)f.set('brand_photo',photo);
   const r=await fetch('/api/submit',{method:'POST',body:f});const j=await r.json();if(!r.ok)throw Error(j.error||'Gagal mengirim jawaban.');
   setReceipt(j);localStorage.setItem('bonus-receipt:'+slug,JSON.stringify(j));window.scrollTo({top:0,behavior:'smooth'});
  }catch(e){setError(e.message)}finally{setSaving(false)}
 }
 async function download(){
  if(!receipt)return;
  try{
   const r=await fetch('/api/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submission_id:receipt.submission_id,unlock_token:receipt.unlock_token})});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Link unduhan gagal.');window.location.assign(j.reward_url);
  }catch(e){setError(e.message)}
 }
 function renderQuestion(q){
  const value=answers[q.id],choices=Array.isArray(q.options)?q.options:[];
  let field=null;
  if(q.input_type==='long_text')field=<textarea rows={4} value={value||''} onChange={e=>answer(q.id,e.target.value)} placeholder="Tulis pengalamanmu di sini"/>;
  else if(q.input_type==='short_text')field=<input value={value||''} onChange={e=>answer(q.id,e.target.value)}/>;
  else if(q.input_type==='number')field=<input type="number" value={value??''} onChange={e=>answer(q.id,e.target.value===''?'':Number(e.target.value))}/>;
  else if(q.input_type==='rating')field=<div className="actions" style={{justifyContent:'flex-start'}}>{[1,2,3,4,5].map(n=><button type="button" key={n} className={value===n?'':'outline'} onClick={()=>answer(q.id,n)}>{n}</button>)}</div>;
  else if(q.input_type==='yes_no')field=<div>{[[true,'Sudah / Ya'],[false,'Belum / Tidak']].map(([v,title])=><label className="option" key={title}><input type="radio" checked={value===v} onChange={()=>answer(q.id,v)}/>{title}</label>)}</div>;
  else if(q.input_type==='single_choice')field=<div>{choices.map(v=><label className="option" key={v}><input type="radio" checked={value===v} onChange={()=>answer(q.id,v)}/>{v}</label>)}</div>;
  else if(q.input_type==='multiple_choice')field=<div>{choices.map(v=><label className="option" key={v}><input type="checkbox" checked={Array.isArray(value)&&value.includes(v)} onChange={e=>answer(q.id,e.target.checked?[...(Array.isArray(value)?value:[]),v]:(Array.isArray(value)?value:[]).filter(x=>x!==v))}/>{v}</label>)}</div>;
  return <div className="question" key={q.id}><label><strong>{q.prompt}{q.is_required?' *':''}</strong>{q.help_text&&<span className="muted">{q.help_text}</span>}</label>{field}</div>;
 }
 return <main className="wrap"><header className="nav"><Link href="/" style={{textDecoration:'none',color:'inherit'}}><strong>ERLAN<span className="accent">.</span></strong></Link><span>BONUS MEMBER</span></header>
 {loading?<div className="panel">Memuat kuesioner...</div>:
 !campaign?<div className="panel"><h2>Program bonus belum tersedia</h2><p>{error||'Silakan hubungi admin kelas.'}</p><Link href="/">Kembali</Link></div>:
 receipt?<div className="hero"><p className="eyebrow">SELESAI</p><h1>Terima kasih sudah berbagi!</h1><p>{campaign.success_message||'Masukanmu sangat berarti.'}</p><div className="panel"><h2>🎁 Bonus sudah terbuka</h2><p>File bonus bisa diunduh sekarang. Jika link kedaluwarsa, tombol ini akan membuat link baru secara otomatis.</p><button onClick={download}>Download bonus ↓</button>{error&&<p className="error">{error}</p>}</div></div>:
 <><section className="hero"><p className="eyebrow">KUESIONER MEMBER · {campaign.product_name}</p><h1>{campaign.title}</h1><p>{campaign.description}</p><div className="progress">{steps.map((_s,i)=><i key={i} className={i<=stage?'on':''}/>)}</div><p className="muted">Halaman {stage+1} dari 4</p></section>
 <div className="panel"><h2>{steps[stage][0]}</h2><p className="muted">{steps[stage][1]}</p>
 {stage===0&&<div className="stack"><div className="grid2"><label>Nama lengkap *<input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama member"/></label><label>Nomor WhatsApp *<input type="tel" value={wa} onChange={e=>setWa(e.target.value)} placeholder="08xxxxxxxxxx"/></label></div>
 <label>Nama brand / usaha<input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Kosongkan jika belum punya usaha"/></label>
 <label>Kategori produk *<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Pilih kategori</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
 <label>Logo atau foto makanan/produk (opsional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/><span className="muted">Maksimal 3 MB. Bisa dilewati jika belum punya usaha.</span></label>
 <label>Email (opsional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com"/></label></div>}
 {stage!==0&&<div>{currentQuestions.map(renderQuestion)}</div>}
 {stage===3&&<div className="stack"><label>Kalau disuruh menceritakan pengalaman ikut kelas ini, apa yang ingin disampaikan? *<textarea rows={4} value={testimonial} onChange={e=>setTestimonial(e.target.value)} placeholder="Pengalaman apa adanya, boleh positif, biasa saja, atau kritik."/></label>
 <label className="option"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Saya mengizinkan pengalaman/testimoni dan foto yang saya kirim digunakan untuk materi promosi kelas. <strong>Opsional</strong>—bonus tetap diberikan meskipun tidak dicentang.</span></label></div>}
 {error&&<p className="error">{error}</p>}
 <div className="actions">{stage>0?<button type="button" className="outline" disabled={saving} onClick={()=>go(stage-1)}>← Kembali</button>:<span/>}{stage<3?<button type="button" onClick={next}>Lanjut →</button>:<button type="button" disabled={saving} onClick={submit}>{saving?'Menyimpan...':'Kirim jawaban & buka bonus →'}</button>}</div></div></>}
 <footer>Data pribadi hanya dipakai untuk pengelolaan kelas dan bonus. Izin promosi bersifat opsional.</footer></main>;
}
