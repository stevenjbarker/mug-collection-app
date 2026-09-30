# Mug Collection

A private web app for the Starbucks mug collection: browse mugs, add new ones,
and keep photos of the whole display. Everything is saved online, so the phone,
the laptop, and any other device see the same collection.

- **Hosting:** Vercel (free Hobby plan is enough)
- **Storage:** a private Vercel Blob store (mug list + photos)
- **Access:** one passcode, entered once per device. Photos are private too.
- **Google Sheets (optional):** after every change, a copy of the mug list is
  sent to your Apps Script URL. Sheets never overwrites the online collection.

## Deploy on Vercel (one time, about 10 minutes)

1. Go to [vercel.com](https://vercel.com) and **sign up with GitHub**.
2. **Add New → Project**, pick `mug-collection-app`, and click **Deploy**.
   Leave the framework as "Other" and every build setting blank.
3. In the project, open **Storage → Create → Blob**. If it asks for access,
   choose **Private**. Connect it to this project (all environments).
   This adds the `BLOB_READ_WRITE_TOKEN` setting for you.
4. Open **Settings → Environment Variables** and add
   `APP_PASSCODE` = a passcode you'll remember (8+ characters; it's the only lock).
5. Open **Deployments**, click the **⋯** on the latest one → **Redeploy**
   so the new settings take effect.
6. Open the site (e.g. `mug-collection-app.vercel.app`), enter the passcode,
   and choose **Start with my 51 mugs**, or **Import a backup file** if you've
   added mugs in the old app since. (Old app: ⚙ → Export backup.)

On iPhone, open the site in Safari → Share → **Add to Home Screen** for an
app icon.

After this, every push to the `main` branch on GitHub redeploys automatically.

## Changing the passcode

Change `APP_PASSCODE` in Vercel and redeploy. Every device is signed out and
needs the new passcode.

## Run locally

```sh
npm install
APP_PASSCODE=test npm run dev   # http://localhost:3000
```

Without `BLOB_READ_WRITE_TOKEN`, data is stored in `.data/` on your computer
instead of Vercel Blob.

## How it's built

| Path | What it does |
| --- | --- |
| `index.html` | The whole app UI |
| `api/login.js`, `api/logout.js` | Passcode check; sets a year-long sign-in cookie |
| `api/collection.js` | Loads and saves the mug list (`data/collection.json`). Refuses a save made from an out-of-date copy so two devices can't overwrite each other |
| `api/photo.js` | Uploads, serves and deletes photos (`photos/…`) |
| `api/setup.js` | First run only: loads the original 51 mugs |
| `api/_lib/` | Shared code: sign-in, storage, seed data (not served publicly) |
| `scripts/dev-server.js` | Local stand-in for Vercel |
