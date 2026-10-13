import {NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {db,validUuid} from '../../../lib/db';
export async function POST(req){
 try{
  const p=await req.json(),token=p.unlock_token,id=p.submission_id;
  if(!validUuid(id)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return NextResponse.json({error:'Kode tidak valid.'},{status:400});
  const s=db(),{data:sub}=await s.from('bonus_submissions').select('unlock_token_sha256,campaign_id').eq('id',id).single();
  const provided=createHash('sha256').update(token).digest(),expected=Buffer.from(sub?.unlock_token_sha256||'0'.repeat(64),'hex');
  if(expected.length!==provided.length||!timingSafeEqual(provided,expected)||!sub)return NextResponse.json({error:'Akses ditolak.'},{status:403});
  const {data:c}=await s.from('bonus_campaigns').select('reward_storage_path').eq('id',sub.campaign_id).single();
  if(!c?.reward_storage_path)return NextResponse.json({error:'Bonus belum tersedia.'},{status:404});
  const {data:r,error}=await s.storage.from('erlandoski-bonus-rewards').createSignedUrl(c.reward_storage_path,90);
  if(error)return NextResponse.json({error:'File tidak tersedia.'},{status:404});
  return NextResponse.json({reward_url:r.signedUrl},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Permintaan gagal.'},{status:400})}
}
