# Immich image display

**Uploads:** New attachments are stored as WebP when the Immich proxy upload path supports it (smaller wire size, same album routing).

**Proxy sizes** (`GET /api/immich/asset/[id]?type=`):

| `type` | Use |
|--------|-----|
| `thumbnail` | Grid thumbs (default when `type` is omitted — e.g. legacy `receiptUrl`) |
| `preview` | Lightbox default — snappy large view |
| `original` | On demand via “ดูต้นฉบับ” only |

**Client UX:** Thumbs use `loading="lazy"` + `decoding="async"`. Images fade in over ~200ms from a muted placeholder (`motion-reduce:transition-none`). Lightbox keeps `disableOutsideClose` so nested upload/toast UI does not dismiss it.
