import {eventBySlug,noStore} from '../../../../lib/webinar';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_req,{params}){
 try{
  const {slug}=await params;
  const e=await eventBySlug(slug,{allowClosed:true});
  if(!e)return noStore({error:'Webinar tidak tersedia.'},404);
  return noStore({event:{
   slug:e.slug,title:e.title,description:e.description,
   starts_at:e.starts_at,duration_minutes:e.duration_minutes,
   registration_open:e.status==='open'
  }});
 }catch{return noStore({error:'Gagal memuat webinar.'},503)}
}
