import {createHmac} from 'node:crypto';
import {db,validSlug} from './db';

export function noStore(body,status=200){
 return Response.json(body,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
}
export function normalizeEmail(value){
 const email=String(value||'').trim().toLowerCase();
 return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
export function normalizePhone(value){
 const raw=String(value||'').trim();
 if(!/^\+?[\d\s()-]{9,30}$/.test(raw))return null;
 let digits=raw.replace(/\D/g,'');
 if(digits.startsWith('0'))digits='62'+digits.slice(1);
 else if(digits.startsWith('8'))digits='62'+digits;
 return /^628\d{7,12}$/.test(digits)?digits:null;
}
export async function eventBySlug(slug,{allowClosed=false}={}){
 if(!validSlug(slug))return null;
 let query=db().from('webinar_events').select('*').eq('slug',slug);
 query=allowClosed?query.in('status',['open','closed']):query.eq('status','open');
 const {data,error}=await query.maybeSingle();
 if(error)throw Error('WEBINAR_DB_ERROR');
 return data;
}
export async function allowAttempt(req,email,phone){
 // Atomic counters shared across Vercel instances. No cleartext IP or identity is persisted.
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!secret)throw Error('WEBINAR_SERVER_KEY_MISSING');
 const hashed=value=>createHmac('sha256',secret).update('webinar:v1:'+value).digest('hex');
 const ip=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'unknown').split(',')[0].trim().slice(0,64);
 const limits=[
  {key:'ip:'+ip,max:100,minutes:60},
  {key:'email:'+email,max:20,minutes:60},
  {key:'pair:'+email+':'+phone,max:12,minutes:60}
 ];
 for(const entry of limits){
  const {data,error}=await db().rpc('webinar_note_attempt',{
   p_key_hash:hashed(entry.key),p_limit:entry.max,p_window_minutes:entry.minutes
  });
  if(error)throw Error('WEBINAR_RATE_LIMIT_ERROR');
  if(data!==true)return false;
 }
 return true;
}
export async function paidForProduct(email,phone,productId){
 const key=process.env.SCALEV_API_KEY?.trim();
 if(!key)throw Error('SCALEV_API_NOT_CONFIGURED');
 const base='https://api.scalev.com/v3/orders';
 for(const status of ['paid','settled']){
  const query=new URLSearchParams({
   search:email,search_field:'customer_email',
   product_id:String(productId),payment_status:status,
   page_size:'25',columns:'order_id,customer,payment_status'
  });
  if(process.env.SCALEV_BUSINESS_UID)query.set('b_uid',process.env.SCALEV_BUSINESS_UID);
  let cursor='',page=0;
  do{
   if(cursor)query.set('next_cursor',cursor);
   const response=await fetch(base+'?'+query.toString(),{
    headers:{Authorization:'Bearer '+key,Accept:'application/json'},
    cache:'no-store',signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)throw Error('SCALEV_UPSTREAM_'+response.status);
   const json=await response.json();
   const result=Array.isArray(json?.data)?json:json?.response;
   if(!Array.isArray(result?.data))throw Error('SCALEV_UNEXPECTED_RESPONSE');
   const found=result.data.find(o=>
    normalizeEmail(o?.customer?.email)===email
    &&normalizePhone(o?.customer?.phone)===phone
    &&o?.payment_status===status
    &&typeof o?.order_id==='string'
   );
   if(found){
    return {eligible:true,order_id:found.order_id,
     full_name:String(found.customer?.name||'').trim().slice(0,150)};
   }
   cursor=result.has_next&&typeof result.next_cursor==='string'?result.next_cursor:'';
   page++;
  }while(cursor&&page<4);
 }
 return {eligible:false};
}
export async function existingRegistration(eventId,email,phone){
 const s=db();
 const [a,b]=await Promise.all([
  s.from('webinar_registrations').select('id,email,whatsapp_normalized').eq('event_id',eventId).eq('email',email).maybeSingle(),
  s.from('webinar_registrations').select('id,email,whatsapp_normalized').eq('event_id',eventId).eq('whatsapp_normalized',phone).maybeSingle()
 ]);
 if(a.error||b.error)throw Error('WEBINAR_REGISTRATION_LOOKUP_FAILED');
 if(!a.data&&!b.data)return {registered:false,conflict:false};
 if(a.data?.email===email&&a.data?.whatsapp_normalized===phone&&b.data?.id===a.data.id)
  return {registered:true,conflict:false};
 return {registered:false,conflict:true};
}
export function links(event){
 const url=new URL('https://calendar.google.com/calendar/render');
 url.searchParams.set('action','TEMPLATE');
 url.searchParams.set('text',event.title);
 const start=new Date(event.starts_at),end=new Date(start.getTime()+event.duration_minutes*60000);
 const format=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 url.searchParams.set('dates',format(start)+'/'+format(end));
 url.searchParams.set('details',(event.description||'')+'\n\nLink Zoom webinar:\n'+event.zoom_url);
 url.searchParams.set('location',event.zoom_url);
 return {zoom_url:event.zoom_url,calendar_url:url.toString()};
}
