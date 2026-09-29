# lab.medicaltrend.stream — วิธีรันและ Deploy

เว็บจองตรวจเลือด เมดิคอลเทรนด์ (ทำจากดีไซน์ `project/Home Blood Collection.dc.html`)
รันบน Cloudflare Worker ตัวเดียว: หน้าเว็บเป็น static assets และมี API อยู่ใต้ `/api/*`

## โครงสร้าง

| ส่วน | ไฟล์ | หน้าที่ |
|---|---|---|
| หน้าเว็บ | `src/` (React + Vite) | STEP 1–5, สองภาษา TH/EN, ป๊อปอัปโปสเตอร์, แถบราคารวมด้านล่าง, ฟอร์มข้อมูลติดต่อ + PDPA |
| API | `worker/index.ts` | `GET /api/catalog`, `POST /api/bookings`, หลังบ้าน `/admin` + `/api/admin/*` |
| กติการาคา | `shared/catalog.ts` | ใช้ร่วมกันทั้งหน้าเว็บและ Worker — Worker คำนวณยอดซ้ำเองทุกครั้ง ไม่เชื่อยอดจากเบราว์เซอร์ |
| ฐานข้อมูล | D1 `medical-trend-booking` | ตาราง `bookings`, `booking_items`, `booking_events`, `catalog_cache` (`migrations/`) |
| ไฟล์แนบ | R2 `medical-trend-booking-uploads` | ใบสั่งตรวจจากแพทย์ เก็บที่ `lab-orders/YYYY-MM/<booking id>.<ext>` |
| รูป | `public/img/*.webp` | แปลงจาก `project/uploads` ด้วย `npm run images` (37 MB → 3.5 MB) |

### ราคา (Master Price List 2026)
Worker อ่าน Google Sheet แท็บ `Master Capital` ฝั่งเซิร์ฟเวอร์ และส่งให้เบราว์เซอร์**เฉพาะคอลัมน์ Retail** (คอลัมน์ต้นทุน/B2B/margin ไม่ออกนอก Worker)
- แคชที่ edge 60 วินาที แก้ราคาในชีตแล้วจะเห็นบนเว็บภายใน ~1 นาที
- อ่านชีตไม่ได้ → ใช้ชุดล่าสุดที่อ่านได้จาก D1 (`catalog_cache`) → ถ้ายังไม่มี ใช้ `shared/catalog-snapshot.json` (ดึงเมื่อ 28 ก.ย. 2026, 348 แถว)
- ชีตต้องแชร์เป็น **Anyone with the link – Viewer** เหมือนเดิม

### การจอง
`POST /api/bookings` (multipart: `payload` JSON + ไฟล์ `labOrder` ถ้ามี)
- ตรวจ: วันที่ (วันนี้–90 วัน, เวลาไทย), ช่วงเวลา, สาขา, ที่อยู่/ระยะทาง (บริการถึงบ้าน), ชื่อ, เบอร์โทรไทย, อีเมล, ความยินยอม PDPA, ไฟล์ PDF/JPG/PNG/WEBP/HEIC ≤ 10 MB
- ราคาไม่ตรงกับที่หน้าเว็บแสดง → ตอบ `409 price_changed` หน้าเว็บโหลดราคาใหม่แล้วให้ลูกค้ากดยืนยันอีกครั้ง
- สำเร็จ → ได้เลขที่การจองรูปแบบ `MT-YYMMDD-XXXX`

## หน้าตรวจ HIV / STD `https://lab.medicaltrend.stream/std`

