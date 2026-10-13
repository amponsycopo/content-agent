import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {db,admin,validUuid,validSlug} from '../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const types=['short_text','long_text','single_choice','multiple_choice','rating','number','yes_no'];
async function guard(req){try{return await admin(req)}catch{return false}}
export async function GET(req){
 if(!await guard(req))return NextResponse.json({error:'Login admin diperlukan atau akses ditolak.'},{status:403});
 const s=db(),params=new URL(req.url).searchParams,view=params.get('view');
 if(view==='campaigns'){
  const {data,error}=await s.from('bonus_campaigns').select('*,bonus_questions(*)').order('created_at',{ascending:false});
  return error?NextResponse.json({error:'Gagal memuat campaign.'},{status:500}):NextResponse.json({campaigns:data},{headers:{'Cache-Control':'no-store'}});
 }
 if(view==='submissions'){
  const {data,error}=await s.from('bonus_submissions').select('id,campaign_id,full_name,email,whatsapp,brand_name,brand_category,answers,testimonial,promo_consent,submitted_at,bonus_attachments(id,filename,attachment_kind)').order('submitted_at',{ascending:false}).limit(300);
  return error?NextResponse.json({error:'Gagal memuat testimoni.'},{status:500}):NextResponse.json({submissions:data},{headers:{'Cache-Control':'no-store'}});
 }
 if(view==='attachment'){
  const id=params.get('id');
  if(!validUuid(id))return NextResponse.json({error:'ID tidak valid.'},{status:400});
  const {data:a}=await s.from('bonus_attachments').select('storage_path').eq('id',id).single();
  if(!a)return NextResponse.json({error:'Lampiran tidak ditemukan.'},{status:404});
  const {data:r,error}=await s.storage.from('erlandoski-bonus-testimonials').createSignedUrl(a.storage_path,60);
  return error?NextResponse.json({error:'Gagal membuka.'},{status:500}):NextResponse.json({url:r.signedUrl});
 }
 return NextResponse.json({error:'Operasi tidak dikenali.'},{status:404});
}
export async function POST(req){
 if(!await guard(req))return NextResponse.json({error:'Akses ditolak.'},{status:403});
 const s=db(),action=new URL(req.url).searchParams.get('action');
 if(action==='upload'){
  try{
   const f=await req.formData(),id=f.get('campaign_id'),file=f.get('file');
   const allowed={'application/pdf':'pdf','application/zip':'zip','application/x-zip-compressed':'zip','text/csv':'csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
   if(!validUuid(id)||!(file instanceof File)||file.size<1||file.size>3*1024*1024||!allowed[file.type])return NextResponse.json({error:'Pilih file PDF/ZIP/XLSX/CSV/DOCX maksimal 3 MB.'},{status:400});
   const {data:c}=await s.from('bonus_campaigns').select('id').eq('id',id).single();if(!c)return NextResponse.json({error:'Campaign tidak ditemukan.'},{status:404});
   const path=id+'/'+randomBytes(16).toString('hex')+'.'+allowed[file.type];
   const {error:e}=await s.storage.from('erlandoski-bonus-rewards').upload(path,await file.arrayBuffer(),{contentType:file.type});
   if(e)throw e;
   const {error:u}=await s.from('bonus_campaigns').update({reward_storage_path:path,reward_filename:file.name.slice(0,200)}).eq('id',id);
   if(u)throw u;
   return NextResponse.json({ok:true,filename:file.name});
  }catch{return NextResponse.json({error:'Upload bonus gagal.'},{status:500})}
 }
 if(action==='save'){
  try{
   const p=await req.json(),id=p.id||null,slug=String(p.slug||'').toLowerCase().trim(),title=String(p.title||'').trim(),product_name=String(p.product_name||'').trim(),description=String(p.description||'').trim(),status=String(p.status||'draft'),questions=p.questions;
   if(!validSlug(slug)||!title||!product_name||title.length>200||product_name.length>150||description.length>3000||!['draft','active','archived'].includes(status)||!Array.isArray(questions)||questions.length<1||questions.length>30)return NextResponse.json({error:'Campaign tidak lengkap.'},{status:400});
   if(questions.some(q=>!q.prompt||typeof q.prompt!=='string'||q.prompt.length>600||!types.includes(q.input_type)||![2,3,4].includes(Number(q.step))||typeof q.is_required!=='boolean'||!Array.isArray(q.options)||q.options.length>30||q.options.some(x=>typeof x!=='string'||x.length>150)))return NextResponse.json({error:'Pertanyaan tidak valid.'},{status:400});
   if(id&&!validUuid(id))return NextResponse.json({error:'ID tidak valid.'},{status:400});
   let current=null;
   if(id){const {data}=await s.from('bonus_campaigns').select('reward_storage_path').eq('id',id).single();current=data;if(!data)return NextResponse.json({error:'Campaign tidak ditemukan.'},{status:404})}
   if(status==='active'&&!current?.reward_storage_path)return NextResponse.json({error:'Upload file bonus dulu sebelum mengaktifkan.'},{status:400});
   const values={slug,title,product_name,description,status,updated_at:new Date().toISOString()};
   let campaignId=id;
   if(id){
    const {error:e}=await s.from('bonus_campaigns').update(values).eq('id',id);if(e)throw e;
    const {error:de}=await s.from('bonus_questions').delete().eq('campaign_id',id);if(de)throw de;
   }else{
    const {data,error:e}=await s.from('bonus_campaigns').insert(values).select('id').single();if(e)throw e;campaignId=data.id;
   }
   const rows=questions.map((q,i)=>({campaign_id:campaignId,position:i,step:Number(q.step),prompt:q.prompt.trim(),help_text:String(q.help_text||'').slice(0,500),input_type:q.input_type,options:q.options,is_required:q.is_required}));
   const {error:qe}=await s.from('bonus_questions').insert(rows);
   if(qe){await s.from('bonus_campaigns').update({status:'draft'}).eq('id',campaignId);throw qe}
   return NextResponse.json({id:campaignId});
  }catch{return NextResponse.json({error:'Gagal menyimpan campaign. Periksa slug dan formulir.'},{status:500})}
 }
 return NextResponse.json({error:'Operasi tidak dikenali.'},{status:404});
}
