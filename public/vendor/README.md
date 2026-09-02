`heic2any.min.js` — MIT licensed, from https://github.com/alexcorvi/heic2any

Vendored rather than loaded from a CDN so the photo wall keeps working on
venue wifi with no outside dependency. The upload page loads it lazily, and
only when someone picks a HEIC that their browser can't decode on its own —
so the vast majority of visitors never download it.
