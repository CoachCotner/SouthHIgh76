# southhigh76.com

Reunion site for the South High Class of 1976, hosted on Netlify.

---

## ⚠️ Read this before connecting Netlify to this repo

**This repo does not yet contain the live site.** It currently holds only the
photo-wall feature described below. The live site at southhigh76.com was
deployed to Netlify by hand, so its HTML lives in the Netlify deploy and
nowhere else.

If you connect this repo to the Netlify project as-is, **the next deploy will
replace the live site with just the photo wall.** Don't do that.

The order that works:

1. In Netlify: **Deploys → the current published deploy → Download deploy**.
2. Unzip it into this repo alongside the `photos/`, `netlify/` and `qr/`
   folders, so `index.html` and the rest of the site sit at the repo root.
3. Commit that.
4. *Then* link the Netlify project to this repo (Site configuration → Build &
   deploy → Link repository) and set the publish directory to `.`.

After that, every push deploys, and the site is version-controlled.

---

## The reunion photo wall

A QR code on the tables sends people to `southhigh76.com/photos`, where they
add photos from their phone and watch them appear on a shared wall — no app,
no account, no sign-up.

| Path | What it is |
| --- | --- |
| `/photos` | Upload form + live gallery (this is where the QR code points) |
| `/photos/admin.html` | Password-protected moderation — delete anything |
| `/api/upload` | Accepts the photos |
| `/api/photos` | Lists the wall, newest first, 60 at a time |
| `/api/photo/:id` | Serves one image |
| `/api/delete-photo` | Removes one (uploader's own, or admin) |

Photos are stored in **Netlify Blobs** (store name `reunion-photos`), not in
Netlify Forms — a reunion generates hundreds of photos, and every Forms upload
would burn a submission against the plan's quota.

### One-time setup

Set an admin password in Netlify — **Site configuration → Environment
variables**:

```
REUNION_ADMIN_PASSWORD = <pick something>
```

Until that's set, `/photos/admin.html` refuses every password rather than
letting anyone in. Nothing else needs configuring; Blobs provisions itself.

### Moderation

The wall is **public and instant** — a photo is live the moment it's posted.
Two ways to take one down:

- Whoever uploaded it sees a **Remove** button on their own photos, on the
  device they uploaded from.
- You can delete anything from `/photos/admin.html` with the admin password.

Keep that admin page open on your phone during the event and a bad photo is
gone in two taps.

### Phone formats

Uploads are identified by **reading the file's first bytes**, not by the
content type the phone claims — iPhones routinely hand over HEIC with an empty
or generic type, and trusting that would silently drop real photos.

Accepted: **JPEG, PNG, GIF, WebP, AVIF, and HEIC/HEIF** (including the `mif1`
and `heix` variants Samsung and newer iPhones write).

HEIC needs special handling because Safari can display it but Chrome, Firefox
and Android cannot. So the upload page converts HEIC to JPEG *in the browser*
before it ever reaches the wall:

1. iOS usually converts on its way out of the photo picker.
2. If not, Safari's own decoder handles it during the resize step.
3. Failing both — an Android phone set to "high efficiency", say — the page
   lazy-loads a HEIC decoder from `photos/vendor/` and converts it there.

If every one of those fails the photo is still uploaded and kept rather than
lost, and the wall shows it as a download link instead of a broken tile.

Photos are also scaled down to 2000px on the long edge before uploading —
reunion-hall wifi is slow and a 10MB phone photo becomes about 1.5MB.

### Limits

- 20 photos per upload, 12MB per photo (before the browser shrinks it)
- Name and caption are both required
- A honeypot field catches spam bots, same as the existing RSVP form

---

## The QR code

Print-ready files are in `qr/`:

- **`print-signs.html`** — open it and print. Two table-tent cards per page,
  cut along the dashed line. Tick "Background graphics" in the print dialog.
- **`reunion-photos-qr.svg`** — vector, for a banner or anything large
- **`reunion-photos-qr.png`** — 2000px, navy, for texting or social
- **`reunion-photos-qr-black.png`** — plain black, for cheap printing

All of them point to `https://southhigh76.com/photos`. To regenerate — after
a URL change, or to make a code for a preview deploy:

```bash
npm install
npm run qr                          # rebuilds all three at the default URL
node qr/generate.mjs https://other-url.example/photos
```

The codes use error-correction level H, which survives 30% damage, so they
still scan off a creased or spilled-on table tent.
