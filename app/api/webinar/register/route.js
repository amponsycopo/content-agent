import {randomUUID} from 'node:crypto';
import {db} from '../../../../lib/db';
import {eventBySlug,normalizeEmail,normalizePhone,paidForProduct,existingRegistration,allowAttempt,links,noStore} from '../../../../lib/webinar';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const platforms=['gofood','grabfood','shopeefood'];
const types={'image/jpeg':[0xff,0xd8,0xff],'image/png':[0x89,0x50,0x4e,0x47],'image/webp':[0x52,0x49,0x46,0x46]};
function validImage(bytes,mime){
 const signature=types[mime];
 if(!signature||!signature.every((b,i)=>bytes[i]===b))return false;
 if(mime==='image/webp')return String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(mime==='image/png')return bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
 return true;
}
export async function POST(req){
 try{
  const size=Number(req.headers.get('content-length')||0);
  if(size>3.8*1024*1024)return noStore({error:'Ukuran upload maksimal 3 MB total.'},413);
  if(!(req.headers.get('content-type')||'').startsWith('multipart/form-data'))
   return noStore({error:'Format pengiriman tidak didukung.'},415);
  const form=await req.formData();
  const email=normalizeEmail(form.get('email')),phone=normalizePhone(form.get('whatsapp'));
  if(!email||!phone)return noStore({error:'Email dan WhatsApp tidak valid.'},400);
  const event=await eventBySlug(String(form.get('slug')||''),{allowClosed:true});
  if(!event)return noStore({error:'Webinar tidak tersedia.'},404);
  if(!await allowAttempt(req,email,phone))
   return noStore({error:'Terlalu banyak percobaan. Coba lagi sekitar satu jam lagi.'},429);
  // Reverify on the write endpoint. The preceding lookup is not a grant.
  const order=await paidForProduct(email,phone,event.scalev_product_id);
  if(!order.eligible)return noStore({error:'Data pembelian tidak cocok. Pastikan email dan WhatsApp pembelian benar.'},403);
  const existing=await existingRegistration(event.id,email,phone);
  if(existing.conflict)return noStore({error:'Registrasi dengan salah satu data ini sudah tercatat berbeda. Hubungi admin.'},409);
  if(existing.registered)return noStore({registered:true,...links(event)});
  if(event.status!=='open')return noStore({error:'Pendaftaran webinar sudah ditutup.'},403);

  const name=String(form.get('name')||order.full_name||'').trim();
  const problem=String(form.get('problem')||'').trim();
  const consent=form.get('review_consent')==='true';
  if(name.length<2||name.length>150||problem.length>2000)return noStore({error:'Nama atau cerita kendala tidak valid.'},400);
  const files=[];
  for(const platform of platforms){
   const f=form.get(platform);
   if(!f||!(f instanceof File)||f.size===0)continue;
   if(!types[f.type]||f.size>1024*1024)return noStore({error:'Screenshot hanya JPG/PNG/WebP maksimal 1 MB per file.'},400);
   const bytes=new Uint8Array(await f.arrayBuffer());
   if(!validImage(bytes,f.type))return noStore({error:'Screenshot tidak sesuai format gambar.'},400);
   files.push({platform,file:f,bytes});
  }
  const s=db();
  const {data:registration,error:insertError}=await s.from('webinar_registrations').insert({
   event_id:event.id,auth_user_id:null,email,full_name:name,
   whatsapp:phone,whatsapp_normalized:phone,scalev_order_id:order.order_id,
   problem,review_consent:consent
  }).select('id').single();
  if(insertError){
   if(insertError.code==='23505'){
    const again=await existingRegistration(event.id,email,phone);
    if(again.registered)return noStore({registered:true,...links(event)});
    return noStore({error:'Registrasi sudah tercatat dengan data berbeda. Hubungi admin.'},409);
   }
   throw Error('WEBINAR_REGISTRATION_INSERT_FAILED');
  }
  let uploadWarning=false;
  for(const item of files){
   const ext=item.file.type==='image/png'?'png':item.file.type==='image/webp'?'webp':'jpg';
   const path=registration.id+'/'+item.platform+'-'+randomUUID()+'.'+ext;
   const {error:uploadError}=await s.storage.from('erlandoski-webinar-screenshots').upload(
    path,item.bytes,{contentType:item.file.type,upsert:false}
   );
   if(uploadError){uploadWarning=true;console.warn('webinar_image_upload_failed',item.platform);continue}
   const {error:rowError}=await s.from('webinar_screenshots').insert({
    registration_id:registration.id,platform:item.platform,object_path:path,
    filename:item.file.name.slice(0,250),content_type:item.file.type,size_bytes:item.file.size
   });
   if(rowError){uploadWarning=true;console.warn('webinar_image_metadata_failed',item.platform)}
  }
  return noStore({registered:true,upload_warning:uploadWarning,...links(event)});
 }catch(err){
  console.warn('webinar_registration_failed',err?.message||'error');
  return noStore({error:'Registrasi sedang tidak bisa diproses. Silakan coba lagi.'},503);
 }
}