จากดีไซน์ Claude Design "MedicalTrend STD Testing" (Desktop 1440 + Mobile 390) — โค้ดใน `src/std/`
- แพ็กเกจ 5 ชุด + PCR เลือกเชื้อเอง (ราคาขั้นตามจำนวนเชื้อ) กฎราคาอยู่ใน `shared/std.ts` ใช้ร่วมกับ Worker
- จองผ่าน `POST /api/std/bookings` บันทึกลง D1 เดียวกัน (`bookings.source = 'std'`) ขึ้นใน Booking Console พร้อมป้าย STD และตัวกรอง "หน้า STD"
- เวลานัดตรวจตามเวลาเปิดของแต่ละสาขา (`branchHours` ใน `shared/std.ts`) Worker ตรวจซ้ำ
- ข้อมูลสาขา/ค่าเจาะนอกสถานที่ยึดตามเว็บหลัก และยังไม่แสดงเลขใบอนุญาตโฆษณา/สถานพยาบาล
- ภาพประกอบ 3 ขั้นตอนไม่ได้แนบมากับไฟล์ดีไซน์ จึงแสดงเป็นการ์ดข้อความ

### การเชื่อมโยงหน้าหลัก ↔ หน้า STD และการวัดที่มา
- หน้าหลัก: เมนู "ตรวจ HIV/STD", การ์ด STD ในรายการยอดนิยมพาไป `/std` (จองที่เดียว ราคาเดียว), แถบแนะนำเมื่อค้นหาคำเกี่ยวกับ HIV/STD, ลิงก์ท้ายเว็บ
- หน้า STD: การ์ดเจาะเลือดนอกสถานที่ลิงก์ไป `/?mode=home` (ระบบคำนวณค่าเดินทาง)
- ทุกการจองบันทึก `bookings.referrer` จาก `?ref=` / `?utm_source=` / เว็บต้นทาง / `direct` (migration 0005) ดูได้ในหลังบ้าน (หน้ารายละเอียด + การ์ด "ที่มาของการจอง · 30 วัน")
- ลิงก์สำหรับโฆษณา/QR/LINE OA: ใส่ `?ref=ชื่อที่ต้องการ` เช่น `https://lab.medicaltrend.stream/std?ref=line-oa` หรือ `?ref=qr-sankamphaeng`

## คำสั่ง

```bash
npm install
npm run images            # เฉพาะเมื่อเปลี่ยนรูปใน project/uploads
npm run db:migrate:local  # ครั้งแรก: สร้างตารางใน D1 จำลอง
npm run dev:worker        # build + wrangler dev ที่ http://127.0.0.1:8787 (มี D1/R2 จำลองในเครื่อง)
npm run typecheck
```

## Deploy ครั้งแรก

1. `npx wrangler login` (หรือตั้งค่า `CLOUDFLARE_API_TOKEN`) ด้วยบัญชี Cloudflare เดียวกับที่มี D1/R2 ข้างต้น
2. D1 และ R2 **สร้างไว้แล้ว** และสร้างตารางใน D1 remote แล้ว (migration 0001–0002, `database_id` อยู่ใน `wrangler.jsonc`)
   รัน `npm run db:migrate` ได้อย่างปลอดภัย (ใช้ `IF NOT EXISTS`) เพื่อให้ Wrangler บันทึกประวัติ migration
3. `npm run deploy`
4. โดเมน `lab.medicaltrend.stream` ผูกผ่าน `routes[].custom_domain` — zone `medicaltrend.stream` ต้องอยู่ในบัญชี Cloudflare เดียวกัน
   Wrangler จะสร้าง DNS record และใบรับรอง SSL ให้อัตโนมัติ (ถ้ามี record `lab` เดิมอยู่ ต้องลบก่อน)
5. ตรวจหลัง deploy: `curl https://lab.medicaltrend.stream/api/catalog` ควรได้ `"source":"live"`

## หน้าหลังบ้าน `https://lab.medicaltrend.stream/admin`

Booking Console (`src/admin/`, API ใน `worker/admin.ts`) มี 3 หน้า: ภาพรวมวันนี้ · รายการจอง (ค้นหา/กรองสถานะ สาขา วันนัด) · รายละเอียดการจอง (เปลี่ยนสถานะ, หมายเหตุเจ้าหน้าที่, เปิดใบสั่งตรวจ, ไทม์ไลน์ และประวัติว่าใครแก้อะไรเมื่อไร)

