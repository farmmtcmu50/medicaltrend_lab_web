// Page text for /std, from the Claude Design "MedicalTrend STD Testing" logic (copy / stiCopy / noticeCopy / bookingCopy).
// Branch names, addresses, the iBliss area and the home-collection fee follow the main site (lab.medicaltrend.stream).
/* eslint-disable */
export type StdLang = 'th' | 'en';

export function copyAll() {
    return {
      th: {
        navPackages: 'แพ็กเกจ', navBranches: 'สาขา', navFaq: 'คำถามที่พบบ่อย', navBook: 'จองออนไลน์', navCta: 'จองคิวออนไลน์',
        heroEyebrow: 'ตรวจ HIV และโรคติดต่อทางเพศสัมพันธ์ · เชียงใหม่',
        heroTitle: 'ตรวจเร็ว รู้ผลไว\nผลการตรวจเป็นความลับเฉพาะบุคคล',
        heroBody: 'ตรวจ HIV รู้ผลใน 1 ชั่วโมง ตรวจ PCR 14 เชื้อในห้องปฏิบัติการอณูชีววิทยาของเมดิคอลเทรนด์ที่เชียงใหม่ ไม่ต้องแสดงบัตรประชาชน และรับผลทาง LINE',
        heroPriceLabel: 'แพ็กเกจเริ่มต้น', baht: 'บาท', from: 'เริ่มต้น',
        ctaLine: 'จองคิวออนไลน์', ctaCall: 'โทร 095-247-2631',
        stats: [
          { v: '1 ชม.', l: 'รู้ผลตรวจ HIV Ag/Ab' },
          { v: '14 เชื้อ', l: 'ตรวจด้วย PCR ในแล็บของเราที่เชียงใหม่' },
          { v: '4 สาขา', l: 'เชียงใหม่ 3 สาขา · พะเยา 1 สาขา' }
        ],
        trust: [
          { t: 'ไม่ต้องแสดงบัตรประชาชน', d: 'รับบริการตรวจได้โดยไม่ต้องแสดงบัตรประชาชน' },
          { t: 'รับผลทาง LINE', d: 'ผลตรวจส่งถึงคุณโดยตรง ไม่ต้องกลับมารับที่สาขา' },
          { t: 'ผลตรวจภาษาอังกฤษ', d: 'ขอรับผลเป็นภาษาอังกฤษได้ สะดวกสำหรับชาวต่างชาติ' },
          { t: 'แล็บอณูชีววิทยาในเชียงใหม่', d: 'ตรวจ PCR ในห้องปฏิบัติการของเมดิคอลเทรนด์เอง' }
        ],
        pkgTitle: 'เลือกแพ็กเกจตรวจที่เหมาะกับคุณ',
        pkgSub: 'ตั้งแต่คัดกรองจากเลือด ไปจนถึงตรวจหาเชื้อด้วย PCR และ HPV หรือเลือกตรวจเฉพาะเชื้อที่ต้องการในส่วน PCR เลือกเชื้อเอง',
        badge: 'แนะนำ', pkgCta: 'เพิ่มแพ็กเกจนี้', pkgChosen: 'เพิ่มแล้ว · นำออก',
        pickTitle: 'PCR เลือกเชื้อเอง', pickSub: 'เลือกตรวจเฉพาะเชื้อที่กังวลจากรายการ 14 เชื้อด้านล่าง แล้วระบุเชื้อที่ต้องการในช่องหมายเหตุตอนจองคิว',
        pickMeta: 'รู้ผลใน 3 วัน · ตัวอย่าง: ปัสสาวะ หรือ swab ช่องคลอด ท่อปัสสาวะ ลำคอ', pickCta: 'จองชุดนี้',
        picks: [
          { name: 'STD3 PCR', n: '3', price: '1,200', sub: 'เลือก 3 เชื้อใดก็ได้จาก 14 เชื้อ' },
          { name: 'STD7 PCR', n: '7', price: '1,600', sub: 'เลือก 7 เชื้อใดก็ได้จาก 14 เชื้อ' },
          { name: 'STD11 PCR', n: '11', price: '1,800', sub: 'เลือก 11 เชื้อใดก็ได้จาก 14 เชื้อ' }
        ],
        stiTitle: 'เชื้อที่ตรวจด้วย STI PCR 14', stiSub: 'ตรวจหาสารพันธุกรรมของเชื้อ 14 ชนิดจากตัวอย่างครั้งเดียว รวมอยู่ในแพ็กเกจ STI PCR 14, Complete, Complete + HPV และ Early Detection หรือเลือกบางเชื้อได้ในชุด STD3, STD7 และ STD11 PCR',
        pkgFoot: 'ราคาอาจเปลี่ยนแปลงได้ กรุณาสอบถามก่อนรับบริการ',
        packages: [
          { name: 'Basic', sub: 'คัดกรองจากเลือด 6 รายการ', price: '880', tat: 'รู้ผลใน 1 ชั่วโมง',
            items: ['HIV Ag/Ab', 'HBsAg (ไวรัสตับอักเสบบี)', 'HBsAb (ภูมิคุ้มกันไวรัสตับอักเสบบี)', 'Anti-HCV (ไวรัสตับอักเสบซี)', 'VDRL/RPR (ซิฟิลิส)', 'Anti-TP (ซิฟิลิส)'],
            sample: 'ตัวอย่าง: เลือด' },
          { name: 'STI PCR 14', sub: 'ตรวจหาเชื้อ 14 ชนิดด้วย PCR', price: '2,100', tat: 'รู้ผลใน 3 วัน',
            items: ['PCR ครบ 14 เชื้อ (ดูรายการด้านล่าง)'],
            sample: 'ตัวอย่าง: ปัสสาวะ หรือ swab ช่องคลอด ท่อปัสสาวะ ลำคอ' },
          { name: 'Complete', sub: 'Basic + STI PCR 14', price: '2,690', tat: 'รู้ผลใน 3 วัน', featured: true,
            items: ['คัดกรองจากเลือด 6 รายการ', 'PCR 14 เชื้อ'],
            sample: 'ตัวอย่าง: เลือด + ปัสสาวะหรือ swab', note: 'ประหยัดกว่าตรวจแยก 290 บาท' },
          { name: 'Complete + HPV', sub: 'Complete + HPV DNA', price: '3,290', tat: 'รู้ผลใน 4 วัน',
            items: ['ทุกรายการในแพ็กเกจ Complete', 'HPV DNA 15 สายพันธุ์'],
            sample: 'ตัวอย่าง: เลือด + ปัสสาวะหรือ swab' },
          { name: 'Early Detection', sub: 'ครบที่สุดในกลุ่ม พร้อม HIV RNA PCR', price: '6,590', tat: 'รู้ผลใน 4 วัน',
            items: ['ทุกรายการในแพ็กเกจ Complete + HPV', 'HIV RNA PCR', 'HSV IgG / IgM (เริม)'],
            sample: 'ตัวอย่าง: เลือด + ปัสสาวะหรือ swab' }
        ],
        addons: [
          { t: 'เจาะเลือดนอกสถานที่', d: 'ในเขต 10 กม. 350 บาท ส่วนที่เกินคิดกิโลเมตรละ 25 บาท', p: '350 บาท' },
          { t: 'ปรึกษาแพทย์', d: 'ให้บริการที่สาขาไอบลิส สหคลินิก (วัดเกตุ)', p: '300 บาท' }
        ],
        stepsTitle: 'ตรวจง่ายใน 3 ขั้นตอน',
        steps: [
          { n: '01', t: 'จองคิวออนไลน์', d: 'เลือกแพ็กเกจ สาขา วันและเวลาที่สะดวกผ่านหน้าเว็บนี้ได้ทันที' },
          { n: '02', t: 'เก็บตัวอย่าง', d: 'ที่สาขาหรือนอกสถานที่ ใช้เวลาไม่นาน ไม่ต้องงดน้ำงดอาหาร' },
          { n: '03', t: 'รับผลทาง LINE', d: 'HIV Ag/Ab รู้ผลใน 1 ชั่วโมง ผล PCR ภายใน 3–4 วัน' }
        ],
        winTitle: 'ควรตรวจเมื่อไร',
        winSub: 'การตรวจแต่ละแบบพบเชื้อได้หลังมีความเสี่ยงในระยะเวลาต่างกัน การเลือกเวลาตรวจที่เหมาะสมช่วยให้ผลน่าเชื่อถือขึ้น',
        pep: 'หากเพิ่งมีความเสี่ยงภายใน 72 ชั่วโมง ควรพบแพทย์โดยเร็วเพื่อประเมินการรับยาป้องกันหลังสัมผัสเชื้อ (PEP)',
        winColTest: 'การตรวจ', winColTime: 'ตรวจพบได้หลังมีความเสี่ยงประมาณ',
        windows: [
          { test: 'HIV RNA PCR', time: '10–33 วัน' },
          { test: 'HIV Ag/Ab', time: '18–45 วัน' },
          { test: 'STI PCR', time: '1–2 สัปดาห์' },
          { test: 'ซิฟิลิส (VDRL/RPR, Anti-TP)', time: '3–6 สัปดาห์' }
        ],
        winNote: 'ระยะเวลาเป็นค่าประมาณ หากตรวจก่อนพ้นช่วงเวลานี้แล้วผลเป็นลบ อาจต้องตรวจซ้ำ สอบถามเจ้าหน้าที่ได้',
        brTitle: 'สาขาที่ให้บริการ',
        branches: [
          { area: 'สันกำแพง เชียงใหม่', name: 'ศูนย์แล็บ เมดิคอลเทรนด์', addr: '107/17 หมู่ 3 ต.ต้นเปา อ.สันกำแพง จ.เชียงใหม่ 50130', hours: 'จ.–ศ. 07.00–19.00 น.\nส.–อา. 07.00–16.00 น.' },
          { area: 'หางดง เชียงใหม่', name: 'ราชพฤกษ์แล็บเชียงใหม่', addr: '5/1 หมู่ที่ 1 ถนนเชียงใหม่-ฮอด ต.หางดง อ.หางดง จ.เชียงใหม่', hours: 'เปิดทุกวัน 07.00–16.00 น.' },
          { area: 'วัดเกตุ เชียงใหม่', name: 'เมดิคอลเทรนด์แล็บ สาขาไอบลิส สหคลินิก', addr: '308/8 ถนนเชียงใหม่-ลำพูน ต.วัดเกตุ อ.เมือง จ.เชียงใหม่', hours: 'เปิดทุกวัน 07.00–16.00 น.', tag: 'มีแพทย์ให้คำปรึกษา' },
          { area: 'ม.พะเยา พะเยา', name: 'เมดิคอลเทรนด์ เฮลธ์แคร์ สหคลินิก', addr: '429 หมู่ที่ 1 ต.แม่กา อ.เมือง จ.พะเยา 56000', hours: 'จ.–ส. 08.00–16.00 น.' }
        ],
        faqTitle: 'คำถามที่พบบ่อย',
        faq: [
          { q: 'ต้องเตรียมตัวก่อนตรวจอย่างไร', a: 'การตรวจเลือดไม่ต้องงดน้ำงดอาหาร หากเก็บตัวอย่างปัสสาวะ ควรงดปัสสาวะอย่างน้อย 1 ชั่วโมงก่อนเก็บ' },
          { q: 'ต้องใช้บัตรประชาชนหรือไม่', a: 'ไม่ต้องแสดงบัตรประชาชนเพื่อรับบริการตรวจ' },
          { q: 'รับผลตรวจอย่างไร', a: 'ส่งผลทาง LINE และขอรับผลเป็นภาษาอังกฤษได้' },
          { q: 'หากผลเป็นบวกควรทำอย่างไร', a: 'เจ้าหน้าที่จะแนะนำขั้นตอนถัดไป และนัดพบแพทย์ได้ที่สาขาไอบลิส สหคลินิก (วัดเกตุ)' },
          { q: 'ควรตรวจบ่อยแค่ไหน', a: 'ผู้ที่มีเพศสัมพันธ์ควรตรวจอย่างน้อยปีละครั้ง และตรวจบ่อยขึ้นหากมีคู่นอนหลายคนหรือไม่ได้ป้องกัน' }
        ],
        endTitle: 'จองคิวตรวจออนไลน์',
        endSub: 'เลือกแพ็กเกจ สาขา วันและเวลาที่สะดวกได้ทันที มีข้อสงสัยโทรสอบถามได้',
        company: 'บริษัท เมดิคอลเทรนด์ จำกัด',
        permit1: '[เลขที่ใบอนุญาตโฆษณา ฆษ.]', permit2: '[เลขที่ใบอนุญาตสถานพยาบาล]'
      },
      en: {
        navPackages: 'Packages', navBranches: 'Branches', navFaq: 'FAQ', navBook: 'Book online', navCta: 'Book online',
        heroEyebrow: 'HIV & STD Testing · Chiang Mai',
        heroTitle: 'Fast results.\nYour results stay strictly confidential.',
        heroBody: 'HIV results in 1 hour. 14-pathogen STI PCR run in MedicalTrend\u2019s own molecular lab in Chiang Mai. No ID required, results sent to you on LINE.',
        heroPriceLabel: 'Packages from', baht: 'THB', from: 'From',
        ctaLine: 'Book online', ctaCall: 'Call 095-247-2631',
        stats: [
          { v: '1 hr', l: 'HIV Ag/Ab results' },
          { v: '14', l: 'STI pathogens by PCR in our Chiang Mai lab' },
          { v: '4', l: 'Branches · 3 in Chiang Mai, 1 in Phayao' }
        ],
        trust: [
          { t: 'No ID required', d: 'Get tested without showing an ID card or passport' },
          { t: 'Results on LINE', d: 'Sent straight to you \u2014 no need to return to the branch' },
          { t: 'English reports', d: 'Request your results in English' },
          { t: 'Molecular lab in Chiang Mai', d: 'PCR tests run in MedicalTrend\u2019s own laboratory' }
        ],
        pkgTitle: 'Choose the right package',
        pkgSub: 'From blood screening to PCR and HPV testing — or pick only the pathogens you need in the custom PCR panel.',
        badge: 'Recommended', pkgCta: 'Add this package', pkgChosen: 'Added · Remove',
        pickTitle: 'Build your own PCR panel', pickSub: 'Test only for the pathogens you are concerned about, chosen from the 14 listed below. Note your choices in the booking form.',
        pickMeta: 'Results in 3 days · Sample: urine, or vaginal, urethral or throat swab', pickCta: 'Book this panel',
        picks: [
          { name: 'STD3 PCR', n: '3', price: '1,200', sub: 'Any 3 of the 14 pathogens' },
          { name: 'STD7 PCR', n: '7', price: '1,600', sub: 'Any 7 of the 14 pathogens' },
          { name: 'STD11 PCR', n: '11', price: '1,800', sub: 'Any 11 of the 14 pathogens' }
        ],
        stiTitle: 'Pathogens covered by STI PCR 14', stiSub: 'Detects the genetic material of 14 pathogens from a single sample. Included in STI PCR 14, Complete, Complete + HPV and Early Detection, or pick specific ones with STD3, STD7 and STD11 PCR.',
        pkgFoot: 'Prices are subject to change. Please confirm before your visit.',
        packages: [
          { name: 'Basic', sub: '6 blood screening tests', price: '880', tat: 'Results in 1 hour',
            items: ['HIV Ag/Ab', 'HBsAg (Hepatitis B)', 'HBsAb (Hepatitis B immunity)', 'Anti-HCV (Hepatitis C)', 'VDRL/RPR (Syphilis)', 'Anti-TP (Syphilis)'],
            sample: 'Sample: blood' },
          { name: 'STI PCR 14', sub: '14 pathogens by PCR', price: '2,100', tat: 'Results in 3 days',
            items: ['PCR for 14 pathogens (see list below)'],
            sample: 'Sample: urine, or vaginal, urethral or throat swab' },
          { name: 'Complete', sub: 'Basic + STI PCR 14', price: '2,690', tat: 'Results in 3 days', featured: true,
            items: ['6 blood screening tests', 'PCR for 14 pathogens'],
            sample: 'Sample: blood + urine or swab', note: 'Save 290 THB vs. separate tests' },
          { name: 'Complete + HPV', sub: 'Complete + HPV DNA', price: '3,290', tat: 'Results in 4 days',
            items: ['Everything in Complete', 'HPV DNA, 15 genotypes'],
            sample: 'Sample: blood + urine or swab' },
          { name: 'Early Detection', sub: 'Our most complete panel, with HIV RNA PCR', price: '6,590', tat: 'Results in 4 days',
            items: ['Everything in Complete + HPV', 'HIV RNA PCR', 'HSV IgG / IgM (Herpes)'],
            sample: 'Sample: blood + urine or swab' }
        ],
        addons: [
          { t: 'Home & hotel sample collection', d: '350 THB within 10 km, then 25 THB per extra km.', p: '350 THB' },
          { t: 'Doctor consultation', d: 'Available at iBliss Polyclinic (Wat Ket)', p: '300 THB' }
        ],
        stepsTitle: 'Three simple steps',
        steps: [
          { n: '01', t: 'Book online', d: 'Choose your package, branch, date and time right here on this page.' },
          { n: '02', t: 'Sample collection', d: 'At a branch or at your location. Quick, and no fasting needed.' },
          { n: '03', t: 'Results on LINE', d: 'HIV Ag/Ab in 1 hour. PCR results within 3\u20134 days.' }
        ],
        winTitle: 'When should you test?',
        winSub: 'Each test can detect infection at a different time after exposure. Testing at the right time makes your result more reliable.',
        pep: 'If your exposure was within the last 72 hours, see a doctor as soon as possible to assess post-exposure prophylaxis (PEP).',
        winColTest: 'Test', winColTime: 'Detectable after exposure, approx.',
        windows: [
          { test: 'HIV RNA PCR', time: '10\u201333 days' },
          { test: 'HIV Ag/Ab', time: '18\u201345 days' },
          { test: 'STI PCR', time: '1\u20132 weeks' },
          { test: 'Syphilis (VDRL/RPR, Anti-TP)', time: '3\u20136 weeks' }
        ],
        winNote: 'Times are approximate. A negative result before this window may need a repeat test \u2014 ask our team.',
        brTitle: 'Our branches',
        branches: [
          { area: 'San Kamphaeng, Chiang Mai', name: 'Medical Trend Lab Center', addr: '107/17 Moo 3, Ton Pao, San Kamphaeng, Chiang Mai 50130', hours: 'Mon\u2013Fri 07:00\u201319:00\nSat\u2013Sun 07:00\u201316:00' },
          { area: 'Hang Dong, Chiang Mai', name: 'Ratchaphruek Lab Chiang Mai', addr: '5/1 Moo 1, Chiang Mai\u2013Hot Rd, Hang Dong, Chiang Mai', hours: 'Daily 07:00\u201316:00' },
          { area: 'Wat Ket, Chiang Mai', name: 'Medical Trend Lab, iBliss Polyclinic branch', addr: '308/8 Chiang Mai\u2013Lamphun Rd, Wat Ket, Mueang, Chiang Mai', hours: 'Daily 07:00\u201316:00', tag: 'Doctor available' },
          { area: 'University of Phayao, Phayao', name: 'Medical Trend Healthcare Polyclinic', addr: '429 Moo 1, Mae Ka, Mueang, Phayao 56000', hours: 'Mon\u2013Sat 08:00\u201316:00' }
        ],
        faqTitle: 'Frequently asked questions',
        faq: [
          { q: 'How should I prepare?', a: 'No fasting is needed for blood tests. For a urine sample, avoid urinating for at least 1 hour beforehand.' },
          { q: 'Do I need an ID?', a: 'No ID card or passport is required to get tested.' },
          { q: 'How do I receive my results?', a: 'Results are sent on LINE, and English reports are available.' },
          { q: 'What if my result is positive?', a: 'Our team will guide you on next steps, and you can see a doctor at iBliss Polyclinic (Wat Ket).' },
          { q: 'How often should I get tested?', a: 'Sexually active people should test at least once a year, and more often with multiple partners or unprotected sex.' }
        ],
        endTitle: 'Book your test online',
        endSub: 'Choose your package, branch, date and time in minutes. Questions? Give us a call.',
        company: 'MedicalTrend Co., Ltd.',
        permit1: '[Advertising permit no.]', permit2: '[Healthcare facility license no.]'
      }
    };
}
export type StdCopy = ReturnType<typeof copyAll>['th'];

