import {tools,callTool} from '../../lib/instagram-insights';
import {authorizeInsights,challenge} from '../../lib/insights-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(x,status=200,headers={})=>Response.json(x,{status,headers:{'Cache-Control':'no-store',...headers}});
const error=(id,code,message)=>json({jsonrpc:'2.0',id,error:{code,message}});
export async function POST(req){
 if(Number(req.headers.get('content-length')||0)>32768)return json({error:'Request too large'},413);
 let p;try{const text=await req.text();if(text.length>32768)return json({error:'Request too large'},413);p=JSON.parse(text)}catch{return error(null,-32700,'Parse error')}
 if(!p||Array.isArray(p)||p.jsonrpc!=='2.0'||typeof p.method!=='string')return error(null,-32600,'Invalid request');
 const id=p.id??null,result=d=>json({jsonrpc:'2.0',id,result:d});
 if(p.method==='initialize')return result({protocolVersion:['2024-11-05','2025-03-26','2025-06-18'].includes(p.params?.protocolVersion)?p.params.protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'erlan-instagram-insights',version:'1.0.0'}});
 if(p.method.startsWith('notifications/'))return new Response(null,{status:202});
 if(p.method==='ping')return result({});
 if(p.method==='tools/list')return result({tools:tools.map(t=>({...t,securitySchemes:[{type:'oauth2',scopes:['openid','email','profile']}]}))});
 if(p.method!=='tools/call')return error(id,-32601,'Method not found');
 let authorized=false;try{authorized=await authorizeInsights(req)}catch{}
 if(!authorized)return json({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:'Login admin diperlukan untuk membaca insight Instagram.'}],_meta:{'mcp/www_authenticate':[challenge()]}}},401,{'WWW-Authenticate':challenge()});
 try{const d=await callTool(p.params?.name,p.params?.arguments??{},process.env);return result({structuredContent:d,content:[{type:'text',text:JSON.stringify(d)}]})}
 catch(e){return result({isError:true,content:[{type:'text',text:e.code?e.message:'Permintaan tidak dapat diproses.'}]})}
}
export async function GET(){return json({error:'Stream not available'},405,{'Allow':'POST'})}