ล็อกอินด้วย **Cloudflare Access** (Zero Trust, ฟรีไม่เกิน 50 คน) และ Worker ตรวจ token ของ Access ซ้ำอีกชั้น (`worker/access.ts`)
ถ้ายังไม่ตั้งค่า หน้า `/admin` จะตอบ 503 — ไม่มีทางเปิดข้อมูลโดยไม่ล็อกอิน

### ตั้งค่า Cloudflare Access (ครั้งเดียว)
Team domain ของบริษัท: `medicaltrend.cloudflareaccess.com` (ใส่ใน `wrangler.jsonc` แล้ว)

1. **เปิดการล็อกอินด้วยรหัสทางอีเมล** — บัญชี Zero Trust ใหม่ไม่มี One-time PIN ให้อัตโนมัติ
   https://dash.cloudflare.com → **Zero Trust → Integrations → Identity providers → Add new identity provider → One-time PIN**
2. **สร้าง Policy** — **Zero Trust → Access controls → Policies → Create new policy**
   - Policy name `MT staff` · Action **Allow** · Session duration `24 hours`
   - Add rules → **Include** → Selector **Emails** → Value `lab@medicaltrend.co.th` → **Save**
3. **สร้าง/แก้แอป** — **Zero Trust → Access controls → Applications → Add an application → Self-hosted** (หรือเปิดแอปเดิมแล้ว **Edit**)
   - Application name `MT Booking Console`
   - Public hostnames 2 รายการ: `lab.medicaltrend.stream` path `admin` และ `lab.medicaltrend.stream` path `api/admin`
   - แท็บ **Policies** → **Select existing policies** → ติ๊ก `MT staff`
   - แท็บ **Authentication** → ปิด *Accept all available identity providers* → ติ๊ก **One-time PIN** อย่างเดียว
     (อย่าเลือก *Cloudflare* เพราะใช้ได้เฉพาะสมาชิกบัญชี Cloudflare) → **Save**
4. **AUD Tag** — ในแอปเดียวกัน แท็บ **Overview / Basic information** → **Application Audience (AUD) Tag**
   เป็นเลขฐาน 16 ยาว **64 ตัว ไม่มีขีด** (ไม่ใช่ Application ID แบบ `xxxxxxxx-xxxx-…` ที่อยู่ใน URL)
   **หาไม่เจอ?** ข้ามไปก่อนได้: รัน `npm run deploy` แล้วเปิด https://lab.medicaltrend.stream/admin → ล็อกอินด้วยรหัส OTP
   หน้าเว็บจะแสดง AUD Tag ที่ถูกต้องให้คัดลอก (แสดงเฉพาะเมื่อ token ผ่านการตรวจลายเซ็นของ Cloudflare แล้ว)
5. ใส่ใน `wrangler.jsonc` → `"ACCESS_AUD": "<AUD tag>"` แล้ว `npm run deploy`
6. เปิด https://lab.medicaltrend.stream/admin → กรอก `lab@medicaltrend.co.th` → ใส่รหัส 6 หลักจากอีเมล
   (ผู้ส่ง `noreply@notify.cloudflare.com` — ถ้าไม่เจอให้ดูใน Spam หรือ allowlist โดเมน `notify.cloudflare.com`)

**เพิ่มผู้ใช้ภายหลัง:** เพิ่มอีเมลทั้งใน Access policy (ข้อ 3) และใน `ADMIN_EMAILS` (คั่นด้วย `,`) แล้ว deploy ใหม่

### ทดสอบหลังบ้านบนเครื่อง
สร้างไฟล์ `.dev.vars` (ไม่ถูก commit) ที่มี `ADMIN_DEV_EMAIL=lab@medicaltrend.co.th` แล้ว `npm run db:migrate:local && npm run dev:worker` เปิด http://127.0.0.1:8787/admin
**ห้าม**ตั้ง `ADMIN_DEV_EMAIL` บน Worker ที่ deploy จริง เพราะจะข้ามการล็อกอิน

