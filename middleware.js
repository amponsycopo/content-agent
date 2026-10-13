import {NextResponse} from 'next/server';
export function middleware(req){
 const host=(req.headers.get('host')||'').toLowerCase().split(':')[0];
 if(host!=='insight.erlandoski.com')return NextResponse.next();
 const p=req.nextUrl.pathname;
 if(p==='/')return NextResponse.rewrite(new URL('/insights',req.url));
 if(p.startsWith('/_next/')||['/mcp','/insights','/oauth/consent','/api/insights/consent','/.well-known/oauth-protected-resource','/favicon.ico'].includes(p))return NextResponse.next();
 return new NextResponse('Not found',{status:404});
}
