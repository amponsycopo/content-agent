import {eventBySlug,normalizeEmail,normalizePhone,paidForProduct,existingRegistration,allowAttempt,links,noStore} from '../../../../lib/webinar';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req){
 try{
  if(Number(req.headers.get('content-length')||0)>4096)
   return noStore({error:'Data terlalu panjang.'},413);
  const p=await req.json();
  const email=normalizeEmail(p.email),phone=normalizePhone(p.whatsapp);
  if(!email||!phone)return noStore({error:'Isi email pembelian dan nomor WhatsApp yang valid.'},400);
  const event=await eventBySlug(p.slug,{allowClosed:true});
  if(!event)return noStore({error:'Webinar tidak tersedia.'},404);
  if(!await allowAttempt(req,email,phone))
   return noStore({error:'Terlalu banyak percobaan. Coba lagi sekitar satu jam lagi.'},429);
  const order=await paidForProduct(email,phone,event.scalev_product_id);
  if(!order.eligible)return noStore({eligible:false,message:'Data pembelian tidak cocok. Pastikan email dan WhatsApp sama dengan yang dipakai saat checkout.'});
  const claim=await existingRegistration(event.id,email,phone);
  if(claim.conflict)return noStore({error:'Registrasi dengan salah satu data ini sudah tercatat berbeda. Hubungi admin untuk bantuan.'},409);
  if(claim.registered)return noStore({eligible:true,registered:true,...links(event)});
  if(event.status!=='open')return noStore({error:'Pendaftaran webinar ini sudah ditutup.'},403);
  return noStore({eligible:true,registered:false,full_name:order.full_name||''});
 }catch(err){
  console.warn('webinar_member_check_failed',err?.message||'error');
  return noStore({error:'Pemeriksaan transaksi sedang tidak tersedia. Silakan coba lagi.'},503);
 }
}
