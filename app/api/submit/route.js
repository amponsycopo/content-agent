import {NextResponse} from 'next/server';
import {randomBytes,createHash} from 'node:crypto';
import {db,validSlug} from '../../../lib/db';
import {checkFeedbackQuality} from '../../../lib/feedback-quality';
export const runtime='nodejs';
const CATEGORY=['Makanan berat','Camilan & snack','Minuman','Bakery & dessert','Frozen food','Lainnya','Belum menentukan produk'];
const IMAGES=['image/png','image/jpeg','image/webp'];
const MIN_ESSAY=50;
const countText=value=>String(value??'').trim().replace(/\s+/g,' ').length;
function validateQuestions(questions,answers){
 const snapshot={};
 for(const q of questions){
  const value=answers[q.id];
  const blank=value===undefined||value===null||(typeof value==='string'&&!value.trim())||(Array.isArray(value)&&!value.length);
  if(blank){if(q.is_required)throw Error('Jawab dulu: '+q.prompt);continue}
  if(q.input_type==='single_choice'&&(!Array.isArray(q.options)||!q.options.includes(value)))throw Error('Pilihan tidak valid.');
  if(q.input_type==='multiple_choice'&&(!Array.isArray(value)||value.length>20||value.some(v=>!q.options.includes(v))))throw Error('Pilihan tidak valid.');
  if(q.input_type==='rating'&&(!Number.isInteger(value)||value<1||value>5))throw Error('Rating tidak valid.');
  if(q.input_type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Angka tidak valid.');
  if(q.input_type==='yes_no'&&typeof value!=='boolean')throw Error('Ya/tidak tidak valid.');
  if(['short_text','long_text'].includes(q.input_type)&&(typeof value!=='string'||value.length>(q.input_type==='long_text'?3000:500)))throw Error('Jawaban tidak valid.');
  if(q.input_type==='long_text'&&countText(value)<MIN_ESSAY)throw Error('Jawaban esai minimal 50 karakter: '+q.prompt);
  snapshot[q.id]={question:q.prompt,answer:value};
 }
 return snapshot;
}
export async function POST(req){
 try{
  if(!(req.headers.get('content-type')||'').startsWith('multipart/form-data'))return NextResponse.json({error:'Format tidak valid.'},{status:415});
  const form=await req.formData();const raw=form.get('data');
  if(typeof raw!=='string'||raw.length>50000)return NextResponse.json({error:'Data terlalu besar.'},{status:400});
  const p=JSON.parse(raw);
  if(p.website)return NextResponse.json({error:'Permintaan tidak valid.'},{status:400});
  const name=String(p.full_name||'').trim(),wa=String(p.whatsapp||'').trim(),email=String(p.email||'').trim().toLowerCase(),brand=String(p.brand_name||'').trim(),category=String(p.brand_category||''),testimonial=String(p.testimonial||'').trim();
  if(!validSlug(p.slug)||name.length<2||name.length>150||!/^\+?[\d\s()-]{8,25}$/.test(wa)||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||brand.length>150||!CATEGORY.includes(category))return NextResponse.json({error:'Periksa nama, WhatsApp, dan kategori produk.'},{status:400});
  if(countText(testimonial)<MIN_ESSAY||testimonial.length>5000)return NextResponse.json({error:'Kesan kelas harus berisi minimal 50 karakter.'},{status:400});
  const photo=form.get('brand_photo');
  if(photo&&(!(photo instanceof File)||!IMAGES.includes(photo.type)||photo.size>3*1024*1024))return NextResponse.json({error:'Foto harus JPG, PNG, atau WebP maksimal 3 MB.'},{status:400});
  const s=db(),{data:c}=await s.from('bonus_campaigns').select('id,reward_storage_path,status').eq('slug',p.slug).single();
  if(!c||c.status!=='active'||!c.reward_storage_path)return NextResponse.json({error:'Program belum aktif.'},{status:404});
  const {data:q,error:qe}=await s.from('bonus_questions').select('id,prompt,input_type,options,is_required').eq('campaign_id',c.id);
  if(qe||!q)throw Error('Gagal mengambil pertanyaan.');
  const answers=p.answers&&typeof p.answers==='object'&&!Array.isArray(p.answers)?p.answers:{};
  let snapshot;try{snapshot=validateQuestions(q,answers)}catch(e){return NextResponse.json({error:e.message},{status:400})}
  const {count}=await s.from('bonus_submissions').select('id',{count:'exact',head:true}).eq('campaign_id',c.id).eq('whatsapp',wa);
  if((count||0)>=3)return NextResponse.json({error:'Nomor ini sudah mencapai batas pengiriman.'},{status:429});
  // Check essay content BEFORE storing a submission or issuing a reward token.
  // Do not send member names, WhatsApp numbers, emails, brand photos or consent to Groq.
  const essayItems=q.filter(item=>item.input_type==='long_text'&&typeof answers[item.id]==='string'&&answers[item.id].trim())
    .map(item=>({id:item.id,question:item.prompt,answer:answers[item.id].trim()}));
  essayItems.push({id:'testimonial',question:'Bagaimana pengalaman mengikuti kelas ini?',answer:testimonial});
  const quality=await checkFeedbackQuality(essayItems);
  if(!quality.ok)return NextResponse.json({
    error:quality.message,field_id:quality.field_id
  },{status:422});
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex'),consent=p.promo_consent===true;
  const {data:sub,error:se}=await s.from('bonus_submissions').insert({campaign_id:c.id,full_name:name,email:email||null,whatsapp:wa,brand_name:brand||null,brand_category:category,profile_completed_at:new Date().toISOString(),answers:snapshot,testimonial,promo_consent:consent,consent_given_at:consent?new Date().toISOString():null,unlock_token_sha256:hash}).select('id').single();
  if(se||!sub)throw Error('Gagal menyimpan jawaban.');
  if(photo instanceof File&&photo.size){
   const ext=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':'jpg';
   const path=sub.id+'/'+randomBytes(12).toString('hex')+'.'+ext;
   const {error:uploadErr}=await s.storage.from('erlandoski-bonus-testimonials').upload(path,await photo.arrayBuffer(),{contentType:photo.type});
   if(!uploadErr)await s.from('bonus_attachments').insert({submission_id:sub.id,storage_path:path,filename:photo.name.slice(0,255),content_type:photo.type,file_size_bytes:photo.size,attachment_kind:'brand_photo'});
  }
  const {data:reward,error:re}=await s.storage.from('erlandoski-bonus-rewards').createSignedUrl(c.reward_storage_path,90);
  return NextResponse.json({submission_id:sub.id,unlock_token:token,reward_url:re?null:reward?.signedUrl||null},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Gagal mengirim jawaban, silakan coba kembali.'},{status:500})}
}