### ดูข้อมูลดิบ (ผู้ดูแลระบบ)
```bash
npx wrangler d1 execute medical-trend-booking --remote \
  --command "SELECT ref, created_at, status, mode, branch, visit_date, slot, contact_name, contact_phone, total FROM bookings ORDER BY created_at DESC LIMIT 50"
```
ไฟล์ใบสั่งตรวจ: R2 → `medical-trend-booking-uploads` → `lab-orders/` (ห้ามเปิด public access ของ bucket นี้)

## ยังไม่ได้ทำ
- ปุ่ม "เข้าสู่ระบบ" ฝั่งลูกค้าแสดงข้อความ "เร็ว ๆ นี้" (ยังไม่มีระบบสมาชิก / Google Sign-In)
- หลังบ้านส่วนอื่นตามดีไซน์: ปฏิทินคิว, จ่ายงานให้นักเทคนิคการแพทย์, แผนที่เส้นทาง, ชำระเงิน, ฐานข้อมูลลูกค้า, จัดการผู้ใช้
- แจ้งเตือน LINE OA / SMS / อีเมล เมื่อมีการจองใหม่
- ป้องกันสแปมฟอร์ม (แนะนำเพิ่ม Cloudflare Turnstile ก่อนโปรโมตเว็บ)

## แจ้งเตือนการจองเข้ากลุ่ม LINE พนักงาน

ใช้ Messaging API ของ LINE OA ที่มีอยู่ (worker/line.ts) ทุกการจองจากหน้าหลักและหน้า /std จะส่งข้อความสรุปเข้ากลุ่มที่ผูกไว้ หากส่งไม่สำเร็จ การจองยังบันทึกตามปกติ (ดู error ได้ด้วย `npx wrangler tail`)

1. LINE Official Account Manager → ตั้งค่า → Messaging API → เปิดใช้งาน (เปิดแล้วปิดคืนไม่ได้)
2. LINE Developers Console → channel ของ OA → Basic settings: คัดลอก **Channel secret** / Messaging API: กด Issue **Channel access token (long-lived)**
3. ตั้ง secret (ไม่ต้องใส่ใน wrangler.jsonc):
   ```
   npx wrangler secret put LINE_CHANNEL_SECRET
   npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
   npx wrangler secret put LINE_BIND_CODE      # รหัสลับที่ตั้งเอง เช่น MT-7Q4K9
   ```
4. Messaging API → Webhook URL = `https://lab.medicaltrend.stream/api/line/webhook` → Verify → เปิด Use webhook
   (ถ้า OA เคยใช้ Webhook กับระบบอื่น ให้จด URL เดิมไว้ และเปลี่ยนกลับหลังผูกกลุ่มเสร็จ — การส่งแจ้งเตือนไม่ใช้ Webhook)
5. OA Manager → ตั้งค่า → การตั้งค่าบัญชี → เปิด "อนุญาตให้บัญชีเข้าร่วมแชทกลุ่ม" แล้วเชิญ OA เข้ากลุ่มพนักงาน
6. พิมพ์ในกลุ่ม: `ผูกแจ้งเตือน <LINE_BIND_CODE>` → บอทตอบยืนยัน
   - `สถานะแจ้งเตือน` ตรวจว่ากลุ่มนี้รับแจ้งเตือนอยู่ · `ยกเลิกแจ้งเตือน <LINE_BIND_CODE>` เลิกผูก · เตะบอทออกจากกลุ่ม = เลิกผูกอัตโนมัติ
7. ข้อความแจ้งเตือนหักโควตาข้อความของ OA (นับตามจำนวนสมาชิกในกลุ่ม) ตรวจการใช้งานได้ใน OA Manager

## ระยะทางเจาะเลือดถึงบ้าน และการจองด้วยใบสั่งแพทย์

