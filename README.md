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

Enable the Email provider in Supabase Auth. Admin login at /admin uses email and password with `signInWithPassword`; SMTP, OTP and magic links are not required. The account matching ADMIN_EMAIL must have a confirmed email and a unique password. Configure that account through the Supabase Auth Admin API (`updateUserById` with `email_confirm: true` and `password`) in a trusted local/server environment using a secret key. Never update auth.users directly, commit credentials, or share the password in chat. The existing server-side `admin()` guard validates the access token and ADMIN_EMAIL for both bonus and webinar admin APIs.

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


## Feedback quality checks
- Server-side deterministic filter blocks lengthy repeated letters, very low alphabet diversity and repeated filler words.
- Optional Groq check evaluates all completed essay answers in one JSON-mode request before saving and reward unlock.
- Add GROQ_API_KEY as a **server-only sensitive environment variable** to the **Preview / bonus-website** branch in Vercel. Never use NEXT_PUBLIC_GROQ_API_KEY.
- Optional GROQ_MODEL defaults to llama-3.3-70b-versatile.
- No names, email, WhatsApp, brand photo or promo consent are sent to Groq; only the essay text and associated question are sent.
- Groq network errors or unconfigured key fall back to deterministic checks so genuine members can still receive a bonus.
- Honest negative/neutral reviews are permitted. Anti-bot protection (rate limiting / Turnstile) is a separate improvement.


## Member-only webinars — OTP-free
- Admin dashboard at /admin > Webinar manages each event's individual schedule, Zoom link, participants, screenshot previews and CSV export.
- Member registration path: /webinar/SLUG. New registration requires status open; already-registered members may regain their Zoom + Google Calendar links even after registration closes.
- No OTP, SMTP, Magic Link, or customer Supabase Auth required on the webinar form. Admin login uses a separate Supabase Auth email/password session, checked by `admin()` on the server.
- The member enters their Scalev purchase email + WhatsApp. Both must match on the same paid/settled order for the event's specific product. Normalization treats +62812..., 62812... and 0812... as the same number.
- Set the server-only SCALEV_API_KEY in Vercel Preview branch bonus-website. Use a Restricted Scalev key with ONLY order:list scope. Scalev product ID for Kelas Laris Jualan di Ojol = 412147.
- If the email and normalized phone already registered for the same webinar, Zoom and Google Calendar are returned immediately; optional inputs are not requested again. Email, phone, and Scalev order ID are unique per event.
- The Google Calendar button pre-fills session title/time/description and Zoom URL. The user still needs to click Save in Google Calendar.
- To limit guessing, an atomic HMAC-keyed Supabase rate-limit RPC throttles attempts. No cleartext source IP is kept in the throttle table. Email + phone verification is convenient but is not strong authentication: anybody who knows both can still retrieve the Zoom URL.
- Public event endpoint never sends the Zoom URL. The Zoom URL is only returned after checking Scalev and an existing or new valid registration.
- Screenshots are private in erlandoski-webinar-screenshots; optional consent required for displaying them during webinar.
- Launch needs a real valid-order/manual end-to-end test (no automated paid-order test should create fake member registrations).
