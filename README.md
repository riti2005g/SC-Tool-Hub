# SC Supply Chain Tool Hub
Static site (GitHub Pages) + Supabase (auth, tickets, updates) + Microsoft Graph (SharePoint macro files).

## 1. Supabase
1. Create a project at supabase.com. SQL Editor → run `supabase/schema.sql`.
2. Authentication → URL Configuration: Site URL = your GitHub Pages URL; add `<url>/home.html` and `<url>/settings.html` to Redirect URLs.
3. Project Settings → API: copy Project URL + **anon** key into `assets/js/config.js`. Never put the service_role key in the site.
4. Sign up in the site, then run the admin SQL line at the bottom of schema.sql.

## 2. SharePoint (Azure + Edge Function)
1. Entra ID → App registrations → New. Add **Application** permission `Sites.Selected` (Graph), grant admin consent. Create a client secret.
2. Grant the app read access to ONE site (admin runs once): `POST /v1.0/sites/{site-id}/permissions` with roles `["read"]` and your app id.
3. Get `SP_SITE_ID` (`GET /sites/{host}:/sites/{name}`) and `SP_DRIVE_ID` (`GET /sites/{id}/drives`) in Graph Explorer.
4. Deploy the function:
```
npm i -g supabase && supabase login && supabase link --project-ref YOUR_REF
supabase secrets set MS_TENANT_ID=... MS_CLIENT_ID=... MS_CLIENT_SECRET=... SP_SITE_ID=... SP_DRIVE_ID=... SP_FOLDER_PATH="Macros"
supabase functions deploy sharepoint-files
```
Any file dropped in that folder appears on Macro Files within `POLL_SECONDS` (default 60s) or on Refresh. Only signed-in users can call the function.

## 3. Publish
Push this folder to GitHub → Settings → Pages → Deploy from branch `main` / root.