export function stiCopy(lang: StdLang) {
    if (lang === 'th') {
      return {
        title: 'PCR เลือกเชื้อเอง', sub: 'แตะเลือกเฉพาะเชื้อที่ต้องการตรวจจาก 14 เชื้อ ราคาปรับตามจำนวนเชื้อที่เลือกโดยอัตโนมัติ',
        meta: 'รู้ผลใน 3 วัน · ตัวอย่าง: ปัสสาวะ หรือ swab ช่องคลอด ท่อปัสสาวะ ลำคอ',
        unit: 'เชื้อ', count: (n: number) => 'เลือกแล้ว ' + n + ' จาก 14 เชื้อ', all: 'เลือกทั้ง 14 เชื้อ', clear: 'ล้างการเลือก',
        tierLab: ['1–3 เชื้อ', '4–7 เชื้อ', '8–11 เชื้อ', '12–14 เชื้อ'],
        customName: 'PCR เลือกเชื้อเอง', unsure: 'ยังไม่แน่ใจ ให้เจ้าหน้าที่แนะนำ', unsureSub: 'เจ้าหน้าที่จะแนะนำแพ็กเกจที่เหมาะกับคุณ',
        hintRoom: (r: number) => 'เลือกเพิ่มได้อีก ' + r + ' เชื้อในราคาเดิม',
        hintNext: (p: string) => 'ครบขั้นราคานี้แล้ว เชื้อถัดไปจะเป็นราคา ' + p + ' บาท',
        hintFull: 'ครบ 14 เชื้อ ราคาเท่ากับแพ็กเกจ STI PCR 14',
        hintNone: 'เริ่มแตะเลือกเชื้อด้านล่างได้เลย',
        barSel: 'รายการที่เลือก', barTotal: 'ยอดรวม', barGo: 'ดำเนินการจอง', barClear: 'ล้าง', needPick: 'เลือกเชื้ออย่างน้อย 1 ชนิด'
      };
    }
    return {
      title: 'Build your own PCR panel', sub: 'Tap to choose only the pathogens you want tested from the 14 below. The price adjusts automatically to how many you pick.',
      meta: 'Results in 3 days · Sample: urine, or vaginal, urethral or throat swab',
      unit: 'pathogens', count: (n: number) => n + ' of 14 pathogens selected', all: 'Select all 14', clear: 'Clear selection',
      tierLab: ['1–3 pathogens', '4–7 pathogens', '8–11 pathogens', '12–14 pathogens'],
      customName: 'Custom PCR panel', unsure: 'Not sure yet \u2014 please advise me', unsureSub: 'Our team will recommend the right package',
      hintRoom: (r: number) => 'Add ' + r + ' more at the same price',
      hintNext: (p: string) => 'Tier full \u2014 the next pathogen moves you to ' + p + ' THB',
      hintFull: 'All 14 selected \u2014 same price as STI PCR 14',
      hintNone: 'Tap the pathogens below to start',
      barSel: 'Your selection', barTotal: 'Total', barGo: 'Continue to booking', barClear: 'Clear', needPick: 'Select at least 1 pathogen'
    };
}

