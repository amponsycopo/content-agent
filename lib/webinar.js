import {db,validSlug} from './db';
export function noStore(body,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}})}
export async function member(req){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)return null;
 const {data,error}=await db().auth.getUser(token);
 if(error||!data?.user?.email||!data.user.email_confirmed_at)return null;
 return data.user;
}
export async function eventBySlug(slug){
 if(!validSlug(slug))return null;
 const {data,error}=await db().from('webinar_events').select('*').eq('slug',slug).eq('status','open').maybeSingle();
 if(error)throw Error('DATABASE_ERROR');
 return data;
}
export async function paidForProduct(email,productId){
 const key=process.env.SCALEV_API_KEY?.trim();
 if(!key)throw Error('SCALEV_API_NOT_CONFIGURED');
 if(!/^(?:sk|rk)_[A-Za-z0-9_-]+$/.test(key))throw Error('SCALEV_API_KEY_INVALID');
 const base='https://api.scalev.com/v3/orders';
 for(const status of ['paid','settled']){
  const params=new URLSearchParams({
   search:email,search_field:'customer_email',product_id:String(productId),
   payment_status:status,page_size:'25',columns:'order_id,customer,payment_status'
  });
  if(process.env.SCALEV_BUSINESS_UID)params.set('b_uid',process.env.SCALEV_BUSINESS_UID);
  let cursor='',page=0;
  do{
   if(cursor)params.set('next_cursor',cursor);
   const response=await fetch(base+'?'+params,{
    headers:{Authorization:'Bearer '+key,Accept:'application/json'},
    cache:'no-store',signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)throw Error('SCALEV_UPSTREAM_'+response.status);
   const json=await response.json();
   const body=json?.data&&Array.isArray(json.data)?json:json?.response;
   if(!body||!Array.isArray(body.data))throw Error('SCALEV_UNEXPECTED_RESPONSE');
   const match=body.data.find(o=>o?.customer?.email?.trim().toLowerCase()===email.toLowerCase()
      &&o.payment_status===status);
   if(match)return {eligible:true,order_id:match.order_id};
   cursor=body.has_next?body.next_cursor:'';
   page++;
  }while(cursor&&page<3);
 }
 return {eligible:false};
}
export function links(event){
 const url=new URL('https://calendar.google.com/calendar/render');
 url.searchParams.set('action','TEMPLATE');
 url.searchParams.set('text',event.title);
 const start=new Date(event.starts_at),end=new Date(start.getTime()+event.duration_minutes*60000);
 const format=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 url.searchParams.set('dates',format(start)+'/'+format(end));
 url.searchParams.set('details',event.description+'\n\nLink Zoom: '+event.zoom_url);
 url.searchParams.set('location',event.zoom_url);
 return {zoom_url:event.zoom_url,calendar_url:url.toString()};
}
