const fields='id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count';
const mediaMetrics=['views','reach','saved','likes','comments','shares','total_interactions','ig_reels_avg_watch_time','ig_reels_video_view_total_time'];
const accountMetrics=['reach','views','accounts_engaged','total_interactions','profile_views','likes','comments','shares','saves','follower_count'];
const obj=properties=>({type:'object',properties,additionalProperties:false});
const mediaId={type:'string',pattern:'^[0-9]{5,30}$'};
export const tools=[
 {name:'connection_status',description:'Check server configuration without revealing credentials. Configuration does not prove live access.',inputSchema:obj({})},
 {name:'get_my_profile',description:'Read the configured Instagram Business/Creator profile.',inputSchema:obj({})},
 {name:'list_my_media',description:'Read posts/Reels from the configured account. Follow after cursor when has_more is true.',inputSchema:obj({limit:{type:'integer',minimum:1,maximum:50},after:{type:'string',maxLength:2000}})},
 {name:'get_media',description:'Read one post owned by the configured account.',inputSchema:{...obj({media_id:mediaId}),required:['media_id']}},
 {name:'get_media_insights',description:'Read available post insights. Supported metrics vary by media/API version; unavailable is not zero. Use response units for watch-time.',inputSchema:{...obj({media_id:mediaId,metrics:{type:'array',items:{type:'string',enum:mediaMetrics},minItems:1,maxItems:9}}),required:['media_id']}},
 {name:'get_account_insights',description:'Read account insights. Account reach is not the sum of post reach. Use compatible metrics/metric_type; do not invent missing data.',inputSchema:obj({metrics:{type:'array',items:{type:'string',enum:accountMetrics},minItems:1,maxItems:10},metric_type:{type:'string',enum:['time_series','total_value']},since:{type:'integer',minimum:0},until:{type:'integer',minimum:0}})}
].map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}}));
class SafeError extends Error{constructor(message,code='REQUEST_FAILED'){super(message);this.code=code}}
const fail=(message,code)=>{throw new SafeError(message,code)};
function clean(v){
 if(Array.isArray(v))return v.map(clean);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['access_token','appsecret_proof','next','previous'].includes(k)).map(([k,x])=>[k,clean(x)]));
 return v;
}
function configured(e){return Boolean(/^\d{5,30}$/.test(e.IG_USER_ID||'')&&e.IG_ACCESS_TOKEN&&/^v\d+\.\d+$/.test(e.IG_GRAPH_VERSION||''))}
async function graph(e,path,params={}){
 if(!configured(e))fail('Instagram belum tersambung. Konfigurasikan IG_USER_ID, IG_ACCESS_TOKEN (secret), dan IG_GRAPH_VERSION di server.','NOT_CONFIGURED');
 const url=new URL('https://graph.facebook.com/'+e.IG_GRAPH_VERSION+'/'+path);
 for(const [k,v] of Object.entries(params))if(v!==undefined)url.searchParams.set(k,String(v));
 let r;try{r=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+e.IG_ACCESS_TOKEN,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)})}catch{fail('Instagram tidak dapat dihubungi.','UPSTREAM_UNAVAILABLE')}
 let data;try{data=await r.json()}catch{fail('Respons Instagram tidak dapat dibaca.','UPSTREAM_INVALID')}
 if(!r.ok||data.error){const c=data.error?.code;fail(c===190?'Token Instagram tidak valid atau kedaluwarsa.':c===10||c===200?'Izin Meta belum cukup.':'Meta menolak permintaan. Metrik mungkin tidak didukung untuk media atau versi API ini.','META_'+(Number.isInteger(c)?c:r.status))}
 return data;
}
function chosen(v,allowed,defaults){const a=v??defaults;if(!Array.isArray(a)||!a.length||a.length>allowed.length||a.some(x=>!allowed.includes(x)))fail('Pilihan metrik tidak valid.','INVALID_ARGUMENT');return [...new Set(a)].join(',')}
async function owned(e,id){
 if(!/^\d{5,30}$/.test(id||''))fail('ID postingan tidak valid.','INVALID_ARGUMENT');
 const d=await graph(e,id,{fields:fields+',owner'});
 if(String(d.owner?.id)!==e.IG_USER_ID)fail('Postingan bukan milik akun yang dikonfigurasi.','ACCESS_DENIED');
 const {owner,...media}=d;return media;
}
export async function callTool(name,a,e){
 const tool=tools.find(t=>t.name===name);if(!tool)fail('Tool tidak tersedia.','UNKNOWN_TOOL');
 if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!(k in tool.inputSchema.properties)))fail('Argumen tidak valid.','INVALID_ARGUMENT');
 for(const k of tool.inputSchema.required||[])if(a[k]===undefined)fail('Argumen wajib belum diisi.','INVALID_ARGUMENT');
 if(name==='connection_status')return {configured:configured(e),live_access_verified:false,mode:'read-only',required_settings:['IG_USER_ID','IG_ACCESS_TOKEN (secret)','IG_GRAPH_VERSION'],note:'Konfigurasi bukan bukti akses Instagram berhasil.'};
 if(name==='get_my_profile')return clean(await graph(e,e.IG_USER_ID,{fields:'id,username,name,biography,followers_count,follows_count,media_count'}));
 if(name==='list_my_media'){
  const limit=a.limit??25;if(!Number.isInteger(limit)||limit<1||limit>50||a.after!==undefined&&(typeof a.after!=='string'||a.after.length>2000))fail('Limit atau cursor tidak valid.','INVALID_ARGUMENT');
  const d=await graph(e,e.IG_USER_ID+'/media',{fields,limit,after:a.after});
  return {data:clean(d.data||[]),after:d.paging?.cursors?.after||null,has_more:Boolean(d.paging?.next)};
 }
 if(name==='get_media')return clean(await owned(e,a.media_id));
 if(name==='get_media_insights'){const metric=chosen(a.metrics,mediaMetrics,['reach','saved','likes','comments','shares']);await owned(e,a.media_id);return clean(await graph(e,a.media_id+'/insights',{metric}))}
 if(name==='get_account_insights'){
  const metric=chosen(a.metrics,accountMetrics,['reach']);
  if(a.metric_type!==undefined&&!['time_series','total_value'].includes(a.metric_type))fail('Jenis metrik tidak valid.','INVALID_ARGUMENT');
  for(const k of ['since','until'])if(a[k]!==undefined&&(!Number.isSafeInteger(a[k])||a[k]<0))fail('Timestamp tidak valid.','INVALID_ARGUMENT');
  if(a.since!==undefined&&a.until!==undefined&&(a.until<=a.since||a.until-a.since>30*86400))fail('Rentang maksimal 30 hari dan harus berurutan.','INVALID_ARGUMENT');
  return clean(await graph(e,e.IG_USER_ID+'/insights',{metric,period:'day',metric_type:a.metric_type,since:a.since,until:a.until}));
 }
}