export function noticeCopy(lang: StdLang) {
    return lang === 'th' ? {
      inside: (a: string, b: string) => a + ' รวมอยู่ใน ' + b + ' แล้ว จึงไม่ต้องเพิ่มซ้ำ',
      replaced: (a: string, list: string) => a + ' รวมรายการของ ' + list + ' ไว้แล้ว จึงนำออกจากรายการให้',
      save: (x: string) => 'เปลี่ยนเป็น Complete (ครบ 6 รายการเลือด + PCR 14 เชื้อ) ประหยัดกว่า ' + x + ' บาท',
      more: (x: string) => 'เพิ่มอีกเพียง ' + x + ' บาท ได้ Complete ครบ 6 รายการเลือด + PCR 14 เชื้อ',
      upgrade: 'เปลี่ยนเป็น Complete'
    } : {
      inside: (a: string, b: string) => a + ' is already included in ' + b,
      replaced: (a: string, list: string) => a + ' already includes ' + list + ', so we removed it',
      save: (x: string) => 'Switch to Complete (6 blood tests + 14-pathogen PCR) and save ' + x + ' THB',
      more: (x: string) => 'Just ' + x + ' THB more gets you Complete: 6 blood tests + all 14 pathogens',
      upgrade: 'Switch to Complete'
    };
}

