# Kumbuild logo — `public/logo/`

Source: v3 Potrace trace of the attached K mark (see `~/workspace/kumbuild/temp/logo/README.md` for the full trace history). Primary colour `#008EFD`.

All files are 1024x1024. Served at `/logo/<file>` on kumbuild.com.

| File | Use |
| --- | --- |
| `kumbuild-logo.svg` | Default — transparent bg, blue mark. Use in header, footer, favicon source. |
| `kumbuild-logo.png` | Same as SVG, transparent PNG. |
| `kumbuild-logo-white-bg.png` | White background, blue mark — for places that need an opaque image (social, docs). |
| `kumbuild-logo-outline.svg` / `.png` | Outline only — blue 28px stroke, no fill, transparent bg. |
| `kumbuild-logo-blue-bg.svg` / `.png` | Blue `#008EFD` background, white mark — dark surfaces, app icon base. |

Note: the mark is 720x651px centred (152px side padding) — it fits the Play keyline and a full circle mask. For an Android adaptive icon, a separate foreground layer scaled inside the 626px safe circle is still needed.
