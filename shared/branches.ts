// Branch contact details for customer emails (the site's branch cards live in src/content.tsx — keep both in sync).
import type { BranchId } from './catalog';
import { BRANCH_MAP_LINKS } from './geo';

export interface BranchInfo { name: [string, string]; address: [string, string]; phone: string; map: string }

export const BRANCH_INFO: Record<BranchId, BranchInfo> = {
  sankamphaeng: {
    name: ['ศูนย์แล็บ เมดิคอลเทรนด์ (สันกำแพง)', 'Medical Trend Lab Center (San Kamphaeng)'],
    address: ['107/17 หมู่ 3 ต.ต้นเปา อ.สันกำแพง จ.เชียงใหม่ 50130', '107/17 Moo 3, Ton Pao, San Kamphaeng, Chiang Mai 50130'],
    phone: '095 247 2631', map: BRANCH_MAP_LINKS.sankamphaeng,
  },
  hangdong: {
    name: ['ราชพฤกษ์แล็บเชียงใหม่ (หางดง)', 'Ratchaphruek Lab Chiang Mai (Hang Dong)'],
    address: ['5/1 หมู่ที่ 1 ถนนเชียงใหม่-ฮอด ต.หางดง อ.หางดง จ.เชียงใหม่', '5/1 Moo 1, Chiang Mai–Hot Rd, Hang Dong, Chiang Mai'],
    phone: '085 717 8242', map: BRANCH_MAP_LINKS.hangdong,
  },
  watket: {
    name: ['เมดิคอลเทรนด์แล็บ สาขาไอบลิส สหคลินิก (วัดเกตุ)', 'Medical Trend Lab, iBliss Polyclinic (Wat Ket)'],
    address: ['308/8 ถนนเชียงใหม่-ลำพูน ต.วัดเกตุ อ.เมือง จ.เชียงใหม่', '308/8 Chiang Mai–Lamphun Rd, Wat Ket, Mueang, Chiang Mai'],
    phone: '088 564 7132', map: BRANCH_MAP_LINKS.watket,
  },
  phayao: {
    name: ['เมดิคอลเทรนด์ เฮลธ์แคร์ สหคลินิก (พะเยา)', 'Medical Trend Healthcare Polyclinic (Phayao)'],
    address: ['429 หมู่ที่ 1 ต.แม่กา อ.เมือง จ.พะเยา 56000', '429 Moo 1, Mae Ka, Mueang, Phayao 56000'],
    phone: '090 226 4192', map: BRANCH_MAP_LINKS.phayao,
  },
};
