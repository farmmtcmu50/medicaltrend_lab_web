# Home Blood Collection Service

_Started 2026-08-30 12:45 UTC_

---

## User

Act as an expert UI/UX designer. Create an interactive web app component for a high-fidelity, responsive On-demand Medical Service and E-commerce platform. The specific service is Home Blood Collection (เจาะเลือดตามบ้าน) Design a high-fidelity landing page for an on-demand home blood collection and mobile wellness platform. The theme should be professional and clinical, using medical blue, soft teal, and clean white. The hero section must prominently feature a dual-toggle button: 'Book at Lab' and 'Book Home Service'. When 'Book Home Service' is selected, display an overlay widget with fields for 'Enter Home Address/Pin Location', 'Select Patient Type' (General, Elderly, Bedridden), and an 'Upload Doctor's Lab Order' button. Below the hero banner, add a features grid showcasing benefits like 'Certified Medical Technologists', 'No Hospital Queues', and 'Secure Online Reports'. Include a price transparency calculator based on distance or package selection, followed by a step-by-step visual roadmap on how the home visit works.

## Assistant

_[tool: list_files]_

_[tool: web_search]_

Design system project is empty, so I'll build on a clinical blue/teal system of my own. Building the component now.

_[tool: dc_write]_

_[tool: ready_for_verification]_

Landing page is up: sticky nav, hero with the Book at Lab / Book Home Service toggle driving a live booking panel (address + pin, patient type with per-type care notes and fees, lab-order upload, date/slot), a six-card benefits grid, a price calculator (package + distance slider + party size → itemized summary), the 5-step visit roadmap, and footer.

Two notes: pricing is illustrative placeholder data — send me your real package prices and travel-fee rules and I'll swap them in. Base visit fee and per-km rate are exposed as tweaks.

## User

ใส่รูป Logo นี้ลงไปด้วย และให้ข้อมูลสาขาที่ให้บริการ 
1. ศูนย์แล็บเมดิคอลเทรนด์ บ่อสร้าง สันกำแพง 
2. ไอบลิส สหคลินิก หนองหอย
3. ราชพฤกษ์แล็บเชียงใหม่ หางดง
4. เมดิคอลเทรนด์ เฮลธ์แคร์ พะเยา

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the branches section and footer logo.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

ใส่โลโก้ในหัวเว็บและในฟุตเตอร์ (บนพื้นขาวเพื่อให้อ่านชัด) เพิ่มเซ็กชัน "สาขาที่ให้บริการ" 4 การ์ดก่อนฟุตเตอร์ พร้อมลิงก์ในเมนู และเปลี่ยนตัวเลือกสาขาในฟอร์ม "จองที่แล็บ" เป็นชื่อสาขาจริงทั้ง 4 แห่ง

เวลาทำการและรัศมีบริการในการ์ดสาขาเป็นตัวเลขสมมติ — บอกข้อมูลจริงมาได้ครับ จะแก้ให้

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

แก้เป็น "รับรองมาตรฐาน MOPH Standard" ทั้งสองจุด (เซ็กชันจุดเด่น + ฟุตเตอร์) พร้อมกับแก้โลโก้หัวเว็บให้ครอปเฉพาะตรามเมดิคอลเทรนด์ให้อ่านชัด พื้นที่ให้บริการเป็น เชียงใหม่ · พะเยา และลิขสิทธิ์เป็นชื่อบริษัทจริง

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: show_html]_

Logo mark now fits fully in the header crop (flask and base visible).

## User

Logo มุมซ้ายบน ใช้รูปนี้

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: ready_for_verification]_

เปลี่ยนโลโก้เป็นไฟล์ MT Center copy.png ทั้งหัวเว็บ (สูง 54px) และฟุตเตอร์ (บนพื้นขาว สูง 76px) แสดงเต็มตราไม่ครอป

## User

เปลี่ยนข้อมูลเน้นการเป็นแล็บตรวจเลือด 4 สาขา ทั่วเชียงใหม่และพะเยา พร้อมบริการเจาะเลือดถึงบ้าน ไม่ชูเฉพาะ ตรวจเลือดถึงบ้านอย่างเดียว

## Assistant

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

ปรับสารหลักเป็นเครือข่ายแล็บตรวจเลือด 4 สาขา (เชียงใหม่ 3 · พะเยา 1) พร้อมบริการเจาะเลือดถึงบ้านเป็นทางเลือกคู่กัน — แก้พาดหัว คำโปรย แถบสถานะ ตัวเลขสถิติ หัวเซ็กชันจุดเด่น และเมนูฟุตเตอร์

## User

ส่วนแสดงรายการตรวจ ดึงรายการราคา Retail จาก Google Drive ชื่อไฟล์ Master Price List 2026 ตามลิงค์นี้ได้ไหม https://docs.google.com/spreadsheets/d/1YNt4ugp0EVdl7g4yXsMWGYwW-kyl-adVhFT6YaYcMs0/edit?usp=sharing

