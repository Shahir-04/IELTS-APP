# Lilt — your IELTS study space

A responsive React + TypeScript app for reading IELTS study PDFs and playing their accompanying audio on the same screen. Ready for Vercel; no server is required for device-local study. Optional Supabase provides private cross-device access to uploaded materials.

## Run locally

Requires Node.js 22.12+ (Node 24 also works).

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Use the app

1. Try the included original lesson: three PDF pages, two listening exercises, one speaking prompt, and three playable MP3s.
2. Select **Add material**, name the lesson, choose your PDF, and select all accompanying audio files.
3. Open the lesson. The **This page** tab shows tracks matching references in that page's PDF text. **All tracks** shows everything uploaded with the lesson.
4. For scanned pages or nonstandard numbering, select **Link audio to this page** and check the relevant tracks. You can link multiple tracks to a page, or one track to several pages.
5. Use the player for speed changes (0.5–2×), ten-second skips, seeking, volume, and track repeat. Audio continues when you change PDF pages.
6. Write notes and answers in **Notes**. Use **Speak** to record yourself, play it back, and download the recording. Download before leaving the recorder tab; recordings are held in memory only.
7. Bookmark pages and reopen them directly from **Bookmarks**. Reading position, notes, answers, completion, bookmarks, and listening time are saved on the current device.

Automatic matching supports `Track 01`, `Audio 1.03`, and `CD1 Track02` references. Suitable audio filenames include `Track 01.mp3`, `01.mp3`, `1.03 - conversation.m4a`, and `CD1 Track02.mp3`. Track `1`, `10`, and `1.1` are deliberately treated as different identifiers. Automatic matching requires PDF text; this app does not perform OCR or download missing audio. It plays files you supply.

A local lesson can be up to 250 MB total, subject to browser storage quota. Playback depends on codecs supported by the device's browser; MP3 is the most portable choice. Password-protected PDFs need to be unlocked before upload. Microphone recording needs HTTPS (provided by Vercel) or localhost and browser permission.

## Deploy to Vercel

1. Put this folder in a GitHub repository and import that repository into Vercel. If the repository contains this app inside a `lilt` folder, set **Root Directory** to `lilt`.
2. Choose the **Vite** preset. Build command: `npm run build`. Output directory: `dist`. These values are also supplied in `vercel.json`.
3. Set the Node version to **24.x** or **22.x**, then deploy.
4. Open the resulting HTTPS URL on your phone, tablet, or computer.

You can also run `npx vercel` from this directory and follow its prompts. No deployment has been performed on your behalf.

Deploying the frontend does **not** copy browser uploads to another device. To access your uploaded library everywhere, complete the cloud setup below. Without it, each browser has its own local materials. The bundled sample is available everywhere.

## Enable private cross-device materials with Supabase

### 1. Create the database and private storage

Create a Supabase project. In its SQL Editor, run `supabase/setup.sql` **once**. It creates the `lessons` table, a private `study-files` bucket, and row-level policies restricting all reads and writes to the signed-in owner. Do not make the bucket public.

The default bucket limit is 50 MB **per file**, while local lessons can total 250 MB. Larger cloud uploads require a resumable upload implementation and an appropriate storage plan; they are not supported by this version.

### 2. Configure email sign-in

In **Authentication → URL Configuration**:

- Set **Site URL** to your deployed Vercel origin, such as `https://your-app.vercel.app`.
- Add that origin to the allowed redirect URLs.
- For local testing, also allow `http://localhost:5173` (and `http://127.0.0.1:5173` if you use it).

Enable the email provider. Supabase's default development email service may restrict recipients or rate-limit sign-in messages; configure your own SMTP provider for regular use.

### 3. Add public client configuration

Copy `.env.example` to `.env.local` for local development. In Vercel **Settings → Environment Variables**, add:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

These are browser-visible values. Use only the public anon/publishable key; never use a service-role or secret key. Access is protected by the SQL policies. Vite embeds these values at build time, so redeploy after adding or changing them.

### 4. Sync and study

1. Select **Cloud library**, enter your email, and follow the sign-in link.
2. Upload your lesson using **Add material**.
3. Select **Cloud library → Sync my library** to upload local originals and refresh your cloud lessons. Newly added lessons require this explicit sync.
4. Open the deployed app on another device and sign in with the same email. Your cloud materials load automatically; **Sync my library** refreshes them on demand.

Cloud sync includes PDFs, audio, lesson metadata, and manual page links. Notes, answers, bookmarks, completion, reading position, listening time, and recordings remain local to each device. Signed file URLs expire after 24 hours; use **Sync my library** or reload while signed in to refresh them. Remote-only materials require internet access; this version is not an offline PWA.

Signing out removes cached cloud lessons from this browser. Your cloud originals remain in your account. Local lessons that have not been synced remain on the device. Keep your source files as a backup. To permanently delete a cloud lesson, delete its row from `lessons` and its corresponding storage folder under `<user-id>/<lesson-id>` through your Supabase dashboard. Device-local lessons can be removed from **My library**.

## Checks

```bash
npm test                 # track matching and manual link behavior
npm run build            # TypeScript and optimized production output
npm run test:browser     # real PDF, audio, upload, persistence, mobile and recording checks
```

Browser tests use `/usr/bin/chromium` in this environment. On your own machine, install Playwright Chromium (`npx playwright install chromium`) and set `CHROMIUM_PATH` to your Chromium executable, or remove the `executablePath` setting from `playwright.config.ts` to use Playwright's downloaded browser.

The browser checks passed against local storage with actual PDF/MP3 assets and a synthetic microphone. A live Supabase deployment has not been tested because no project credentials were supplied. After configuration, verify cross-device sync with your account and confirm a second account cannot read the first account's lessons.

## Project map

- `src/App.tsx`: study room, library, upload flow, notes, recorder, and playback controls.
- `src/PdfReader.tsx`: locally bundled PDF.js worker, PDF rendering, and text extraction.
- `src/matching.mjs`: filename and PDF reference matching.
- `src/storage.ts`: IndexedDB blobs and local progress.
- `src/cloud.ts`: private Supabase uploads, signed file URLs, and metadata updates.
- `supabase/setup.sql`: cloud schema and owner-only access rules.
- `public/library/`: original sample PDF, MP3s, and transcripts.

Sample material is original practice content, not an official IELTS exam. Its audio is synthesized using FFmpeg's Flite voice. The generated assets are already committed to the project folder; Python `reportlab` and FFmpeg are needed only to regenerate them with `scripts/make-demo.py`.
