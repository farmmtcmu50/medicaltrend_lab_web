# Chat

_Started 2026-09-27 05:42 UTC_

---

## User

Continuing from "Merge design combination".

## Assistant

We were building a bilingual home blood collection booking platform and admin console for Medical Trend. I just added full Thai/English language switching to the Home Blood Collection site.

Key decisions made:
- Language toggle button (TH / EN) placed top-right next to login; selection persists in browser storage across sessions.
- Translated all static UI: hero section, booking steps 1–5, price summary bar, service highlights, process timeline, branch addresses, footer.
- Package names, test details, and descriptions remain Thai because they're pulled live from Google Sheets; if you add English columns to the sheet, I'll wire them to auto-translate those too.
- Admin Console remains untranslated for now (can add if needed).

Current state:
- Home Blood Collection.dc.html now fully bilingual with language persistence.
- All 5 booking steps, pricing displays, and informational sections toggle cleanly between Thai and English.
- Google Sheet sync, multi-person/multi-package logic, real-time pricing, poster gallery, and footer all intact.
- Admin Console.dc.html unchanged (11 pages, sample data, User Management form still English-only).

Open next steps:
- Add English columns (test_name_en, description_en, etc.) to Google Sheet if you want packages/tests to auto-translate.
- Translate Admin Console if needed (dashboard, all 10 sections, forms, notifications).
- Backend integration: Google Sheets sync finalization, OAuth 2.0, order submission API, LINE/SMS/email notifications.
- Database schema, map integration, PDPA compliance setup.

Project files: Home Blood Collection.dc.html, Admin Console.dc.html, support.js, Design System.