## Assistant

_[tool: googledrive__read_file_content]_

_[tool: tool_search_tool_bm25]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the test-list section markup, placed after the pricing calculator.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

ดึงข้อมูลจากไฟล์ได้ครับ เพิ่มเซ็กชัน "รายการตรวจและราคา" (ค้นหา + กรองตามหมวด + ดูเพิ่ม) ใช้ราคาคอลัมน์ Retail จริง 48 รายการ และเปลี่ยนแพ็กเกจในเครื่องคำนวณเป็นแพ็กเกจจริง P1 690 / P3 1,790 / P5 4,590 / Hormone F 3,990 / Ultimate 10,900 (ราคา Sales จากชีตแพ็กเกจ)

ข้อจำกัด: ไฟล์ยาวมาก ระบบอ่านได้ถึงรายการที่ขึ้นต้นด้วย E (Estradiol) เท่านั้น รายการหลัง F–Z ยังไม่ได้ดึงเข้ามา ถ้าต้องการครบทุกรายการ แนะนำแยกชีตเฉพาะคอลัมน์ รหัส/ชื่อ/หมวด/Retail/เวลารอผล แล้วส่งลิงก์มาใหม่ จะดึงได้ครบ

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

แก้จำนวนรายการในแพ็กเกจให้ตรงกับที่นับจากชีต (P1 = 14, P3 = 26, Ultimate = 40) และเปลี่ยนไอคอนขั้นตอน 3 กับ 4 เป็นหมุดตำแหน่งและหลอดเก็บตัวอย่างที่อ่านออกชัดเจน

## User

ใส่ข้อมูลทั้ง 4 สาขาต่อไปนี้

ศูนย์แล็บ เมดิคอลเทรนด์ 
107/17 หมู่ 3 ต.ต้นเปา อ.สันกำแพง จ.เชียงใหม่ 50130
ติดกับบ่อสร้างซอย 1
โทร. 0952472631
E-mail : medicaltrend.lab@gmail.com
Location : https://maps.app.goo.gl/dHaP2e7HRyN2FW7V6

ราชพฤกษ์แล็บเชียงใหม่
5/1 หมู่ที่ 1 ถนนเชียงใหม่-ฮอด ต.หางดง อ.หางดง จ.เชียงใหม่
E-mail : ratchaphruek_lab@hotmail.com
โทร : 0857178242
Location : https://maps.app.goo.gl/y9izRjZqGh4rdBw3A

เมดิคอลเทรนด์แล็บ สาขาไอบลิส สหคลินิก (เวชกรรม+เทคนิคการแพทย์)
308/8 ถนนเชียงใหม่-ลำพูน ต.วัดเกตุ อ.เมือง จ.เชียงใหม่
E-mail : medicaltrend.ibliss@gmail.com
โทร. 0885647132
Location : https://maps.app.goo.gl/fLN92AkvcfVXRNn7A

เมดิคอลเทรนด์ เฮลธ์แคร์ สหคลินิก
429 หมู่ที่ 1 ต.แม่กา อ.เมือง จ.พะเยา 56000
E-mail : medicaltrend.th@gmail.com
โทร 0902264192
Location : https://maps.app.goo.gl/tDfmQh4GsNK9HKAbA

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

ใส่ข้อมูลจริงทั้ง 4 สาขา — ที่อยู่เต็ม เบอร์โทร (กดโทรได้) อีเมล และลิงก์ Google Maps ในการ์ดสาขา พร้อมอัปเดตตัวเลือกสาขาในฟอร์มจองที่แล็บ เบอร์โทรบนหัวเว็บและฟุตเตอร์เป็นของสาขาสันกำแพง

หมายเหตุ: สาขาไอบลิสในที่อยู่ที่ให้มาคือ ต.วัดเกตุ (ไม่ใช่หนองหอย) ผมใช้ตามที่อยู่ที่ส่งมา ตัดเวลาทำการและรัศมีบริการออกเพราะยังไม่มีข้อมูลจริง

## User

ส่วนคำนวณราคาก่อนจอง
และส่วนรายการตรวจและราคา ให้รวมเป็นส่วนเดียวกันเลย 
และถ้ามีการเปลี่ยนแปลงข้อมูลในไฟล์ Google Sheet ให้เปลี่ยนแปลงตามด้วยทันที

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the live Google Sheet sync in the logic class.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: show_html]_

_[tool: eval_js]_

Live sync works — 344 รายการ ดึงจากชีตจริงสำเร็จ

_[tool: ready_for_verification]_

