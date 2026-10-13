import {randomUUID} from 'node:crypto';
import {db} from '../../../../lib/db';
import {member,eventBySlug,paidForProduct,links,noStore} from '../../../../lib/webinar';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const platforms=['gofood','grabfood','shopeefood'];
const types={'image/jpeg':[0xff,0xd8,0xff],'image/png':[0x89,0x50,0x4e,0x47],'image/webp':[0x52,0x49,0x46,0x46]};
function validImage(bytes,mime){
 const signature=types[mime];return signature&&signature.every((b,i)=>bytes[i]===b);
}
export async function POST(req){
 try{
  const user=await member(req);
  if(!user)return noStore({error:'Verifikasi email diperlukan.'},401);
  const size=Number(req.headers.get('content-length')||0);
  if(size>3.8*1024*1024)return noStore({error:'Ukuran total upload terlalu besar (maksimal 3 MB foto).'},413);
  if(!(req.headers.get('content-type')||'').startsWith('multipart/form-data'))
   return noStore({error:'Format pengiriman salah.'},415);
  const form=await req.formData();
  const slug=String(form.get('slug')||''),event=await eventBySlug(slug);
  if(!event)return noStore({error:'Pendaftaran webinar ditutup.'},404);
  const name=String(form.get('name')||'').trim(),whatsapp=String(form.get('whatsapp')||'').trim();
  const problem=String(form.get('problem')||'').trim();
  const consent=form.get('review_consent')==='true';
  if(name.length<2||name.length>150||! /^\+?[\d\s()-]{8,25}$/.test(whatsapp)||problem.length>2000)
   return noStore({error:'Nama, WhatsApp, atau cerita kendala belum valid.'},400);
  const files=[];
  for(const platform of platforms){
   const f=form.get(platform);
   if(!f||!(f instanceof File)||f.size===0)continue;
   if(!types[f.type]||f.size>1024*1024)return noStore({error:'Screenshot harus JPG, PNG atau WebP maksimal 1 MB per platform.'},400);
   const bytes=new Uint8Array(await f.arrayBuffer());
   if(!validImage(bytes,f.type))return noStore({error:'Screenshot tidak sesuai format gambar.'},400);
   files.push({platform,file:f,bytes});
  }
  const result=await paidForProduct(user.email,event.scalev_product_id);
  if(!result.eligible)return noStore({error:'Pembelian kelas lunas tidak ditemukan untuk email ini.'},403);
  const s=db(),email=user.email.toLowerCase();
  const {data:existing,error:existingError}=await s.from('webinar_registrations').select('id')
   .eq('event_id',event.id).eq('email',email).maybeSingle();
  if(existingError)throw Error('REGISTRATION_READ_FAILED');
  if(existing)return noStore({registered:true,...links(event)});
  const {data:registration,error:insertError}=await s.from('webinar_registrations').insert({
   event_id:event.id,auth_user_id:user.id,email,full_name:name,whatsapp,problem,
   review_consent:consent
  }).select('id').single();
  if(insertError){
   // Concurrent registration may have passed preflight; don't reveal Zoom until a matching record exists.
   if(insertError.code==='23505'){
    const {data:found}=await s.from('webinar_registrations').select('id')
     .eq('event_id',event.id).eq('email',email).maybeSingle();
    if(found)return noStore({registered:true,...links(event)});
   }
   throw Error('REGISTRATION_SAVE_FAILED');
  }
  for(const item of files){
   const ext=item.file.type==='image/png'?'png':item.file.type==='image/webp'?'webp':'jpg';
   const path=registration.id+'/'+item.platform+'-'+randomUUID()+'.'+ext;
   const {error:uploadError}=await s.storage.from('erlandoski-webinar-screenshots').upload(
    path,item.bytes,{contentType:item.file.type,upsert:false}
   );
   if(uploadError){console.warn('webinar_upload_failed',item.platform);continue}
   const {error:rowError}=await s.from('webinar_screenshots').insert({
    registration_id:registration.id,platform:item.platform,object_path:path,
    filename:item.file.name.slice(0,250),content_type:item.file.type,size_bytes:item.file.size
   });
   if(rowError)console.warn('webinar_screenshot_metadata_failed',item.platform);
  }
  return noStore({registered:true,...links(event)});
 }catch(err){
  console.error('webinar_registration_failed',err?.message||'error');
  return noStore({error:'Registrasi gagal diproses. Coba lagi beberapa saat.'},503);
 }
}
