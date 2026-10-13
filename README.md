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


## Feedback quality checks
- Server-side deterministic filter blocks lengthy repeated letters, very low alphabet diversity and repeated filler words.
- Optional Groq check evaluates all completed essay answers in one JSON-mode request before saving and reward unlock.
- Add GROQ_API_KEY as a **server-only sensitive environment variable** to the **Preview / bonus-website** branch in Vercel. Never use NEXT_PUBLIC_GROQ_API_KEY.
- Optional GROQ_MODEL defaults to llama-3.3-70b-versatile.
- No names, email, WhatsApp, brand photo or promo consent are sent to Groq; only the essay text and associated question are sent.
- Groq network errors or unconfigured key fall back to deterministic checks so genuine members can still receive a bonus.
- Honest negative/neutral reviews are permitted. Anti-bot protection (rate limiting / Turnstile) is a separate improvement.


## Member-only webinars
- Admin dashboard /admin > Webinar can create separate sessions, schedules and Zoom links, and review registrants.
- Registration URLs are /webinar/SLUG. An event only becomes public when its status is open and a Zoom link is present.
- The form sends a 6-digit email OTP through Supabase Auth. For this shared Supabase project, edit Authentication > Email Templates > Magic Link and Confirm Signup templates to include the Supabase variable {{ .Token }}. Keep the existing {{ .ConfirmationURL }} link in the Magic Link template so /admin login by link continues to work.
- For production member volumes, configure a custom SMTP provider and suitable OTP rate limits in Supabase Auth.
- Create a Restricted Scalev API key with ONLY order:list scope at https://app.scalev.com/setting/developers/api-keys. Set SCALEV_API_KEY in Vercel Preview / bonus-website. The Scalev connector token in ChatGPT is not automatically available to Vercel.
- SCALEV_BUSINESS_UID is optional for a business-bound API key. The event's Scalev product ID determines eligibility (Ojol class = 412147).
- Server validates the verified email's Supabase Auth access token and queries Scalev for a paid/settled order. Purchaser records are not copied into app database.
- Public event API never returns Zoom URL. The registered and verified member receives Zoom URL and Google Calendar invitation.
- Screenshot Storage bucket erlandoski-webinar-screenshots is private. Limit 1 MB per platform (GoFood, GrabFood, ShopeeFood).
- Consent to show the member's name, problem and screenshots during the webinar is optional and separate from access. Never project screenshots unless review_consent is true.
- Production readiness requires end-to-end OTP delivery and order-verification tests after environment configuration.