รวมสองส่วนเป็นเซ็กชันเดียว "คำนวณราคาก่อนจอง" แล้วต่อด้วยตารางรายการตรวจในเซ็กชันเดียวกัน และต่อ Google Sheet แบบสด — โหลดหน้าแล้วดึงคอลัมน์ Retail จาก Master Price List 2026 ตรงๆ ตอนนี้ได้ครบ 344 รายการ (ไม่ใช่ 48 รายการที่ฮาร์ดโค้ดไว้เดิม) แก้ราคาในชีตแล้วรีเฟรชหน้าจะเห็นทันที มีป้ายสถานะ "ซิงก์แล้ว" กำกับ ถ้าชีตถูกปิดแชร์จะสลับไปใช้ชุดสำรองอัตโนมัติ

เงื่อนไขเดียว: ชีตต้องคงการแชร์เป็น Anyone with the link ไว้ ไม่งั้นเบราว์เซอร์ดึงไม่ได้

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

แพ็กเกจในเครื่องคำนวณดึงสดจากชีตแล้วเช่นกัน — กรองแถวประเภท Package ได้ 20 ชุด ใช้ชื่อจริง ราคา Retail จริง และคำอธิบายจากชีต (Starter ฿690, Standard ฿990, Extra ฿1,790 …) รายการตรวจเดี่ยวเหลือ 324 รายการเพราะแยกแถวแพ็กเกจออกไป ชุดฮาร์ดโค้ดเดิมเก็บไว้เป็นข้อมูลสำรองเวลาต่อชีตไม่ได้ พร้อมใส่สกอร์ลให้รายการแพ็กเกจ 20 ชุดไม่ยืดยาว

## User

อยากให้ เลือกรายการตรวจ ไปรวมราคากับแพคเกจได้ด้วย แล้วคำนวณราคารวม พร้อมกดจอง ได้

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template: selectable rows, chips of picked tests, and a sticky booking bar.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

Cart works: 990 + 1,300 + 350 = 2,640 ✓

_[tool: ready_for_verification]_

เพิ่มระบบตะกร้า: กดที่แถวรายการตรวจเพื่อเลือก/ยกเลิก (ปุ่ม + เปลี่ยนเป็น ✓ แถวไฮไลต์) รายการที่เลือกไปโผล่เป็นชิปในเครื่องคำนวณ กดชิปเพื่อลบ หรือกดล้างทั้งหมด ราคารวมคิดแพ็กเกจ + รายการเดี่ยว × จำนวนท่าน + ค่าเดินทาง + ค่าดูแลเฉพาะทาง แพ็กเกจกดอีกครั้งเพื่อยกเลิกได้ (ตรวจเฉพาะรายการเดี่ยวก็ได้) และมีแถบสรุปยอดติดขอบล่างพร้อมปุ่มจองตลอดการเลื่อนหน้า

## User

เพิ่ม Logo อีก 2 อันบนหน้าเพจด้วย

## Assistant

_[tool: run_script]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

ใส่โลโก้ทั้งสองเพิ่ม 3 จุด: ราชพฤกษ์แล็บบนการ์ดสาขาหางดง, MTH บนการ์ดสาขาพะเยาและเป็นโลโก้บริษัทในฟุตเตอร์, และแถบ "Our group" รวมโลโก้ทั้งสามแบรนด์บนพื้นขาวก่อนแถบลิขสิทธิ์

## User

Found issues — fixing…

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

เปลี่ยนโลโก้บนการ์ดสาขาเป็น background-image (ไม่ยิงรีเควสต์ตอนสตรีม จึงไม่มี error ในคอนโซล) และขยายเป็น 82px สูง ส่วนแถบ Our group ขยายเป็น 84px ให้อ่านชื่อแบรนด์ออก

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: show_html]_

_[tool: eval_js]_

Logos resolve on all four cards.

_[tool: ready_for_verification]_

แก้แล้ว — ใส่ quote รอบ url() และเปลี่ยนช่องว่างในชื่อไฟล์เป็น %20 ตรวจแล้วโลโก้ขึ้นครบทั้ง 4 การ์ด

## User

ทำข้อความ STEP 1, 2, 3,4 เพื่อไม่ให้คนใช้งานสับสนว่าต้องเลือกอะไรก่อนหลัง และให้ลูกค้าคลิกปุ่มจองคิวที่แล็บ หรือ จองบริการถึงบ้าน ด้านล่างทีเดียวเลย อย่าวางไว้หลายที่

## Assistant

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now STEP 4 block replacing the sticky bar.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

ใส่ลำดับ STEP 1–4 ชัดเจน: STEP 1 เลือกช่องทาง (ที่แล็บ/ถึงบ้าน) ในฮีโร่ → STEP 2 เลือกแพ็กเกจ → STEP 3 เลือกรายการตรวจเดี่ยว → STEP 4 ยืนยันการจอง