export function bookingCopy(lang: StdLang) {
    if (lang === 'th') {
      return {
        title: 'จองคิวตรวจออนไลน์', sub: 'กรอกข้อมูล เลือกสาขา วัน และเวลาที่สะดวก เจ้าหน้าที่จะยืนยันนัดหมายกับคุณทางโทรศัพท์หรืออีเมล',
        secContact: 'ข้อมูลผู้จอง', secVisit: 'เลือกวันและเวลา',
        name: 'ชื่อ-นามสกุล', email: 'อีเมล', phone: 'เบอร์โทรศัพท์', branch: 'สาขา', pkg: 'แพ็กเกจ', note: 'หมายเหตุ (ถ้ามี)',
        editPick: 'เลือกหรือแก้ไขเชื้อ', pickedLab: 'เชื้อที่เลือก',
        pickBranchFirst: 'กรุณาเลือกสาขาก่อน เพื่อดูวันและเวลาที่เปิดให้บริการ', pickDateFirst: 'เลือกวันที่เพื่อดูช่วงเวลา', noSlots: 'ไม่มีช่วงเวลาว่างในวันนี้ กรุณาเลือกวันอื่น',
        slots: 'ช่วงเวลา', prev: 'เดือนก่อนหน้า', next: 'เดือนถัดไป',
        consent: 'ยินยอมให้บริษัท เมดิคอลเทรนด์ จำกัด เก็บและใช้ข้อมูลนี้เพื่อการนัดหมายและติดต่อกลับ ตามนโยบายความเป็นส่วนตัว',
        submit: 'ยืนยันการจอง', total: 'ยอดรวม',
        eName: 'กรุณากรอกชื่อ', eEmail: 'กรุณากรอกอีเมลให้ถูกต้อง', ePhone: 'กรุณากรอกเบอร์โทรศัพท์ 9–10 หลัก', eBranch: 'กรุณาเลือกสาขา', ePkg: 'กรุณาเลือกแพ็กเกจ', ePick: 'กรุณาเลือกเชื้ออย่างน้อย 1 ชนิด', eDate: 'กรุณาเลือกวันที่', eSlot: 'กรุณาเลือกช่วงเวลา', eConsent: 'กรุณายินยอมก่อนส่งข้อมูล',
        doneTitle: 'ได้รับคำขอจองแล้ว', doneSub: 'เจ้าหน้าที่จะติดต่อยืนยันนัดหมายโดยเร็ว หากต้องการเปลี่ยนแปลง โทร 095-247-2631', again: 'จองคิวใหม่',
        sumDate: 'วันที่', sumTime: 'เวลา', sumBranch: 'สาขา', sumPkg: 'แพ็กเกจ', sumTotal: 'ยอดรวม',
        months: ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],
        dows: ['จ','อ','พ','พฤ','ศ','ส','อา'], be: true
      };
    }
    return {
      title: 'Book online', sub: 'Enter your details and choose a branch, date and time. Our team will confirm your appointment by phone or email.',
      secContact: 'Your details', secVisit: 'Choose date & time',
      name: 'Full name', email: 'Email', phone: 'Phone number', branch: 'Branch', pkg: 'Package', note: 'Notes (optional)',
      editPick: 'Choose or edit pathogens', pickedLab: 'Selected pathogens',
      pickBranchFirst: 'Select a branch first to see open days and times', pickDateFirst: 'Select a date to see time slots', noSlots: 'No time slots left on this day. Please choose another date.',
      slots: 'Time slots', prev: 'Previous month', next: 'Next month',
      consent: 'I consent to MedicalTrend Co., Ltd. collecting and using this information to arrange my appointment and contact me, in line with its privacy policy.',
      submit: 'Confirm booking', total: 'Total',
      eName: 'Please enter your name', eEmail: 'Please enter a valid email', ePhone: 'Please enter a 9\u201310 digit phone number', eBranch: 'Please select a branch', ePkg: 'Please select a package', ePick: 'Please select at least 1 pathogen', eDate: 'Please select a date', eSlot: 'Please select a time', eConsent: 'Please give consent before submitting',
      doneTitle: 'Booking request received', doneSub: 'Our team will contact you shortly to confirm. To make changes, call 095-247-2631.', again: 'Make another booking',
      sumDate: 'Date', sumTime: 'Time', sumBranch: 'Branch', sumPkg: 'Package', sumTotal: 'Total',
      months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      dows: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], be: false
    };
}
