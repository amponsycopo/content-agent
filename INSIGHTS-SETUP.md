# Instagram Insights on the bonus-website branch

Same Vercel project erlanv2; no main changes. Assign insight.erlandoski.com to the bonus-website preview branch. Host middleware rewrites / to /insights and exposes only the MCP, consent and discovery routes on that domain. Other hosts retain their existing routes. Never promote this preview over the main deployment.

Six GET-only Meta tools live at /mcp. Discovery is public; tool calls require a Supabase-verified admin OAuth token with the configured client ID, issuer, expiry and exact audience https://insight.erlandoski.com/mcp. Native admin() rejects delegated OAuth tokens, so the MCP link does not authorize bonus/webinar administration. Meta tokens are server-only and stripped from returned pagination URLs. Threads tables are not involved.

## Remaining configuration (not yet active)

1. Vercel preview environment for bonus-website: IG_USER_ID=17841465137939054, IG_GRAPH_VERSION=v26.0, IG_ACCESS_TOKEN=new secret entered directly in Vercel. Do not use the token exposed through chat paging links. Add INSIGHTS_OAUTH_CLIENT_ID after registration. Redeploy after environment changes.
2. DNS: use the exact CNAME and any verification records returned by Vercel, at the authoritative DNS provider. Do not assume a universal target. Verify DNS and HTTPS.
3. Supabase OAuth Server: inspect existing Site URL and token hook before changing either. Preserve an existing hook; merge the audience logic instead of replacing it. Enable the server only after the consent page is deployed. Use the authorization path /oauth/consent on the insight site. Prefer a manually registered ChatGPT client and keep dynamic registration disabled. Copy the exact callback URL from ChatGPT into the client; use asymmetric JWT signing for openid, following Supabase's current instructions.
4. Replace the placeholder client ID in database/insights-oauth-audience.sql, review it, then install that hook through supported Supabase configuration. It leaves password sessions and all other OAuth clients unchanged. Configure INSIGHTS_OAUTH_CLIENT_ID to the same UUID.
5. Add the MCP in ChatGPT using OAuth and the manually registered client credentials. Login and explicitly approve the read access. Verify get_my_profile, one account reach request, and one owned-media insight through ChatGPT before claiming the integration works. A READY deployment is only hosting success.

Read-only means no Meta mutations. Data is fetched when requested and Meta insights can have a reporting delay. Token invalidation/expiry produces an error; missing metrics are never converted to zero.

Official references:
- https://developers.openai.com/plugins/build/auth
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/oauth-server/token-security
