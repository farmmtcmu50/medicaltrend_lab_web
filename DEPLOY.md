# lab.medicaltrend.stream — วิธีรันและ Deploy

เว็บจองตรวจเลือด เมดิคอลเทรนด์ (ทำจากดีไซน์ `project/Home Blood Collection.dc.html`)
รันบน Cloudflare Worker ตัวเดียว: หน้าเว็บเป็น static assets และมี API อยู่ใต้ `/api/*`

## โครงสร้าง

| ส่วน | ไฟล์ | หน้าที่ |
|---|---|---|
| หน้าเว็บ | `src/` (React + Vite) | STEP 1–5, สองภาษา TH/EN, ป๊อปอัปโปสเตอร์, แถบราคารวมด้านล่าง, ฟอร์มข้อมูลติดต่อ + PDPA |
| API | `worker/index.ts` | `GET /api/catalog`, `POST /api/bookings` |
| กติการาคา | `shared/catalog.ts` | ใช้ร่วมกันทั้งหน้าเว็บและ Worker — Worker คำนวณยอดซ้ำเองทุกครั้ง ไม่เชื่อยอดจากเบราว์เซอร์ |
| ฐานข้อมูล | D1 `medical-trend-booking` | ตาราง `bookings`, `booking_items`, `catalog_cache` (`migrations/0001_init.sql`) |
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
2. D1 และ R2 **สร้างไว้แล้ว** และสร้างตารางใน D1 remote แล้ว (`database_id` อยู่ใน `wrangler.jsonc`)
   รัน `npm run db:migrate` ได้อย่างปลอดภัย (ใช้ `IF NOT EXISTS`) เพื่อให้ Wrangler บันทึกประวัติ migration
3. `npm run deploy`
4. โดเมน `lab.medicaltrend.stream` ผูกผ่าน `routes[].custom_domain` — zone `medicaltrend.stream` ต้องอยู่ในบัญชี Cloudflare เดียวกัน
   Wrangler จะสร้าง DNS record และใบรับรอง SSL ให้อัตโนมัติ (ถ้ามี record `lab` เดิมอยู่ ต้องลบก่อน)
5. ตรวจหลัง deploy: `curl https://lab.medicaltrend.stream/api/catalog` ควรได้ `"source":"live"`

## ดูรายการจอง (ระหว่างยังไม่มี Admin Console)

```bash
npx wrangler d1 execute medical-trend-booking --remote \
  --command "SELECT ref, created_at, mode, branch, visit_date, slot, contact_name, contact_phone, total FROM bookings ORDER BY created_at DESC LIMIT 50"
```
ไฟล์ใบสั่งตรวจ: Cloudflare Dashboard → R2 → `medical-trend-booking-uploads` → `lab-orders/` (ห้ามเปิด public access ของ bucket นี้)

## ยังไม่ได้ทำในรอบนี้
- ปุ่ม "เข้าสู่ระบบ" แสดงข้อความ "เร็ว ๆ นี้" (ยังไม่มีระบบสมาชิก / Google Sign-In)
- Admin Console (`project/Admin Console.dc.html`) และการแจ้งเตือน LINE OA / SMS / อีเมล เมื่อมีการจองใหม่
- ป้องกันสแปมฟอร์ม (แนะนำเพิ่ม Cloudflare Turnstile ก่อนโปรโมตเว็บ)