ปุ่มจองเหลือที่เดียวที่ STEP 4 ด้านล่าง ตัดปุ่มในฮีโร่ (เปลี่ยนเป็นลิงก์พาไป STEP 2) ปุ่มในกล่องสรุปสีน้ำเงิน และแถบติดขอบล่างออกทั้งหมด ยอดรวมยังโชว์ทุกจุดตามเดิม

## User

ที่ STEP2 เพิ่มปุ่ม ไม่ประสงค์ตรวจเป็น Package เพื่อให้เลือกรายการตรวจเดี่ยว ๆ อย่างเดียว

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

เพิ่มปุ่ม "ไม่ประสงค์ตรวจเป็น Package" ไว้บนสุดของรายการแพ็กเกจใน STEP 2 กดแล้วยกเลิกแพ็กเกจทั้งหมดและขึ้นเครื่องหมาย ✓ เหลือคิดราคาเฉพาะรายการตรวจเดี่ยวที่เลือกใน STEP 3

## User

แพคเกจตรวจสุขภาพมี 10 แพคเกจ ช่วยเพิ่มปุ่มให้กดดูรายการใน STEP 2 แล้ว Pop up รูปภาพแต่ละแพคเกจได้ไหม

## User

แพคเกจตรวจสุขภาพมี 10 แพคเกจ ช่วยเพิ่มปุ่มให้กดดูรายการใน STEP 2 แล้ว Pop up รูปภาพแต่ละแพคเกจได้ไหม

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

Poster now 560px wide at full aspect, panel scrolls within the viewport, and all 10 packages have a poster button.

_[tool: ready_for_verification]_

เพิ่ม Signature ชาย/หญิง (฿6,990) และ Ultimate ชาย/หญิง (฿12,900) ต่อท้ายรายการแพ็กเกจจากชีต (ถ้าวันหลังเพิ่มแถวเหล่านี้ในชีต ระบบจะใช้ข้อมูลจากชีตแทนอัตโนมัติ) ตอนนี้ครบ 10 แพ็กเกจมีปุ่มดูโปสเตอร์ทั้งหมด และขยายป็อปอัปเป็นกว้าง 560px ตามสัดส่วนโปสเตอร์จริง เลื่อนดูได้ในกรอบ ไม่ตกขอบจอ

## User

แก้ไข ถ้าลูกค้าไม่ได้เลือก จองบริการถึงบ้านใน STEP แรก ไม่ต้องแสดงแถบระยะทางเพื่อคำนวณค่าบริการใน STEP2

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

ซ่อนแถบระยะทางใน STEP 2 เมื่อเลือก "จองที่แล็บ" (แสดงเฉพาะโหมดจองบริการถึงบ้าน) ค่าเดินทางในสรุปยังคงแสดงเป็น "ฟรี" ตามเดิม

## User

ถ้าลูกค้าจองมากกว่า 1 คนและตรวจไม่เหมือนกัน ทำยังไง

## Assistant



## Assistant

ตอนนี้ระบบคูณแพ็กเกจและรายการตรวจที่เลือกด้วยจำนวนคน = ทุกคนตรวจเหมือนกัน ถ้าตรวจไม่เหมือนกันมี 3 ทางเลือก ขอให้เลือกก่อนสร้าง

_[tool: ask_user]_

ส่งฟอร์มให้เลือกแนวทางแล้ว — รอคำตอบ 3 ข้อ (รูปแบบการจัดการ, วิธีคิดค่าเดินทาง, ส่วนลดจองพร้อมกัน) แล้วผมจะสร้างตามนั้น

## User

Answered — model: แยกรายคน: เพิ่ม/ลบผู้รับบริการเป็นแท็บ (คนที่ 1, 2, 3…) แต่ละคนเลือกแพ็กเกจและรายการตรวจของตัวเอง ราคารวมทุกคนแสดงรวมกัน; scope: คิดครั้งเดียวต่อการเดินทาง; discount: ตัดส่วนลดจองพร้อมกันออกไปก่อน

## Assistant

_[tool: grep]_

_[tool: read_file]_

Now the per-person refactor.

_[tool: run_script]_

Now the template: person tabs replacing the stepper, plus a "selecting for" indicator in STEP 3.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

ทำเป็นแท็บรายคนตามที่เลือก: ใน STEP 2 มีแถบ "ผู้รับบริการ" กดเพิ่ม/ลบได้ถึง 8 คน แต่ละแท็บโชว์แพ็กเกจและยอดของคนนั้น เลือกแท็บไหน STEP 2–3 จะเลือกให้คนนั้น (STEP 3 มีป้าย "กำลังเลือกให้ คนที่ N" กำกับ) สรุปค่าใช้จ่ายแยกบรรทัดรายคน + ค่าเดินทางคิดครั้งเดียวต่อการเดินทาง และตัดส่วนลดจองพร้อมกันออกแล้ว

STEP 4 ลิสต์รายการของทุกคนก่อนยืนยัน

