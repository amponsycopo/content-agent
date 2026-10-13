import {createClient} from '@supabase/supabase-js';
export function db(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw Error('SUPABASE_SERVER_NOT_CONFIGURED');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function admin(req){
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const email=(process.env.ADMIN_EMAIL||'').toLowerCase().trim();
 if(!email||!bearer)return false;
 const {data,error}=await db().auth.getUser(bearer);
 if(error||data?.user?.email?.toLowerCase()!==email)return false;
 // Delegated MCP credentials must never authorize bonus/webinar administration.
 try{const claims=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url').toString());if(claims.client_id)return false}catch{return false}
 return true;
}
export function validSlug(s){return typeof s==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)}
export function validUuid(s){return typeof s==='string'&&/^[a-f0-9-]{36}$/i.test(s)}
