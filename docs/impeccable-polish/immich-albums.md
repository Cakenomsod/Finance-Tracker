# Immich albums

**One album per user**, named by the uploader’s `displayName` (sanitized). Attachments from transactions and trip expenses all go to that personal album.

Trips no longer get separate Immich albums on upload. Optional `tripId` on upload is kept only for membership/auth checks, not album routing. Legacy `trips.immichAlbumId` may still exist but is unused for new uploads.

**Display / loading:** See [immich-images.md](./immich-images.md) — WebP uploads, `thumbnail` / `preview` / `original` proxy sizes, lazy thumbs, preview lightbox.
