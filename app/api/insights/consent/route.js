import {admin} from '../../../../lib/db';
import {chatgptCallback} from '../../../../lib/insights-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
async function authCall(req,id,action){
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const r=await fetch(base+'/auth/v1/oauth/authorizations/'+encodeURIComponent(id)+(action?'/consent':''),{method:action?'POST':'GET',headers:{apikey:key,Authorization:req.headers.get('authorization'),'Content-Type':'application/json'},body:action?JSON.stringify({action}):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('AUTH_REQUEST_FAILED');return r.json();
}
async function handle(req,action){
 try{
  if(!await admin(req))return json({error:'Login admin diperlukan.'},403);
  const client=process.env.INSIGHTS_OAUTH_CLIENT_ID;
  if(!client)return json({error:'Koneksi ChatGPT belum dikonfigurasi.'},503);
  const id=new URL(req.url).searchParams.get('authorization_id');
  // Supabase authorization IDs are opaque URL-safe strings, not client UUIDs.
  if(!/^[A-Za-z0-9_-]{1,256}$/.test(id||''))return json({error:'Permintaan izin tidak valid.'},400);
  const d=await authCall(req,id);
  // No automatic approval or redirect for previously approved requests.
  if(!d.authorization_id)return json({error:'Mulai ulang koneksi dari ChatGPT.'},409);
  if(d.client?.id!==client||!chatgptCallback(d.redirect_uri))return json({error:'Aplikasi tidak diizinkan.'},403);
  const scopes=String(d.scope||'').split(' ').filter(Boolean);
  if(scopes.some(x=>!['openid','email','profile','offline_access'].includes(x)))return json({error:'Izin yang diminta tidak didukung.'},403);
  if(!action)return json({client_name:'ChatGPT',scope:d.scope,redirect_uri:d.redirect_uri});
  const answer=await authCall(req,id,action);
  const u=new URL(answer.redirect_url);u.search='';
  if(!chatgptCallback(u.href))throw Error('INVALID_REDIRECT');
  return json({redirect_url:answer.redirect_url});
 }catch{return json({error:'Permintaan izin tidak dapat diproses. Mulai ulang koneksi dari ChatGPT.'},400)}
}
export function GET(req){return handle(req)}
export async function POST(req){
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Permintaan ditolak.'},403);
 let p;try{p=await req.json()}catch{return json({error:'Permintaan tidak valid.'},400)}
 if(!['approve','deny'].includes(p.action))return json({error:'Pilihan tidak valid.'},400);
 return handle(req,p.action);
}
