// Static page content (branches, benefits, visit roadmap), copied from the Claude Design prototype.
import type { ReactNode } from 'react';
import type { BranchId } from '../shared/catalog';

type L = (th: string, en: string) => string;

export function Icon({ d, size = 22 }: { d: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

export interface Branch {
  id: BranchId; name: string; tag: string; address: string; landmark: string;
  phone: string; tel: string; email: string; logo: string; map: string;
}

export const branches = (L: L): Branch[] => [
  {
    id: 'sankamphaeng', name: L('ศูนย์แล็บ เมดิคอลเทรนด์', 'Medical Trend Lab Center'), tag: L('สันกำแพง', 'San Kamphaeng'),
    address: L('107/17 หมู่ 3 ต.ต้นเปา อ.สันกำแพง จ.เชียงใหม่ 50130', '107/17 Moo 3, Ton Pao, San Kamphaeng, Chiang Mai 50130'),
    landmark: '', phone: '095 247 2631', tel: '0952472631', email: 'medicaltrend.lab@gmail.com',
    logo: '/img/logo-mt-center-header.webp', map: 'https://maps.app.goo.gl/dHaP2e7HRyN2FW7V6',
  },
  {
    id: 'hangdong', name: L('ราชพฤกษ์แล็บเชียงใหม่', 'Ratchaphruek Lab Chiang Mai'), tag: L('หางดง', 'Hang Dong'),
    address: L('5/1 หมู่ที่ 1 ถนนเชียงใหม่-ฮอด ต.หางดง อ.หางดง จ.เชียงใหม่', '5/1 Moo 1, Chiang Mai–Hot Rd, Hang Dong, Chiang Mai'),
    landmark: '', phone: '085 717 8242', tel: '0857178242', email: 'ratchaphruek_lab@hotmail.com',
    logo: '/img/logo-prl.webp', map: 'https://maps.app.goo.gl/y9izRjZqGh4rdBw3A',
  },
  {
    id: 'watket', name: L('เมดิคอลเทรนด์แล็บ สาขาไอบลิส สหคลินิก', 'Medical Trend Lab, iBliss Polyclinic branch'), tag: L('วัดเกตุ', 'Wat Ket'),
    address: L('308/8 ถนนเชียงใหม่-ลำพูน ต.วัดเกตุ อ.เมือง จ.เชียงใหม่', '308/8 Chiang Mai–Lamphun Rd, Wat Ket, Mueang, Chiang Mai'),
    landmark: L('เวชกรรม + เทคนิคการแพทย์', 'Medicine + Medical Technology'),
    phone: '088 564 7132', tel: '0885647132', email: 'medicaltrend.ibliss@gmail.com',
    logo: '/img/logo-mt-center-header.webp', map: 'https://maps.app.goo.gl/fLN92AkvcfVXRNn7A',
  },
  {
    id: 'phayao', name: L('เมดิคอลเทรนด์ เฮลธ์แคร์ สหคลินิก', 'Medical Trend Healthcare Polyclinic'), tag: L('พะเยา', 'Phayao'),
    address: L('429 หมู่ที่ 1 ต.แม่กา อ.เมือง จ.พะเยา 56000', '429 Moo 1, Mae Ka, Mueang, Phayao 56000'),
    landmark: L('เทคนิคการแพทย์ + การพยาบาลและการผดุงครรภ์', 'Medical Technology + Nursing & Midwifery'),
    phone: '090 226 4192', tel: '0902264192', email: 'medicaltrend.th@gmail.com',
    logo: '/img/logo-mth.webp', map: 'https://maps.app.goo.gl/tDfmQh4GsNK9HKAbA',
  },
];

export interface Feature { title: string; en: string; body: string; icon: ReactNode }

export const features = (L: L): Feature[] => [
  { title: L('นักเทคนิคการแพทย์วิชาชีพ', 'Certified Medical Technologists'), en: L('Certified Medical Technologists', 'นักเทคนิคการแพทย์วิชาชีพ'), body: L('ทุกทีมมีใบประกอบวิชาชีพเทคนิคการแพทย์ ผ่านการอบรมการเจาะเลือดที่บ้านและการควบคุมการติดเชื้อ', 'Every team holds a medical technology license and is trained in home blood draws and infection control.'), icon: <Icon d={['M12 3 4 6v6c0 4.4 3.4 7.9 8 9 4.6-1.1 8-4.6 8-9V6l-8-3Z', 'm9 12 2 2 4-4']} /> },
  { title: L('ไม่ต้องรอคิวโรงพยาบาล', 'No Hospital Queues'), en: L('No Hospital Queues', 'ไม่ต้องรอคิวโรงพยาบาล'), body: L('เลือกช่วงเวลาที่สะดวก ทีมถึงบ้านตรงเวลา ใช้เวลาเจาะเลือดเฉลี่ย 15 นาที', 'Pick a convenient slot. The team arrives on time and a draw takes about 15 minutes.'), icon: <Icon d={['M12 7v5l3 2', 'M21 12a9 9 0 1 1-9-9']} /> },
  { title: L('ผลตรวจออนไลน์ปลอดภัย', 'Secure Online Reports'), en: L('Secure Online Reports', 'ผลตรวจออนไลน์ปลอดภัย'), body: L('ดูผลผ่านลิงก์ส่วนตัวพร้อมรหัส OTP เก็บข้อมูลตามมาตรฐาน PDPA ดาวน์โหลด PDF ได้ตลอดเวลา', 'View results via a private link with OTP. Data stored to PDPA standards, PDF download anytime.'), icon: <Icon d={['M6 10V8a6 6 0 0 1 12 0v2', 'M5 10h14v10H5z', 'M12 14v3']} /> },
  { title: L('ควบคุมอุณหภูมิตัวอย่าง', 'Cold-chain Transport'), en: L('Cold-chain Transport', 'ควบคุมอุณหภูมิตัวอย่าง'), body: L('ตัวอย่างเลือดบรรจุกล่องควบคุมอุณหภูมิ 2–8°C บันทึกอุณหภูมิตลอดเส้นทางถึงห้องแล็บ', 'Samples travel in 2–8°C temperature-controlled boxes, with temperature logged all the way to the lab.'), icon: <Icon d={['M12 3v18', 'M5 7l7 4 7-4', 'M5 17l7-4 7 4']} /> },
  { title: L('ดูแลผู้ป่วยติดเตียงโดยเฉพาะ', 'Bedridden Care Protocol'), en: L('Bedridden Care Protocol', 'ดูแลผู้ป่วยติดเตียงโดยเฉพาะ'), body: L('ทีม 2 คนพร้อมอุปกรณ์พยุงตัว เจาะเลือดในท่านอนได้อย่างปลอดภัย ประสานงานกับผู้ดูแลล่วงหน้า', 'A two-person team with support equipment draws blood safely lying down, coordinated with caregivers in advance.'), icon: <Icon d={['M4 18v-6h11a4 4 0 0 1 4 4v2', 'M4 18h16', 'M8 12V9', 'M7 6h3']} /> },
  { title: L('ปรึกษาผลกับทีมแล็บฟรี', 'Free Result Consultation'), en: L('Free Result Consultation', 'ปรึกษาผลกับทีมแล็บฟรี'), body: L('หลังผลออก โทรหรือแชทกับนักเทคนิคการแพทย์เพื่ออธิบายค่าผิดปกติ และแนะนำการตรวจติดตาม', 'After results are out, call or chat with a medical technologist about abnormal values and follow-up tests.'), icon: <Icon d={['M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z', 'M8 10h8', 'M8 13.5h5']} /> },
];

export interface VisitStep { n: string; title: string; body: string; time: string; icon: ReactNode }

export const visitSteps = (L: L): VisitStep[] => [
  { n: '1', title: L('จองผ่านเว็บหรือ LINE', 'Book via web or LINE'), body: L('เลือกแพ็กเกจ ปักหมุดที่อยู่ และแนบใบสั่งตรวจของแพทย์', "Choose a package, pin your address and attach your doctor's lab order."), time: L('ใช้เวลา 2 นาที', 'Takes 2 minutes'), icon: <Icon size={26} d={['M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z']} /> },
  { n: '2', title: L('ยืนยันนัดและคำแนะนำ', 'Confirmation & prep advice'), body: L('เจ้าหน้าที่โทรยืนยัน แจ้งการงดน้ำงดอาหารและยาที่ต้องหยุด', 'Staff call to confirm and explain fasting and any medication to pause.'), time: L('ภายใน 30 นาที', 'Within 30 minutes'), icon: <Icon size={26} d={['M4 6h16v12H4z', 'm4 7 8 6 8-6']} /> },
  { n: '3', title: L('ทีมเดินทางถึงบ้าน', 'Team travels to you'), body: L('ติดตามตำแหน่งทีมแบบเรียลไทม์ แสดงบัตรวิชาชีพก่อนเริ่มทุกครั้ง', 'Track the team in real time. They show their professional ID before starting.'), time: L('ตรงตามช่วงเวลาที่เลือก', 'Within your chosen slot'), icon: <Icon size={26} d={['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z', 'M12 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z']} /> },
  { n: '4', title: L('เจาะเลือดและส่งแล็บ', 'Blood draw & lab delivery'), body: L('เจาะในบ้านคุณ 15 นาที ตัวอย่างเข้าห้องแล็บภายใน 2 ชั่วโมง', '15 minutes at your home; samples reach the lab within 2 hours.'), time: L('15 นาทีที่บ้าน', '15 minutes at home'), icon: <Icon size={26} d={['M9.5 3h5', 'M10.5 3v6l-3.4 6.6A3 3 0 0 0 9.8 20h4.4a3 3 0 0 0 2.7-4.4L13.5 9V3', 'M8 15h8']} /> },
  { n: '5', title: L('รับผลและปรึกษา', 'Results & consultation'), body: L('ผลออนไลน์พร้อมคำอธิบาย นัดคุยกับนักเทคนิคการแพทย์ได้ฟรี', 'Online results with explanations, plus a free talk with a medical technologist.'), time: L('24–48 ชั่วโมง', '24–48 hours'), icon: <Icon size={26} d={['M4 4h13l3 3v13H4z', 'M8 12h8', 'M8 16h5']} /> },
];
