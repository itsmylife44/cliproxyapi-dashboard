# Simplified Chinese UI screenshots

Captured on 2026-10-18 from the actual Dashboard application, built locally at commit `ad540c5815732e7ceb3884f0a50690362de1d7ac` (the merged Simplified Chinese refresh in PR #337).

- Locale: `zh-CN`; theme: light; viewport: 1706 × 1033 CSS pixels, scale 1. Full-page captures retain each page's natural height.
- Routes: `/dashboard/setup`, `/dashboard/providers`, `/dashboard/quota`, `/dashboard/settings`.
- The application used a local Next.js development server with `SKIP_AUTH=1`. No application components or translations were changed for the screenshots.
- A local read-only fixture proxy supplies the same offline, unconfigured scenario shown in the English reference images: the `dev` administrator, offline proxy status, no provider keys/OAuth accounts/custom providers/quota data, and a setup wizard at 0/3. The settings page shows `development`, dashboard version `dev`, an unknown upstream version and failed update checks. No real provider or production server was contacted.
- The English reference images show an older UI revision. These Chinese captures retain the current application's actual fields, provider list and layout rather than altering them to reproduce old pixels; the offline/unconfigured scenario is aligned.
- Browser translation-extension controls were excluded from the capture. Application text was not translated by a browser extension or edited into the images.
- Product names and technical identifiers are preserved. Some hardcoded or upstream-supplied text remains English because it bypasses the locale catalog.

These images document the Chinese UI appearance, not end-to-end verification of OAuth, billing, updates, or production connectivity. The English README's original screenshots and the shared architecture/project-structure diagrams are unchanged.
