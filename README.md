# Erlan Bonus — bonus-website branch

Next.js multi-step questionnaire for members. Data stored in existing Supabase project cscyxpaxerzewgatzfnn in isolated bonus_* tables and two private Storage buckets. No Threads tables were changed.

## Deployment safety
- Vercel project: erlanv2.
- Existing production main serves integrate.asia. Never merge this bonus branch into main without explicitly migrating the domain.
- The custom domain bonus.erlandoski.com was added to Vercel targeting this branch: bonus-website.
- Vercel has reported Cloudflare nameservers for erlandoski.com. Update DNS at the authoritative DNS provider, not necessarily the registrar Hostinger.

## Required Vercel environment variables
Configure under Vercel project erlanv2 -> Settings -> Environment Variables -> Preview -> Git branch bonus-website.

- NEXT_PUBLIC_SUPABASE_URL=https://cscyxpaxerzewgatzfnn.supabase.co
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... (public)
- SUPABASE_SECRET_KEY=sb_secret_... (server ONLY, do not expose in browser, do not commit)
- ADMIN_EMAIL=exact permitted Supabase Auth email address

Magic-link email authentication must be enabled in Supabase Auth and https://bonus.erlandoski.com/admin added as permitted redirect URL.

## User journey
1. Member opens /bonus/kelas-laris-jualan-di-ojol.
2. Personal profile and brand: name, WhatsApp, product category, optional brand name, email and optional image.
3. Before class (questions generated from Supabase).
4. After class (questions generated from Supabase).
5. Evaluation and an honest review, plus optional separate marketing consent.
6. Successful submission leads immediately to the download page. Download URLs expire and can be renewed using the member receipt token.

Admin dashboard is at /admin. It lets the allowlisted admin create/edit campaigns, upload PDF, ZIP, XLSX, CSV or DOCX up to 3MB, activate the campaign, browse testimonial submissions and export CSV.

## Launch checklist
- Database currently has the example campaign with 10 questions, status DRAFT. Upload the actual bonus and activate in admin before sharing publicly.
- Full environment setup and live build validation are required.
- Public visitors are not verified Scalev purchasers. Add purchase eligibility validation if required.
- Submissions have basic duplicate and spam guards, not full anti-abuse/rate limiting.
- Promotional testimonial usage requires separate opt-in; critical feedback still unlocks the same bonus.
