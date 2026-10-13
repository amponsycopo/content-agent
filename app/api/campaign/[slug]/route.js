import {NextResponse} from 'next/server';
import {db,validSlug} from '../../../../lib/db';
export const dynamic='force-dynamic';
export async function GET(_req,{params}){
 try{
  const {slug}=await params;
  if(!validSlug(slug))return NextResponse.json({error:'Halaman tidak ditemukan.'},{status:404});
  const s=db();
  const {data:c,error}=await s.from('bonus_campaigns').select('id,title,description,product_name,success_message').eq('slug',slug).eq('status','active').single();
  if(error||!c)return NextResponse.json({error:'Kuesioner belum dibuka. Silakan kembali setelah bonus diaktifkan.'},{status:404});
  const {data:q,error:e}=await s.from('bonus_questions').select('id,prompt,input_type,options,is_required,step,position,help_text').eq('campaign_id',c.id).order('position');
  if(e)throw e;
  return NextResponse.json({campaign:{title:c.title,description:c.description,product_name:c.product_name,success_message:c.success_message},questions:q},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Gagal memuat formulir. Hubungi admin.'},{status:503})}
}
