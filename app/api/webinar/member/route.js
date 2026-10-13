import {member,eventBySlug,paidForProduct,links,noStore} from '../../../../lib/webinar';
import {db} from '../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req){
 try{
  const user=await member(req);
  if(!user)return noStore({error:'Verifikasi email diperlukan.'},401);
  const p=await req.json();
  const event=await eventBySlug(p.slug);
  if(!event)return noStore({error:'Registrasi webinar tidak tersedia.'},404);
  const order=await paidForProduct(user.email,event.scalev_product_id);
  if(!order.eligible)return noStore({eligible:false,message:'Belum ditemukan pembelian kelas berstatus lunas untuk email ini. Pastikan memakai email yang digunakan saat checkout.'},200);
  const {data:reg,error}=await db().from('webinar_registrations')
    .select('id').eq('event_id',event.id).eq('email',user.email.toLowerCase()).maybeSingle();
  if(error)throw Error('REGISTRATION_READ_FAILED');
  return noStore({eligible:true,registered:!!reg,...(reg?links(event):{})});
 }catch(err){
  console.warn('webinar_member_check_failed',err?.message||'error');
  return noStore({error:'Verifikasi transaksi sedang tidak tersedia. Silakan coba lagi beberapa saat.'},503);
 }
}
