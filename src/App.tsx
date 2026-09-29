import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  BRANCH_IDS, POPULAR, PRICING, SLOTS, packagePrices, popularKey, posterFor, snapshotCatalog, travelFee, travelTierLabel,
  type BranchId, type Catalog, type PatientType,
} from '../shared/catalog';
import { detectRef } from './ref';
import type { DistanceResult } from '../shared/geo';
import { findMapUrl, isShortMapUrl, mapsLinkFor, parseMapUrl } from '../shared/maps';
import { DICT, type Lang } from './i18n';
import { branches as branchList, features as featureList, visitSteps } from './content';
import { BookingDialog, type BookingDraft } from './BookingDialog';
import * as ui from './ui';

export interface Person { pks: string[]; picked: string[] }
const emptyPerson = (): Person => ({ pks: [], picked: [] });

const MAX_FILE = 10 * 1024 * 1024;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** YYYY-MM-DD in Bangkok time, offset by `days`. */
function bkkDate(days = 0) {
  return new Date(Date.now() + 7 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
}

function initialLang(): Lang {
  try { const l = localStorage.getItem('mt_lang'); if (l === 'en' || l === 'th') return l; } catch { /* storage blocked */ }
  return 'th';
}

const thaiWait = (v: string) => !v ? '—' : v.replace(/Hours?/i, 'ชั่วโมง').replace(/Days?/i, 'วัน').replace(/Mins?/i, 'นาที');
const enWait = (v: string) => !v ? '—' : v.replace(/Hours?/i, 'hr').replace(/Days?/i, 'days').replace(/Mins?/i, 'min');

const ALL = 'ทั้งหมด';
/** Quick-filter chip that gathers the HIV/STD single tests scattered across sheet categories. */
const STD_CAT = 'HIV/STD';
const STD_TEST = /hiv|syphilis|\brpr\b|vdrl|anti-?tp\b|\bhbs|hcv|hsv|\bhpv|\bsti\b|chlamyd|gonor|trichom|เพศสัมพันธ์|ซิฟิลิส|เริม/i;
const STD_WORD = /\bstds?\b|\bstis?\b|เพศสัมพันธ์/i;
const isStdTest = (x: { n: string; th: string }) => STD_TEST.test(x.n + ' ' + x.th);

/** Searches that mean the customer wants HIV/STD testing → suggest the dedicated /std page. */
const STD_QUERY = /hiv|\bstds?\b|\bsti\b|syph|ซิฟิลิส|หนองใน|gonor|chlamyd|เริม|herpes|hsv|hpv|vdrl|rpr|anti-?tp|trepon|เพศสัมพันธ์|ทริโค|trichom|mycoplasma|ureaplasma|แผลริมอ่อน|chancroid/i;

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [ref] = useState(() => detectRef('mt_ref'));
  const [mode, setMode] = useState<'lab' | 'home'>(() => new URLSearchParams(location.search).get('mode') === 'home' ? 'home' : 'lab');
  const [patient, setPatient] = useState<PatientType>('general');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  // Google Maps link pasted by the customer (or generated from the pin); sent to staff with the booking.
  const [mapLink, setMapLink] = useState<{ url: string; status: 'resolving' | 'ok' | 'nocoords'; fromPin?: boolean } | null>(null);
  const mapReq = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [branch, setBranch] = useState<BranchId>('sankamphaeng');
  const [distance, setDistance] = useState(8);
  // Distance worked out by the Worker from the customer's coordinates (nearest branch, road km).
  const [distInfo, setDistInfo] = useState<{ status: 'loading' | 'fail' } | (DistanceResult & { status: 'ok' }) | null>(null);
  const [visitDate, setVisitDate] = useState(() => bkkDate(1));
  const [slot, setSlot] = useState<string>(SLOTS[0]);
  const [testQuery, setTestQuery] = useState('');
  const [testCat, setTestCat] = useState(ALL);
  const [showAllTests, setShowAllTests] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(snapshotCatalog);
  const [syncState, setSyncState] = useState<'loading' | 'live' | 'offline'>('loading');
  const [persons, setPersons] = useState<Person[]>([emptyPerson()]);
  const [active, setActive] = useState(0);
  const [poster, setPoster] = useState<{ src: string; title: string } | null>(null);
  const [toast, setToast] = useState('');
  const [bookError, setBookError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const t = DICT[lang];
  const en = lang === 'en';
  const L = useCallback((th: string, e: string) => (en ? e : th), [en]);
  const pw = (n: number) => (en ? (n === 1 ? ' person' : ' people') : ' ท่าน');
  const personLabel = (i: number) => L('คนที่ ', 'Person ') + (i + 1);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => {
    try { localStorage.setItem('mt_lang', l); } catch { /* storage blocked */ }
    setLangState(l);
  };

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) throw new Error(String(res.status));
      const cat: Catalog = await res.json();
      setCatalog(cat);
      setSyncState(cat.source === 'live' ? 'live' : 'offline');
      return cat;
    } catch {
      setSyncState('offline');
      return null;
    }
  }, []);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!poster) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPoster(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poster]);

  // ---- pricing (same rules the Worker applies)
  const pkPrice = useMemo(() => packagePrices(catalog.packages), [catalog]);
  const testPrice = useMemo(() => new Map(catalog.tests.map(x => [x.n, x.p])), [catalog]);
  const pkgSum = (p: Person) => p.pks.reduce((a, k) => a + (pkPrice.get(k) ?? 0), 0);
  const pickedSum = (p: Person) => p.picked.reduce((a, k) => a + (testPrice.get(k) ?? 0), 0);
  const personSum = (p: Person) => pkgSum(p) + pickedSum(p);

  const act = Math.min(active, persons.length - 1);
  const cur = persons[act];
  const peopleTotal = persons.reduce((a, p) => a + personSum(p), 0);
  const travel = travelFee(mode, distance, persons.length);
  const total = peopleTotal + travel;
  const isHome = mode === 'home';
  const hasRx = !!file;
  const rxOnly = hasRx && persons.every(p => p.pks.length + p.picked.length === 0);
  const outOfArea = isHome && distInfo?.status === 'ok' && distInfo.km > PRICING.maxKm;

  const updatePerson = (i: number, fn: (p: Person) => Person) =>
    setPersons(ps => ps.map((p, j) => (j === i ? fn(p) : p)));
  const toggleIn = (list: string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : list.concat(key));

  const addPerson = (focus: boolean) => {
    if (persons.length >= PRICING.maxPeople) return;
    if (focus) setActive(persons.length);
    setPersons(persons.concat(emptyPerson()));
  };
  const removeLastPerson = () => {
    if (persons.length <= 1) return;
    setActive(Math.min(act, persons.length - 2));
    setPersons(persons.slice(0, -1));
  };
  const removePerson = (i: number) => {
    if (persons.length <= 1) return;
    setActive(Math.max(0, Math.min(act > i ? act - 1 : act, persons.length - 2)));
    setPersons(persons.filter((_, j) => j !== i));
  };

  // ---- tests table
  const cats = useMemo(() => [ALL, STD_CAT].concat(catalog.tests.map(x => x.c).filter((c, i, a) => a.indexOf(c) === i)), [catalog]);
  const q = testQuery.trim().toLowerCase();
  const stdWord = STD_WORD.test(q);
  const filtered = catalog.tests.filter(x =>
    (testCat === ALL || (testCat === STD_CAT ? isStdTest(x) : x.c === testCat)) &&
    (!q || x.n.toLowerCase().includes(q) || x.th.includes(testQuery.trim()) || (stdWord && isStdTest(x))));
  const shown = showAllTests ? filtered : filtered.slice(0, 12);

  // ---- STEP 1 helpers
  useEffect(() => {
    if (!isHome || !coords) { setDistInfo(null); return; }
    let live = true;
    setDistInfo({ status: 'loading' });
    fetch(`/api/distance?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => r.json().catch(() => ({})))
      .then((r: Partial<DistanceResult>) => {
        if (!live) return;
        if (r.ok && typeof r.km === 'number' && r.branch && r.method) {
          setDistInfo({ status: 'ok', ok: true, km: r.km, branch: r.branch, method: r.method });
          setDistance(Math.min(Math.max(r.km, PRICING.minKm), PRICING.maxKm));
        } else setDistInfo({ status: 'fail' });
      })
      .catch(() => { if (live) setDistInfo({ status: 'fail' }); });
    return () => { live = false; };
  }, [isHome, coords]);

  const usePin = () => {
    if (!navigator.geolocation) { setToast(t.locFail); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setAddress(L('ปักหมุดแล้ว · ', 'Pinned · ') + lat.toFixed(4) + '° N, ' + lng.toFixed(4) + '° E');
        mapReq.current++;
        setMapLink({ url: mapsLinkFor(+lat.toFixed(6), +lng.toFixed(6)), status: 'ok', fromPin: true });
        setLocating(false);
      },
      () => { setLocating(false); setToast(t.locFail); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };
  const onAddressChange = (text: string) => {
    const url = findMapUrl(text);
    if (!url) {
      setAddress(text);
      if (!mapLink) setCoords(null);
      return;
    }
    // A Google Maps share link: keep any text around it as the address, read the location from the link.
    const rest = text.replace(url, ' ').replace(/\s+/g, ' ').trim();
    const req = ++mapReq.current;
    const apply = (lat: number, lng: number, name: string | null, finalUrl: string) => {
      if (req !== mapReq.current) return;
      setCoords({ lat, lng });
      setMapLink({ url: finalUrl, status: 'ok' });
      setAddress(a => a || name || L('ตำแหน่งจาก Google Maps', 'Location from Google Maps'));
    };
    setAddress(rest);
    const direct = parseMapUrl(url);
    if (direct) { apply(direct.lat, direct.lng, direct.name, url); return; }
    setMapLink({ url, status: isShortMapUrl(url) ? 'resolving' : 'nocoords' });
    if (!rest) setAddress(L('ตำแหน่งจาก Google Maps', 'Location from Google Maps'));
    if (!isShortMapUrl(url)) return;
    fetch('/api/maps/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      .then(r => r.json().catch(() => ({})))
      .then((r: { ok?: boolean; lat?: number; lng?: number; name?: string | null; url?: string }) => {
        if (req !== mapReq.current) return;
        if (r.ok && typeof r.lat === 'number' && typeof r.lng === 'number') {
          apply(r.lat, r.lng, r.name ?? null, url);
          if (r.name && !rest) setAddress(r.name);
        } else setMapLink({ url, status: 'nocoords' });
      })
      .catch(() => { if (req === mapReq.current) setMapLink({ url, status: 'nocoords' }); });
  };
  const clearMapLink = () => { mapReq.current++; setMapLink(null); setCoords(null); };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE || !FILE_TYPES.includes(f.type)) { setFileError(t.errFile); return; }
    setFileError('');
    setFile(f);
  };

  // ---- STEP 5
  const startBooking = () => {
    if (!hasRx && persons.some(p => p.pks.length + p.picked.length === 0)) return setBookError(t.errEmpty);
    if (isHome && address.trim().length < 5) return setBookError(t.errAddress);
    if (outOfArea) return setBookError(t.outOfArea);
    if (isHome && distInfo?.status === 'loading') return;
    if (!visitDate || visitDate < bkkDate(0)) return setBookError(t.errDate);
    setBookError('');
    setDialogOpen(true);
  };
  const draft: BookingDraft = {
    mode, branch, visitDate, slot, address, coords, mapUrl: mapLink?.url ?? null, ref, patientType: patient, distanceKm: distance, file, lang,
    persons: persons.map(p => ({ packages: p.pks, tests: p.picked })),
    total,
    rxPending: hasRx,
  };
  const resetBooking = () => {
    setPersons([emptyPerson()]); setActive(0); setFile(null); setAddress(''); setCoords(null); setMapLink(null);
  };

  const branchesView = branchList(L);
  const panelTitle = isHome ? L('นัดทีมเจาะเลือดถึงบ้าน', 'Book a home collection team') : L('นัดเข้ารับบริการที่สาขา', 'Book a branch visit');
  const ctaLabel = isHome ? L('จองบริการถึงบ้าน', 'Book home service') : L('จองคิวที่แล็บ', 'Book lab queue');
  const channelSummary = isHome
    ? L('เจาะเลือดถึงบ้าน · ', 'Home collection · ') + (address || L('ยังไม่ระบุที่อยู่', 'No address yet')) + L(' · ระยะทาง ', ' · distance ') + distance + L(' กม.', ' km')
    : L('เข้ารับบริการที่สาขา · ', 'Branch visit · ') + branchesView.find(b => b.id === branch)!.name + L(' · ไม่มีค่าเดินทาง', ' · no travel fee');
  const pkCount = persons.reduce((a, p) => a + p.pks.length, 0);
  const pickCount = persons.reduce((a, p) => a + p.picked.length, 0);
  const barSummary = persons.length + pw(persons.length) + ' · ' + pkCount + L(' แพ็กเกจ · ', ' packages · ') +
    pickCount + L(' รายการเดี่ยว', ' single tests') + (isHome && travel ? L(' · ค่าเดินทาง ฿', ' · travel ฿') + ui.fmt(travel) : '');

  const lineItems = persons.map((p, i) => {
    const cnt = p.picked.length;
    if (hasRx && p.pks.length + cnt === 0) return { label: personLabel(i) + ' · ' + t.rxPersonLabel, note: t.rxPendingNote, value: t.rxPending };
    return {
      label: personLabel(i) + ' · ' + (p.pks.length ? p.pks.join(' + ') : L('ไม่เลือกแพ็กเกจ', 'No package')),
      note: (p.pks.length ? L('แพ็กเกจ ฿', 'Package ฿') + ui.fmt(pkgSum(p)) : L('เฉพาะรายการเดี่ยว', 'Single tests only')) +
        (cnt ? L(' + รายการเดี่ยว ', ' + ') + cnt + L(' รายการ', ' single tests') : ''),
      value: '฿' + ui.fmt(personSum(p)),
    };
  }).concat(isHome ? [{
    label: L('ค่าบริการเจาะเลือดถึงบ้าน', 'Home collection fee'),
    note: L('ระยะ ' + travelTierLabel(distance) + ' กม. · เหมาจ่ายต่อครั้ง ไม่เกิน 5 ท่าน', travelTierLabel(distance) + ' km · flat per visit, up to 5 people') +
      (persons.length > PRICING.includedPeople
        ? L(' + ท่านที่ 6 ขึ้นไป ฿' + PRICING.extraPersonFee + '/ท่าน', ' + ฿' + PRICING.extraPersonFee + ' per extra person')
        : ''),
    value: travel ? '฿' + ui.fmt(travel) : L('ฟรี', 'Free'),
  }] : []).concat(hasRx && !rxOnly ? [{
    label: t.rxPersonLabel, note: t.rxPendingNote, value: t.rxPending,
  }] : []).concat([{
    label: L('ค่าจัดส่งผลตรวจออนไลน์', 'Online result delivery'), note: L('PDF พร้อมคำอธิบายผล', 'PDF with explanations'), value: L('ฟรี', 'Free'),
  }]);

  const syncBadgeText = syncState === 'live' ? L('ซิงก์แล้ว', 'Synced') : syncState === 'loading' ? L('กำลังดึงข้อมูล', 'Loading') : L('ข้อมูลสำรอง', 'Backup data');
  const syncNote = syncState === 'live'
    ? L(`แพ็กเกจ ${catalog.packages.length} ชุด และรายการตรวจ ${catalog.tests.length} รายการ ดึงสดจาก Master Price List 2026 (คอลัมน์ Retail) แก้ในชีตแล้วหน้านี้อัปเดตภายใน 1 นาทีเมื่อโหลดใหม่`,
      `${catalog.packages.length} packages and ${catalog.tests.length} tests pulled live from Master Price List 2026 (Retail column). Sheet edits appear within a minute on reload.`)
    : syncState === 'loading'
      ? L('กำลังเชื่อมต่อ Master Price List 2026', 'Connecting to Master Price List 2026')
      : L('เชื่อมต่อชีตไม่ได้ (ต้องตั้งค่าแชร์เป็น Anyone with the link) กำลังแสดงราคาชุดสำรองที่บันทึกไว้',
        'Could not reach the sheet (share it as Anyone with the link). Showing saved backup prices.');

  const zoneNote = locating ? t.locating : address
    ? ''
    : L('พิมพ์ที่อยู่ วางลิงก์ Google Maps หรือกดปุ่มเพื่อปักหมุดตำแหน่งปัจจุบัน', 'Type an address, paste a Google Maps link, or tap the button to pin your current location');
  const patientNote = patient === 'bedridden'
    ? L('ทีม 2 คน พร้อมเตียงลมและอุปกรณ์ช่วยพยุง', '2-person team with air mattress and support equipment')
    : patient === 'elderly'
      ? L('เจาะโดยผู้เชี่ยวชาญเส้นเลือดเปราะ วัดความดันฟรี', 'Drawn by specialists in fragile veins · free blood pressure check')
      : L('ทีม 1 คน ใช้เวลาที่บ้านประมาณ 15 นาที', '1-person team · about 15 minutes at home');

  const dateSlot = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div>
        <label style={ui.label} htmlFor={'date-' + mode}>{t.dateLabel}</label>
        <input id={'date-' + mode} type="date" className="f-plain" value={visitDate} min={bkkDate(0)} max={bkkDate(90)}
          onChange={e => setVisitDate(e.target.value)} style={ui.field} />
      </div>
      <div>
        <label style={ui.label} htmlFor={'slot-' + mode}>{t.slotLabel}</label>
        <select id={'slot-' + mode} className="f-plain" value={slot} onChange={e => setSlot(e.target.value)} style={ui.field}>
          {SLOTS.map((s, i) => <option key={s} value={s}>{s}{i === 0 ? ` (${t.fasting})` : ''}</option>)}
        </select>
      </div>
    </div>
  );

  const rxField = (
    <div>
      <span style={ui.label}>{t.rxLabel}</span>
      <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
      <div style={{ position: 'relative' }}>
        <button onClick={() => fileInput.current?.click()} style={ui.uploadBtn(!!file)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M12 4 7.5 8.5M12 4l4.5 4.5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></svg>
          <span style={{ fontWeight: 600, fontSize: 13.5, wordBreak: 'break-all', paddingRight: file ? 30 : 0 }}>{file ? file.name : L('อัปโหลดใบสั่งตรวจจากแพทย์', "Upload doctor's lab order")}</span>
          <span style={{ fontSize: 11.5, opacity: .7 }}>{t.rxHint}</span>
        </button>
        {file && (
          <button onClick={() => setFile(null)} title={t.removeFile} aria-label={t.removeFile} className="h-soft" style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, border: 0, borderRadius: 8, background: '#fff', color: '#0A6E62', fontSize: 16, cursor: 'pointer' }}>×</button>
        )}
      </div>
      {fileError && <div role="alert" style={{ fontSize: 11.5, color: '#B4432A', marginTop: 6, fontWeight: 500 }}>{fileError}</div>}
      {file && (
        <div role="status" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, padding: '9px 11px', borderRadius: 10, border: '1px solid #BFE5DE', background: '#F4FBF9', color: '#0A6E62' }}>
          <b>{t.rxOnlyT}</b><span style={{ display: 'block', opacity: .85 }}>{t.rxOnlyD}</span>
        </div>
      )}
    </div>
  );

  const km = t.km;
  const distanceBlock = (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <label htmlFor="dist" style={ui.label}>{t.distLabel}</label>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0B4F9E' }}>{distInfo?.status === 'loading' ? '…' : distance + ' ' + km}</span>
      </div>
      {distInfo?.status === 'ok' ? (
        <div role="status" style={{ fontSize: 12, lineHeight: 1.55, padding: '9px 11px', borderRadius: 10, border: '1px solid ' + (outOfArea ? '#F3CDB5' : '#BFE5DE'), background: outOfArea ? '#FFF1E8' : '#F4FBF9', color: outOfArea ? '#9A5220' : '#0A6E62' }}>
          {outOfArea ? t.outOfArea : <>
            <b>{(distInfo.method === 'road' ? t.distRoad : t.distStraight) + ' ' + distInfo.km + ' ' + km}</b>
            {' · ' + t.distFrom + ' ' + (branchList(L).find(b => b.id === distInfo.branch)?.name || distInfo.branch)}
            <span style={{ display: 'block', opacity: .8 }}>{t.distAuto}</span>
          </>}
        </div>
      ) : distInfo?.status === 'loading' ? (
        <div role="status" style={{ fontSize: 12, color: '#6B7F99' }}>{t.distLoading}</div>
      ) : (
        <>
          <input id="dist" type="range" min={PRICING.minKm} max={PRICING.maxKm} step={1} value={distance} onChange={e => setDistance(Number(e.target.value))} style={{ width: '100%', accentColor: '#1466C7', height: 6, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8FA6C0', marginTop: 6 }}>
            <span>1 {km}</span><span>{t.cityFree}</span><span>{PRICING.maxKm} {km}</span>
          </div>
          <div style={{ fontSize: 11.5, color: distInfo?.status === 'fail' ? '#9A5220' : '#8FA6C0', marginTop: 6, lineHeight: 1.5 }}>{distInfo?.status === 'fail' ? t.distFail : t.distManual}</div>
        </>
      )}
    </div>
  );

  const openPoster = (src: string, title: string) => setPoster({ src, title });

  return (
    <div style={{ fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', sans-serif", color: '#0F2540', background: '#F5F8FC', minHeight: '100vh' }}>

      {/* ---------------------------------------------------------------- header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid #E2EAF3' }}>
        <div className="hdr-inner" style={{ ...ui.wrap, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 28 }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 14, marginRight: 'auto', color: 'inherit' }}>
            <img className="hdr-logo" src="/img/logo-mt-center-header.webp" alt="Medical Trend — ศูนย์แล็บ ตรวจเลือด ตรวจสุขภาพ" style={{ height: 54, width: 'auto', display: 'block', flexShrink: 0 }} />
            <div className="hdr-brand-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, paddingLeft: 14, borderLeft: '1px solid #E2EAF3' }}>
              <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>Lab Network &amp; Home Service</span>
              <span className="hdr-sub" style={{ fontSize: 11, color: '#6B7F99', letterSpacing: '.04em' }}>{t.hdrSub}</span>
            </div>
          </a>
          <nav className="hdr-nav" style={{ display: 'flex', gap: 26, fontSize: 14, fontWeight: 500 }}>
            <a href="#features" className="h-nav" style={{ color: '#3D5674' }}>{t.navServices}</a>
            <a href="#pricing" className="h-nav" style={{ color: '#3D5674' }}>{t.navPricing}</a>
            <a href="#how" className="h-nav" style={{ color: '#3D5674' }}>{t.navHow}</a>
            <a href="#branches" className="h-nav" style={{ color: '#3D5674' }}>{t.navBranches}</a>
            <a href="/std?ref=main-nav" className="h-nav" style={{ color: '#3D5674' }}>{t.navStd}</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a className="hdr-tel" href="tel:0952472631" style={{ fontSize: 13, color: '#6B7F99', fontWeight: 500 }}>{t.call} 095 247 2631</a>
            <div style={{ display: 'flex', gap: 2, padding: 3, background: '#EEF3F9', borderRadius: 999 }} role="group" aria-label="Language">
              <button onClick={() => setLang('th')} style={ui.langBtn(!en)} aria-pressed={!en}>TH</button>
              <button onClick={() => setLang('en')} style={ui.langBtn(en)} aria-pressed={en}>EN</button>
            </div>
            <button onClick={() => setToast(t.loginSoon)} className="h-login" style={{ border: 0, background: '#0B4F9E', color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 18px', borderRadius: 999, cursor: 'pointer', transition: 'background .18s', whiteSpace: 'nowrap' }}>{t.login}</button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- hero + STEP 1 */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(165deg, #062F63 0%, #0B4F9E 48%, #10739E 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 82% 18%, rgba(23,184,166,.38), transparent 46%), radial-gradient(circle at 8% 88%, rgba(11,79,158,.6), transparent 40%)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: .16, backgroundImage: 'linear-gradient(#ffffff33 1px, transparent 1px), linear-gradient(90deg, #ffffff33 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

        <div className="hero-inner" style={{ position: 'relative', ...ui.wrap, padding: '76px 24px 96px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 56, alignItems: 'start' }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 14px 7px 10px', borderRadius: 999, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.24)', color: '#CDE9FF', fontSize: 13, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4FE3C1', animation: 'pulseRing 2.4s infinite', flexShrink: 0 }} />
              {t.heroBadge}
            </div>
            <h1 style={{ margin: '22px 0 0', fontSize: 'clamp(34px, 4.6vw, 60px)', lineHeight: 1.05, letterSpacing: '-.03em', fontWeight: 700, color: '#fff', textWrap: 'balance' }}>{t.heroH1a}<br />{t.heroH1b}</h1>
            <p style={{ margin: '22px 0 0', fontSize: 18, lineHeight: 1.62, color: '#C6DCF2', maxWidth: 480, textWrap: 'pretty' }}>{t.heroP}</p>
            <div className="stat-grid" style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 20, maxWidth: 460 }}>
              {[[t.statBranches, t.statBranchesSub], ['12,400+', t.statCasesSub], [t.statHours, t.statHoursSub]].map(([big, small]) => (
                <div key={small} style={{ borderLeft: '2px solid rgba(79,227,193,.55)', paddingLeft: 14 }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>{big}</div>
                  <div style={{ fontSize: 12.5, color: '#9FC2E0', lineHeight: 1.4 }}>{small}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 22, padding: 10, boxShadow: '0 32px 70px -24px rgba(4,28,58,.55), 0 0 0 1px rgba(255,255,255,.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 14px' }}>
              <span style={ui.stepBadge}>STEP 1</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#3D5674' }}>{t.step1Title}</span>
            </div>
            <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#EEF3F9', borderRadius: 15, padding: 5 }}>
              <button role="tab" aria-selected={!isHome} onClick={() => setMode('lab')} style={ui.modeTab(!isHome)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M9 3h6M10 3v6.5L5.6 17a3 3 0 0 0 2.6 4.5h7.6A3 3 0 0 0 18.4 17L14 9.5V3" /><path d="M7 15h10" /></svg>
                {t.tabLab}
              </button>
              <button role="tab" aria-selected={isHome} onClick={() => setMode('home')} style={ui.modeTab(isHome)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M12 12.5v4M10 14.5h4" /></svg>
                {t.tabHome}
              </button>
            </div>

            <div style={{ padding: '24px 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-.015em' }}>{panelTitle}</h2>
                <span style={{ fontSize: 12, color: '#17A090', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.freeConsult}</span>
              </div>

              {isHome ? (
                <div key="home" style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'riseIn .32s ease both' }}>
                  <div>
                    <label style={ui.label} htmlFor="addr">{t.addrLabel}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <svg style={{ position: 'absolute', left: 13, color: '#8FA6C0' }} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>
                      <input id="addr" className="f-input" value={address} onChange={e => onAddressChange(e.target.value)} placeholder={t.addrPh} autoComplete="street-address"
                        style={{ width: '100%', padding: '13px 44px 13px 38px', border: '1.5px solid #DCE5EF', borderRadius: 12, fontSize: 14, color: '#0F2540', outline: 'none' }} />
                      <button title={t.useLoc} aria-label={t.useLoc} onClick={usePin} className="h-pin" style={{ position: 'absolute', right: 7, width: 30, height: 30, border: 0, borderRadius: 9, background: '#E8F6F3', color: '#0E8C7C', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={locating ? { animation: 'spin 1s linear infinite' } : undefined}><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="5" /></svg>
                      </button>
                    </div>
                    {mapLink && (
                      <div role="status" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + (mapLink.status === 'nocoords' ? '#F3E2BD' : '#BFE5DE'), background: mapLink.status === 'nocoords' ? '#FFF8EA' : '#F4FBF9', color: mapLink.status === 'nocoords' ? '#6B5210' : '#0A6E62' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={mapLink.status === 'resolving' ? { animation: 'spin 1s linear infinite' } : undefined}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>
                        <span style={{ fontWeight: 600, flex: '1 1 auto', minWidth: 0 }}>
                          {mapLink.status === 'resolving'
                            ? L('กำลังอ่านตำแหน่งจากลิงก์ Google Maps…', 'Reading location from Google Maps link…')
                            : mapLink.status === 'nocoords'
                              ? L('บันทึกลิงก์ Google Maps แล้ว · เจ้าหน้าที่จะเปิดดูตำแหน่งจากลิงก์', 'Google Maps link saved · staff will open it to find you')
                              : (mapLink.fromPin ? L('ปักหมุดตำแหน่งปัจจุบันแล้ว', 'Current location pinned') : L('ได้ตำแหน่งจาก Google Maps แล้ว', 'Location read from Google Maps')) + (coords ? ' · ' + coords.lat.toFixed(5) + ', ' + coords.lng.toFixed(5) : '')}
                        </span>
                        <a href={mapLink.url} target="_blank" rel="noopener" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>{L('เปิดดู', 'Open')} ↗</a>
                        <button onClick={clearMapLink} aria-label={L('ลบลิงก์ตำแหน่ง', 'Remove location link')} style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: '0 2px', opacity: .7 }}>×</button>
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: '#8FA6C0', marginTop: 6 }}>{zoneNote}</div>
                  </div>

                  {distanceBlock}

                  <div>
                    <span style={ui.label}>{t.patientType}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {([['general', t.pGen, t.pGenSub], ['elderly', t.pEld, t.pEldSub], ['bedridden', t.pBed, t.pBedSub]] as const).map(([id, a, b]) => (
                        <button key={id} onClick={() => setPatient(id)} style={ui.patientChip(patient === id)} aria-pressed={patient === id}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{a}</span>
                          <span style={{ fontSize: 10.5, opacity: .72 }}>{b}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#17A090', marginTop: 7, fontWeight: 500 }}>{patientNote}</div>
                  </div>

                  {rxField}

                  {dateSlot}
                </div>
              ) : (
                <div key="lab" style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'riseIn .32s ease both' }}>
                  <div>
                    <label style={ui.label} htmlFor="branch">{t.branchPick}</label>
                    <select id="branch" className="f-plain" value={branch} onChange={e => setBranch(e.target.value as BranchId)} style={{ ...ui.field, padding: 13, fontSize: 14 }}>
                      {BRANCH_IDS.map((id, i) => <option key={id} value={id}>{[t.br1, t.br2, t.br3, t.br4][i]}</option>)}
                    </select>
                  </div>
                  {dateSlot}
                  {rxField}
                  <div style={{ background: '#F1F6FC', border: '1px solid #DCE8F5', borderRadius: 12, padding: '13px 14px', fontSize: 12.5, color: '#3D5674', lineHeight: 1.55 }}>{t.labNote}</div>
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 14px', border: '1.5px solid #DCE5EF', borderRadius: 12, background: '#F7FAFD' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3D5674' }}>{t.peopleLabel}</span>
                  <span style={{ fontSize: 11.5, color: '#8FA6C0' }}>{t.peopleHint}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1.5px solid #DCE5EF', borderRadius: 999, padding: 4, flexShrink: 0 }}>
                  <button onClick={removeLastPerson} title={t.dec} aria-label={t.dec} className="h-soft" style={stepperBtn}>−</button>
                  <span aria-live="polite" style={{ minWidth: 44, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#0F2540' }}>{persons.length}</span>
                  <button onClick={() => addPerson(false)} title={t.inc} aria-label={t.inc} className="h-soft" style={stepperBtn}>+</button>
                </span>
              </div>

              {persons.length > 1 && (
                <div style={{ marginTop: 10, padding: '13px 14px', border: '1.5px solid #DCE5EF', borderRadius: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#3D5674', marginBottom: 9 }}>{t.addingFor}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {persons.map((_, i) => (
                      <button key={i} onClick={() => setActive(i)} style={ui.personChip(i === act)} aria-pressed={i === act}>{personLabel(i)}</button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 18, borderTop: '1px dashed #DCE5EF', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11.5, color: '#6B7F99' }}>{hasRx ? t.estimateRx : t.estimate}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>฿{ui.fmt(total)}</div>
                </div>
                {hasRx ? (
                  <a href="#book" className="h-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#17B8A6', color: '#042F2A', fontSize: 14, fontWeight: 700, padding: '13px 20px', borderRadius: 12 }}>
                    {t.rxCta}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></svg>
                  </a>
                ) : (
                <a href="#popular" className="h-link-soft" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EAF3FF', color: '#0B4F9E', fontSize: 14, fontWeight: 600, padding: '13px 20px', borderRadius: 12 }}>
                  {t.toStep2}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></svg>
                </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- features */}
      <section id="features" className="wrap" style={{ ...ui.wrap, padding: '84px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 36 }}>
          <div>
            <div style={ui.eyebrow}>Why MediTrend</div>
            <h2 style={{ margin: '12px 0 0', ...ui.h2Big }}>{t.featH2a}<br />{t.featH2b}</h2>
          </div>
          <p style={{ ...ui.lede, maxWidth: 380 }}>{t.featP}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(272px, 100%), 1fr))', gap: 18 }}>
          {featureList(L).map(f => (
            <div key={f.en} className="h-lift" style={{ background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: '26px 24px 24px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: '#EAF3FF', color: '#0B4F9E', display: 'grid', placeItems: 'center', marginBottom: 18 }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 16.5, fontWeight: 700, letterSpacing: '-.01em' }}>{f.title}</h3>
              <div style={{ fontSize: 12, color: '#8FA6C0', marginBottom: 10, letterSpacing: '.02em' }}>{f.en}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.62, color: '#536C89', textWrap: 'pretty' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- STEP 2 popular */}
      <section id="popular" className="wrap" style={{ ...ui.wrap, padding: '76px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={ui.stepBadge}>STEP 2</span>
          <span style={ui.eyebrow}>Popular tests</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 28 }}>
          <h2 style={{ margin: 0, ...ui.h2Step }}>{t.popH2}</h2>
          <p style={{ ...ui.lede, maxWidth: 420, fontSize: 14.5 }}>{t.popP} {personLabel(act)}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(268px, 100%), 1fr))', gap: 18 }}>
          {POPULAR.map(p => {
            const on = p.tiers ? p.tiers.some(tr => cur.pks.includes(popularKey(p, tr))) : cur.pks.includes(p.name);
            const name = en ? p.nameEn : p.name;
            const toggle = (key: string, group: boolean) => updatePerson(act, pp => {
              if (pp.pks.includes(key)) return { ...pp, pks: pp.pks.filter(k => k !== key) };
              const rest = group ? pp.pks.filter(k => !k.startsWith(p.name)) : pp.pks;
              return { ...pp, pks: rest.concat(key) };
            });
            return (
              <div key={p.name} style={ui.popularCard(on)}>
                <button onClick={() => openPoster(p.poster, name)} title={t.viewDetail} aria-label={t.viewDetail + ' · ' + name} style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: 0, background: '#EAF3FF', cursor: 'zoom-in', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                  <img src={p.poster} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
                <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.35 }}>{name}</div>
                  <div style={{ fontSize: 12.5, color: '#536C89', lineHeight: 1.55, textWrap: 'pretty' }}>{en ? p.detailEn : p.detail}</div>
                  {p.stdLink ? (
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          {p.was && <span style={{ fontSize: 11.5, color: '#93AEC4', textDecoration: 'line-through' }}>฿{ui.fmt(p.was)}</span>}
                          {p.tiers && <span style={{ fontSize: 11.5, color: '#6B7F99' }}>{L('เริ่มต้น', 'From')}</span>}
                          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: '#0B4F9E', whiteSpace: 'nowrap' }}>
                            ฿{ui.fmt(p.tiers ? p.tiers[0].price : p.price!)}
                          </span>
                        </span>
                        <a href="/std?ref=main-popular#packages" className="h-pale" style={{ ...ui.popularBtn(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t.stdCardCta}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
                        </a>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#8FA6C0', lineHeight: 1.5 }}>{t.stdCardNote}</div>
                    </div>
                  ) : p.tiers ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 'auto', paddingTop: 4 }}>
                      {p.tiers.map(tr => {
                        const key = popularKey(p, tr);
                        const sel = cur.pks.includes(key);
                        return (
                          <button key={key} onClick={() => toggle(key, true)} style={ui.tierBtn(sel)} aria-pressed={sel}>
                            <span style={{ fontWeight: 700 }}>{en ? tr.label.replace('เชื้อ', 'pathogens') : tr.label}</span>
                            <span style={{ opacity: .72 }}>฿{ui.fmt(tr.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6 }}>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        {p.was && <span style={{ fontSize: 11.5, color: '#93AEC4', textDecoration: 'line-through' }}>฿{ui.fmt(p.was)}</span>}
                        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: '#0B4F9E' }}>฿{ui.fmt(p.price!)}</span>
                      </span>
                      <button onClick={() => toggle(p.name, false)} style={ui.popularBtn(on)} aria-pressed={on}>{on ? L('เลือกแล้ว ✓', 'Selected ✓') : L('เลือกรายการนี้', 'Select')}</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
              <a href="/std?ref=main-popular-more" style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 600, color: '#0B4F9E' }}>
          {L('ตรวจ HIV และโรคติดต่อทางเพศสัมพันธ์ครบทุกแพ็กเกจ · เลือกเชื้อ PCR เอง', 'All HIV & STD packages · build your own PCR panel')}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
        </a>
      </section>

      {/* ---------------------------------------------------------------- STEP 3 packages + STEP 4 tests */}
      <section id="pricing" className="wrap" style={{ ...ui.wrap, padding: '76px 24px 88px' }}>
        <div style={{ background: '#fff', border: '1px solid #E4ECF5', borderRadius: 26, overflow: 'hidden' }}>
          <div className="card-pad" style={{ padding: '42px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={ui.stepBadge}>STEP 3</span>
              <span style={ui.eyebrow}>Package selection</span>
            </div>
            <h2 style={{ margin: '0 0 10px', ...ui.h2Step }}>{t.pkgH2}</h2>
            <p style={{ margin: '0 0 30px', fontSize: 14.5, lineHeight: 1.65, color: '#536C89' }}>{t.pkgP}</p>

            <div style={{ marginBottom: 22, padding: 16, border: '1.5px solid #E4ECF5', background: '#F7FAFD', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3D5674' }}>{t.recipients} · {persons.length + pw(persons.length)}</span>
                <span style={{ fontSize: 11.5, color: '#8FA6C0' }}>{t.eachPick}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' }}>
                {persons.map((p, i) => {
                  const sub = (p.pks.length === 0 ? L('รายการเดี่ยว', 'Single tests') : p.pks.length === 1 ? p.pks[0] : p.pks.length + L(' แพ็กเกจ', ' packages')) + ' · ฿' + ui.fmt(personSum(p));
                  return (
                    <div key={i} role="button" tabIndex={0} aria-pressed={act === i} onClick={() => setActive(i)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i); } }} style={ui.personTab(act === i)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{personLabel(i)}</span>
                        {persons.length > 1 && (
                          <button onClick={e => { e.stopPropagation(); removePerson(i); }} title={t.removePerson} aria-label={t.removePerson + ' ' + (i + 1)} style={{ border: 0, background: 'transparent', color: 'inherit', opacity: .62, fontSize: 14, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
                        )}
                      </span>
                      <span style={{ fontSize: 10.5, opacity: .72 }}>{sub}</span>
                    </div>
                  );
                })}
                {persons.length < PRICING.maxPeople && (
                  <button onClick={() => addPerson(true)} className="h-pale" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', border: '1.5px dashed #C6D6E8', background: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#0B4F9E', cursor: 'pointer' }}>{t.addPersonLbl}</button>
                )}
              </div>
            </div>

            <span style={{ ...ui.label, marginBottom: 10 }}>{t.pkgFor} {personLabel(act)} — {t.multiOk}</span>
            <button onClick={() => updatePerson(act, p => ({ ...p, pks: p.pks.filter(k => !catalog.packages.some(x => x.name === k)) }))} style={ui.noPkgBtn(!cur.pks.some(k => catalog.packages.some(x => x.name === k)))}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t.noPkg}</span>
                <span style={{ fontSize: 11.5, opacity: .68 }}>{t.noPkgSub}</span>
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{cur.pks.some(k => catalog.packages.some(x => x.name === k)) ? '' : '✓'}</span>
            </button>
            <div className="pkg-list" style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 26, maxHeight: 302, overflowY: 'auto', paddingRight: 4 }}>
              {catalog.packages.map(p => {
                const on = cur.pks.includes(p.name);
                const poster = posterFor(p.name);
                return (
                  <div key={p.name} role="button" tabIndex={0} aria-pressed={on}
                    onClick={() => updatePerson(act, pp => ({ ...pp, pks: toggleIn(pp.pks, p.name) }))}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updatePerson(act, pp => ({ ...pp, pks: toggleIn(pp.pks, p.name) })); } }}
                    style={ui.pkgRow(on)}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 600 }}>
                        {p.id && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', opacity: .55, marginRight: 8 }}>{p.id}</span>}
                        {p.name}
                      </span>
                      <span style={{ fontSize: 11.5, opacity: .68 }}>{p.detail}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {poster && (
                        <button onClick={e => { e.stopPropagation(); openPoster(poster, p.name); }} className="h-pale" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #CFE0F1', background: '#fff', color: '#0B4F9E', fontSize: 11.5, fontWeight: 600, padding: '6px 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                          {t.viewTests}
                        </button>
                      )}
                      <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>฿{ui.fmt(p.price)}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {cur.picked.length > 0 && (
              <div style={{ marginBottom: 26, padding: 16, border: '1.5px solid #CFE9E4', background: '#F4FBF9', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0A6E62' }}>{t.singlesOf} {personLabel(act)} · {cur.picked.length}</span>
                  <button onClick={() => updatePerson(act, p => ({ ...p, picked: [] }))} style={{ border: 0, background: 'transparent', color: '#6B7F99', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>{t.clearAll}</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {cur.picked.map(n => (
                    <button key={n} onClick={() => updatePerson(act, p => ({ ...p, picked: p.picked.filter(k => k !== n) }))} className="h-teal-chip" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px 7px 12px', border: '1px solid #BFE5DE', background: '#fff', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: '#0A6E62', cursor: 'pointer' }}>
                      {n}
                      <span style={{ color: '#17A090' }}>฿{ui.fmt(testPrice.get(n) ?? 0)}</span>
                      <span style={{ color: '#93AEC4', fontSize: 14, lineHeight: 1 }} aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        <div id="tests" style={{ marginTop: 44, paddingTop: 40, borderTop: '1px solid #E4ECF5' }}>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={ui.stepBadge}>STEP 4</span>
                <span style={ui.eyebrow}>Test menu · retail price</span>
              </div>
              <h3 style={{ margin: '12px 0 0', fontSize: 'clamp(24px, 2.4vw, 32px)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.15 }}>{t.testsH3}</h3>
            </div>
            <p style={{ ...ui.lede, maxWidth: 400 }}>{t.testsP}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 260px', maxWidth: 340 }}>
              <svg style={{ position: 'absolute', left: 13, color: '#8FA6C0' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
              <input type="search" aria-label={t.searchPh} className="f-plain" value={testQuery} onChange={e => { setTestQuery(e.target.value); setShowAllTests(false); }} placeholder={t.searchPh} style={{ width: '100%', padding: '12px 14px 12px 38px', border: '1.5px solid #DCE5EF', borderRadius: 12, fontSize: 14, outline: 'none', transition: 'border-color .16s' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cats.map(c => (
                <button key={c} onClick={() => { setTestCat(c); setShowAllTests(false); }} style={ui.catChip(testCat === c)} aria-pressed={testCat === c}>{c === ALL ? L('ทั้งหมด', 'All') : c}</button>
              ))}
            </div>
            <span className="picking-badge" style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#17A090', padding: '6px 12px', borderRadius: 999, marginLeft: 'auto' }}>{t.pickingFor} {personLabel(act)}</span>
            <span style={{ fontSize: 12.5, color: '#8FA6C0', fontWeight: 500 }}>{filtered.length + L(' รายการ', ' tests')}</span>
          </div>

          {STD_QUERY.test(testQuery.trim()) && (
            <a href="/std?ref=main-search#packages" className="h-pale" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14, padding: '14px 18px', borderRadius: 14, border: '1.5px solid #CFE0F1', background: '#F1F7FF', color: '#0F2540', textDecoration: 'none', animation: 'riseIn .25s ease both' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{t.stdSearchT}</span>
                <span style={{ fontSize: 12.5, color: '#536C89', lineHeight: 1.5 }}>{t.stdSearchD}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0B4F9E', whiteSpace: 'nowrap' }}>
                {t.stdSearchCta}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
              </span>
            </a>
          )}

          <div style={{ border: '1px solid #E4ECF5', borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
            <div className="test-grid test-head" style={{ padding: '14px 22px', background: '#F7FAFD', borderBottom: '1px solid #E4ECF5', fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', color: '#6B7F99', textTransform: 'uppercase' }}>
              <span>{t.colTest}</span><span className="col-cat">{t.colCat}</span><span className="col-tat">{t.colTat}</span><span style={{ textAlign: 'right' }}>{t.colPrice}</span><span />
            </div>
            {shown.map(x => {
              const on = cur.picked.includes(x.n);
              const toggle = () => updatePerson(act, p => ({ ...p, picked: toggleIn(p.picked, x.n) }));
              return (
                <div key={x.n} role="button" tabIndex={0} aria-pressed={on} onClick={toggle}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                  className="test-grid test-row h-row"
                  style={{ alignItems: 'center', padding: '15px 22px', borderBottom: '1px solid #EEF3F9', cursor: 'pointer', transition: 'background .14s', background: on ? '#F1F7FF' : undefined }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-.01em' }}>{x.n}</span>
                    <span style={{ fontSize: 12.5, color: '#8FA6C0', lineHeight: 1.45 }}>{x.th}</span>
                  </div>
                  <span className="col-cat" style={{ fontSize: 12, fontWeight: 600, color: '#0B4F9E', background: '#EAF3FF', padding: '5px 10px', borderRadius: 999, justifySelf: 'start' }}>{x.c}</span>
                  <span className="col-tat" style={{ fontSize: 13, color: '#536C89' }}>{en ? enWait(x.w) : thaiWait(x.w)}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, textAlign: 'right', letterSpacing: '-.01em' }}>฿{ui.fmt(x.p)}</span>
                  <span style={ui.testToggle(on)} aria-hidden="true">{on ? '✓' : '+'}</span>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: '40px 22px', textAlign: 'center', fontSize: 14, color: '#8FA6C0' }}>{t.noResults}</div>}
            {filtered.length > shown.length && (
              <button onClick={() => setShowAllTests(true)} className="h-pale" style={{ width: '100%', border: 0, background: '#F7FAFD', color: '#0B4F9E', fontSize: 14, fontWeight: 600, padding: 16, cursor: 'pointer', transition: 'background .16s' }}>
                {L('ดูอีก ', 'Show ') + (filtered.length - shown.length) + L(' รายการ', ' more')}
              </button>
            )}
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#8FA6C0', lineHeight: 1.6 }}>
            <span style={ui.syncBadge(syncState)}>{syncBadgeText}</span>
            <span>{syncNote}</span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- STEP 5 confirm */}
      <section id="book" className="wrap" style={{ ...ui.wrap, padding: '0 24px 88px' }}>
        <div className="book-card" style={{ background: 'linear-gradient(150deg, #062F63, #0B4F9E 62%, #106B94)', borderRadius: 26, padding: 40, color: '#fff', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 36, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ ...ui.stepBadge, color: '#062F63', background: '#4FE3C1' }}>STEP 5</span>
              <span style={{ ...ui.eyebrow, color: '#9FC2E0' }}>Confirm booking</span>
            </div>
            <h2 style={{ margin: '0 0 14px', ...ui.h2Step }}>{t.confirmH2}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: '#C6DCF2', lineHeight: 1.6 }}>
              <span>{persons.length + pw(persons.length) + ' · ' + visitDate + ' ' + slot}</span>
              {persons.map((p, i) => (
                <span key={i}>
                  {hasRx && p.pks.length + p.picked.length === 0 ? personLabel(i) + ': ' + t.rxPersonLabel + ' · ' + t.rxPending :
                    personLabel(i) + ': ' + (p.pks.length ? p.pks.join(' + ') : L('ไม่เลือกแพ็กเกจ', 'No package')) +
                    (p.picked.length ? L(' + รายการเดี่ยว ', ' + ') + p.picked.length + L(' รายการ', ' single tests') : '') + ' · ฿' + ui.fmt(personSum(p))}
                </span>
              ))}
              <span>{channelSummary}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#9FC2E0', fontWeight: 500, letterSpacing: '.04em' }}>{t.costSummary}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14.5 }}>
              {lineItems.map((li, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingBottom: 13, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ color: '#E4F1FF' }}>{li.label}</span>
                    <span style={{ fontSize: 11.5, color: '#93B6D6' }}>{li.note}</span>
                  </span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: '#fff' }}>{li.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,.16)' }}>
              <span style={{ fontSize: 13, color: '#9FC2E0' }}>{hasRx ? t.estimateRx : t.grandTotal}</span>
              <span className="grand-total" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.05 }}>฿{ui.fmt(total)}</span>
            </div>
            <button onClick={startBooking} className="h-cta" style={{ width: '100%', border: 0, background: '#17B8A6', color: '#042F2A', fontSize: 16.5, fontWeight: 700, padding: 19, borderRadius: 14, cursor: 'pointer', transition: 'background .18s' }}>{ctaLabel} · {visitDate} {slot}</button>
            {bookError && <div role="alert" style={{ fontSize: 13, color: '#FFD9CC', background: 'rgba(180,67,42,.28)', border: '1px solid rgba(255,180,160,.4)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>{bookError}</div>}
            <div style={{ fontSize: 12, color: '#93B6D6', textAlign: 'center', lineHeight: 1.6 }}>{t.cancelNote}</div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- how it works */}
      <section id="how" style={{ background: '#fff', borderTop: '1px solid #E4ECF5', borderBottom: '1px solid #E4ECF5' }}>
        <div className="wrap" style={{ ...ui.wrap, padding: '84px 24px' }}>
          <div style={{ maxWidth: 620, marginBottom: 46 }}>
            <div style={ui.eyebrow}>How it works</div>
            <h2 style={{ margin: '12px 0 12px', ...ui.h2Big }}>{t.howH2}</h2>
            <p style={ui.lede}>{t.howP}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '28px 4px' }}>
            {visitSteps(L).map(s => (
              <div key={s.n} style={{ position: 'relative', padding: '0 22px 0 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#0B4F9E', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14.5, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
                  <div style={{ flex: 1, height: 2, background: 'repeating-linear-gradient(90deg, #C9DCEF 0 6px, transparent 6px 12px)' }} />
                </div>
                <div style={{ color: '#17A090', marginBottom: 12 }}>{s.icon}</div>
                <h3 style={{ margin: '0 0 7px', fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#536C89', textWrap: 'pretty' }}>{s.body}</p>
                <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, color: '#8FA6C0', letterSpacing: '.03em' }}>{s.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- branches */}
      <section id="branches" className="wrap" style={{ ...ui.wrap, padding: '84px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', marginBottom: 36 }}>
          <div>
            <div style={ui.eyebrow}>Our branches</div>
            <h2 style={{ margin: '12px 0 0', ...ui.h2Big }}>{t.brH2}</h2>
          </div>
          <p style={{ ...ui.lede, maxWidth: 380 }}>{t.brP}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(268px, 100%), 1fr))', gap: 18 }}>
          {branchesView.map(b => (
            <div key={b.id} className="h-lift" style={{ background: '#fff', border: '1px solid #E4ECF5', borderRadius: 18, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <img src={b.logo} alt="" loading="lazy" style={{ height: 82, width: 118, objectFit: 'contain', objectPosition: 'left center' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#0A6E62', background: '#E8F6F3', padding: '5px 10px', borderRadius: 999, flexShrink: 0 }}>{b.tag}</span>
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16.5, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.35 }}>{b.name}</h3>
                <div style={{ fontSize: 13, color: '#536C89', lineHeight: 1.6 }}>{b.address}</div>
                {b.landmark && <div style={{ fontSize: 12.5, color: '#17A090', marginTop: 5, fontWeight: 500 }}>{b.landmark}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, color: '#3D5674', lineHeight: 1.5, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #EEF3F9' }}>
                <a href={'tel:' + b.tel} style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#0B4F9E', fontWeight: 600 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h2A1.5 1.5 0 0 1 9 5.3l.5 3a1.5 1.5 0 0 1-.7 1.5l-1.3.8a11 11 0 0 0 5 5l.8-1.3a1.5 1.5 0 0 1 1.5-.7l3 .5a1.5 1.5 0 0 1 1.2 1.5v2a1.5 1.5 0 0 1-1.5 1.5A15 15 0 0 1 4 5.5Z" /></svg>
                  {b.phone}
                </a>
                <a href={'mailto:' + b.email} style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#536C89', wordBreak: 'break-all' }}>
                  <svg style={{ flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></svg>
                  {b.email}
                </a>
                <a href={b.map} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#17A090', fontWeight: 600 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></svg>
                  {t.viewMap}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- footer */}
      <footer style={{ background: '#062F63', color: '#9FC2E0' }}>
        <div className="wrap" style={{ ...ui.wrap, padding: '56px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 36 }}>
          <div>
            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', display: 'inline-block', marginBottom: 16 }}>
              <img src="/img/logo-mt-company.webp" alt="บริษัท เมดิคอลเทรนด์ จำกัด" loading="lazy" style={{ height: 76, width: 'auto', display: 'block' }} />
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, maxWidth: 280 }}>{t.footAbout}</p>
          </div>
          <FooterCol title={t.footServices} links={[['#branches', t.fs1], ['#pricing', t.fs2], ['/std?ref=main-footer', t.fsStd], ['#pricing', t.fs3], ['#pricing', t.fs4]]} />
          <FooterCol title={t.footHelp} links={[['#how', t.navHow], ['#features', t.faq], ['#features', t.pdpa]]} />
          <div>
            <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{t.contact}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
              <a href="tel:0952472631" style={{ color: '#9FC2E0' }}>{t.call} 095 247 2631</a>
              <a href="mailto:lab@medicaltrend.co.th" style={{ color: '#9FC2E0' }}>lab@medicaltrend.co.th</a>
              <span>{t.cmPy}</span>
            </div>
          </div>
        </div>
        <div className="wrap" style={{ ...ui.wrap, padding: '0 24px 40px' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 34, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: '#6B7F99', textTransform: 'uppercase' }}>Our group</span>
            {[
              ['/img/logo-mt-center.webp', 'Medical Trend Head Quarter — ศูนย์แล็บ ตรวจเลือด ตรวจสุขภาพ'],
              ['/img/logo-prl-group.webp', 'Ratchaphruek Lab — ราชพฤกษ์แล็บ ตรวจเลือด เชียงใหม่'],
              ['/img/logo-ibliss.webp', 'Medical Trend iBliss Polyclinic'],
              ['/img/logo-mth-group.webp', 'บริษัท เมดิคอลเทรนด์ เฮลธ์แคร์ จำกัด'],
            ].map(([src, alt]) => <img key={src} src={src} alt={alt} loading="lazy" style={{ height: 84, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />)}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <div className="wrap" style={{ ...ui.wrap, padding: '18px 24px', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span>© 2026 {t.coName}</span>
            <span>{t.demoPrice}</span>
          </div>
        </div>
      </footer>

      {/* ---------------------------------------------------------------- poster popup */}
      {poster && (
        <div onClick={() => setPoster(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(4,28,58,.72)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24, animation: 'riseIn .2s ease both' }}>
          <div role="dialog" aria-modal="true" aria-label={poster.title} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 40px 90px -30px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '2px 4px 0', position: 'sticky', top: -16, background: '#fff', zIndex: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{poster.title}</span>
              <button onClick={() => setPoster(null)} autoFocus aria-label="Close" className="h-soft" style={{ width: 32, height: 32, border: 0, borderRadius: 10, background: '#EEF3F9', color: '#3D5674', fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
            <img src={poster.src} alt={poster.title} style={{ width: 'min(86vw, 560px)', height: 'auto', maxHeight: '76vh', objectFit: 'contain', borderRadius: 14, display: 'block', flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- live total bar */}
      {total > 0 && (
        <>
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'rgba(6,47,99,.96)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,.14)', boxShadow: '0 -18px 40px -22px rgba(4,28,58,.6)' }}>
            <div className="bar-row" style={{ ...ui.wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: '#9FC2E0', letterSpacing: '.04em' }}>{hasRx ? t.estimateRx : t.grandTotal}</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-.025em', lineHeight: 1.1 }}>฿{ui.fmt(total)}</span>
                </span>
                <span className="bar-summary" style={{ fontSize: 12, color: '#9FC2E0', lineHeight: 1.5 }}>{barSummary}</span>
              </div>
              <a href="#book" className="h-bar-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#4FE3C1', color: '#062F63', fontSize: 14, fontWeight: 700, padding: '13px 22px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                {t.goConfirm}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
              </a>
            </div>
          </div>
          <div style={{ height: 96 }} />
        </>
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: 88, zIndex: 95, background: '#0F2540', color: '#fff', fontSize: 13.5, fontWeight: 500, padding: '12px 18px', borderRadius: 12, boxShadow: '0 18px 40px -18px rgba(4,28,58,.6)', animation: 'riseIn .2s ease both', maxWidth: 'calc(100vw - 32px)' }}>{toast}</div>
      )}

      {dialogOpen && (
        <BookingDialog
          t={t}
          draft={draft}
          ctaLabel={ctaLabel}
          onClose={() => setDialogOpen(false)}
          onDone={resetBooking}
          onRepriced={loadCatalog}
        />
      )}
    </div>
  );
}

const stepperBtn: CSSProperties = { width: 34, height: 34, border: 0, borderRadius: 999, background: '#EAF3FF', color: '#0B4F9E', fontSize: 18, fontWeight: 700, lineHeight: 1, cursor: 'pointer' };

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
        {links.map(([href, text]) => <a key={text} href={href} style={{ color: '#9FC2E0' }}>{text}</a>)}
      </div>
    </div>
  );
}
