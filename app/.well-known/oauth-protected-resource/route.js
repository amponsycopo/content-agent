import {resourceMetadata} from '../../../lib/insights-auth';
export const dynamic='force-dynamic';
export function GET(){return Response.json(resourceMetadata(),{headers:{'Cache-Control':'no-store'}})}
