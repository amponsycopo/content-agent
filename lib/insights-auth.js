import {db} from './db';
export const insightsOrigin='https://insight.erlandoski.com';
export const insightsResource=insightsOrigin+'/mcp';
export function claimsOf(token){try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString())}catch{return null}}
export async function authorizeInsights(req){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const client=process.env.INSIGHTS_OAUTH_CLIENT_ID;
 if(!token||!client)return false;
 // Decode only to check bindings; Supabase verifies the signature via getUser below.
 const c=claimsOf(token),issuer=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')+'/auth/v1';
 if(!c||c.iss!==issuer||c.client_id!==client||!Number.isFinite(c.exp)||c.exp<=Date.now()/1000
  ||!(Array.isArray(c.aud)?c.aud:[c.aud]).includes(insightsResource))return false;
 const {data,error}=await db().auth.getUser(token);
 return !error&&data?.user?.id===c.sub&&data.user.email?.toLowerCase()===(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
}
export function resourceMetadata(){return {resource:insightsResource,authorization_servers:[(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'')+'/auth/v1'],scopes_supported:['openid','email','profile'],bearer_methods_supported:['header'],resource_name:'Erlan Instagram Insights'}}
export function challenge(){return 'Bearer resource_metadata="'+insightsOrigin+'/.well-known/oauth-protected-resource", scope="openid email profile"'}
export function chatgptCallback(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='chatgpt.com'&&!u.search&&!u.hash&&(u.pathname==='/connector_platform_oauth_redirect'||/^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname))}catch{return false}}