- เมื่อลูกค้าวางลิงก์ Google Maps หรือปักหมุด หน้าเว็บเรียก `GET /api/distance` (worker/geo.ts) เพื่อหาสาขาที่ใกล้ที่สุดและระยะทางขับรถ (บริการ OSRM) ถ้าเส้นทางใช้ไม่ได้จะใช้ระยะเส้นตรง × 1.35 ปัดขึ้น ตอนบันทึกการจอง Worker คำนวณซ้ำและเก็บสาขาที่ใกล้ที่สุดไว้ในช่อง branch ของการจองถึงบ้าน
- พิกัดสาขาอ่านจากลิงก์ Google Maps ใน `shared/geo.ts` (เก็บไว้ใน app_settings 30 วัน) ถ้าต้องการกำหนดเอง ใส่ var `BRANCH_POINTS` เช่น `{"watket":[18.79,99.00]}` ใน wrangler.jsonc
- ถ้าไม่มีพิกัด ลูกค้าเลื่อนประมาณระยะทางเอง (1–40 กม.) และเจ้าหน้าที่ยืนยันภายหลัง เกิน 40 กม. ระบบไม่รับจอง
- ค่าบริการถึงบ้าน (PRICING.homeTiers ใน shared/catalog.ts) ต่อครั้ง ไม่เกิน 5 ท่าน: 1–3 กม. ฿250 · 4–6 ฿300 · 7–10 ฿350 · 11–15 ฿400 · 16–20 ฿450 · 21–40 ฿600 · ท่านที่ 6 ขึ้นไป +฿50/ท่าน (ระยะปัดขึ้นเป็นกิโลเมตรเต็ม)
- แนบใบสั่งแพทย์แล้วจองได้โดยไม่ต้องเลือกรายการตรวจ (ทั้งที่สาขาและถึงบ้าน) ยอดที่บันทึกคือค่าบริการเบื้องต้น หลังบ้านแสดง "รอแจ้งราคา" ให้เจ้าหน้าที่ใช้ "แก้ไขรายการตรวจ" ใส่รายการและราคา ระบบแจ้งกลุ่ม LINE ให้อัตโนมัติ

## อีเมลถึงลูกค้า (Resend)

worker/mail.ts ส่งในนาม `MedicalTrend Lab <lab@medicaltrend.co.th>` (Reply-To: lab@) เฉพาะการจองที่ลูกค้าใส่อีเมล
ยืนยันการจอง (หลังจอง) · แจ้งยอด (หลังเจ้าหน้าที่แก้รายการตรวจ) · ยืนยันนัด / ยกเลิก (เปลี่ยนสถานะในหลังบ้าน) · เตือนนัด (cron 18:00 น. ของวันก่อนนัด)
ผลการส่งทุกครั้งอยู่ในตาราง email_log และการ์ด "อีเมลถึงลูกค้า" ในหลังบ้าน การจอง STD ใช้ข้อความกลาง ๆ ไม่ระบุชื่อโรค/รายการตรวจ

1. สมัคร https://resend.com → Domains → Add Domain → `medicaltrend.co.th` (Region: Tokyo ap-northeast-1)
2. เพิ่ม DNS ตามที่ Resend แสดง ที่ผู้ดูแล DNS ของ medicaltrend.co.th:
   - TXT `resend._domainkey` (DKIM)
   - MX + TXT ที่ subdomain `send` (SPF ของ Resend) — ไม่กระทบ MX/อีเมลเดิมของ lab@
   - แนะนำ TXT `_dmarc` = `v=DMARC1; p=none;` ถ้ายังไม่มี
   แล้วกด Verify จนสถานะเป็น Verified
3. API Keys → Create (Sending access, domain medicaltrend.co.th) → `npx wrangler secret put RESEND_API_KEY`
4. `npm run deploy` (มี cron `0 11 * * *` ใน wrangler.jsonc) ถ้าไม่มี RESEND_API_KEY ระบบจะไม่ส่งอีเมลและไม่กระทบการจอง
