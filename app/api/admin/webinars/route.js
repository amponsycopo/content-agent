import {db,admin,validUuid,validSlug} from '../../../../lib/db';
import {noStore} from '../../../../lib/webinar';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function permitted(req){try{return await admin(req)}catch{return false}}
function goodZoom(url){
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&(u.hostname==='zoom.us'||u.hostname.endsWith('.zoom.us')||u.hostname==='zoom.com'||u.hostname.endsWith('.zoom.com'));
 }catch{return false}
}
export async function GET(req){
 if(!await permitted(req))return noStore({error:'Akses admin ditolak.'},403);
 const s=db(),p=new URL(req.url).searchParams,view=p.get('view');
 if(view==='events'){
  const {data,error}=await s.from('webinar_events').select('*,webinar_registrations(count)').order('starts_at',{ascending:false});
  return error?noStore({error:'Gagal memuat webinar.'},500):noStore({events:data});
 }
 if(view==='registrations'){
  const id=p.get('event_id');if(!validUuid(id))return noStore({error:'Webinar tidak valid.'},400);
  const {data,error}=await s.from('webinar_registrations')
   .select('*,webinar_screenshots(id,platform,filename)')
   .eq('event_id',id).order('registered_at',{ascending:false}).limit(500);
  return error?noStore({error:'Gagal mengambil peserta.'},500):noStore({registrations:data});
 }
 if(view==='screenshot'){
  const id=p.get('id');if(!validUuid(id))return noStore({error:'Screenshot tidak valid.'},400);
  const {data}=await s.from('webinar_screenshots').select('object_path').eq('id',id).maybeSingle();
  if(!data)return noStore({error:'Screenshot tidak ditemukan.'},404);
  const {data:url,error}=await s.storage.from('erlandoski-webinar-screenshots').createSignedUrl(data.object_path,60);
  return error?noStore({error:'Screenshot tidak dapat dibuka.'},500):noStore({url:url.signedUrl});
 }
 return noStore({error:'Operasi tidak dikenali.'},404);
}
export async function POST(req){
 if(!await permitted(req))return noStore({error:'Akses admin ditolak.'},403);
 try{
  const p=await req.json(),id=p.id||null;
  const slug=String(p.slug||'').trim(),title=String(p.title||'').trim();
  const description=String(p.description||'').trim(),zoom_url=String(p.zoom_url||'').trim();
  const date=new Date(p.starts_at||'');
  const minutes=Number(p.duration_minutes||90),productId=Number(p.scalev_product_id);
  const status=String(p.status||'draft');
  if((id&&!validUuid(id))||!validSlug(slug)||title.length<3||title.length>180||description.length>3000
   ||!Number.isFinite(date.getTime())||date.getUTCFullYear()<2026||!Number.isInteger(minutes)||minutes<15||minutes>480
   ||!Number.isSafeInteger(productId)||productId<1||!['draft','open','closed'].includes(status)
   ||(zoom_url&&!goodZoom(zoom_url))||(status==='open'&&!goodZoom(zoom_url))){
    return noStore({error:'Isi slug, judul, tanggal, durasi, ID produk dan link Zoom yang valid.'},400);
  }
  const values={slug,title,description,starts_at:date.toISOString(),duration_minutes:minutes,zoom_url,
   scalev_product_id:productId,status,updated_at:new Date().toISOString()};
  const s=db();
  if(id){
   const {data,error}=await s.from('webinar_events').update(values).eq('id',id).is('archived_at',null).select('id').maybeSingle();
   if(error)throw error;
   if(!data)return noStore({error:'Webinar tidak ditemukan atau masih diarsipkan. Pulihkan dahulu sebelum mengedit.'},409);
   return noStore({id});
  }
  const {data,error}=await s.from('webinar_events').insert(values).select('id').single();
  if(error)throw error;
  return noStore({id:data.id});
 }catch(err){
  console.warn('webinar_admin_save_failed',err?.code||'error');
  if(err?.code==='23505')return noStore({error:'Slug sudah dipakai webinar lain, termasuk yang diarsipkan. Gunakan slug berbeda; judul boleh sama.'},409);
  if(err?.code==='23514')return noStore({error:'Webinar arsip tidak dapat dibuka. Pulihkan dahulu sebelum mengedit.'},409);
  return noStore({error:'Gagal menyimpan webinar. Pastikan slug belum dipakai.'},500);
 }
}
export async function PATCH(req){
 if(!await permitted(req))return noStore({error:'Akses admin ditolak.'},403);
 try{
  const {id,action}=await req.json();
  if(!validUuid(id)||!['archive','restore'].includes(action))return noStore({error:'Operasi webinar tidak valid.'},400);
  const values=action==='archive'?{archived_at:new Date().toISOString(),status:'closed'}:{archived_at:null};
  const {data,error}=await db().from('webinar_events').update({...values,updated_at:new Date().toISOString()}).eq('id',id).select('id').maybeSingle();
  if(error)throw error;
  return data?noStore({id:data.id}):noStore({error:'Webinar tidak ditemukan.'},404);
 }catch{ return noStore({error:'Gagal mengubah arsip webinar.'},500) }
}
export async function DELETE(req){
 if(!await permitted(req))return noStore({error:'Akses admin ditolak.'},403);
 const id=new URL(req.url).searchParams.get('id');
 if(!validUuid(id))return noStore({error:'Webinar tidak valid.'},400);
 try{
  // The database trigger also rejects published events and drafts with participants.
  const {data,error}=await db().from('webinar_events').delete().eq('id',id).select('id').maybeSingle();
  if(error)throw error;
  return data?noStore({id:data.id}):noStore({error:'Webinar tidak ditemukan.'},404);
 }catch(err){
  if(err?.code==='23514'||err?.code==='23503')return noStore({error:'Hanya draft yang belum pernah dipublish dan belum punya peserta yang dapat dihapus. Arsipkan webinar ini.'},409);
  return noStore({error:'Gagal menghapus draft webinar.'},500);
 }
}
