// /std — MedicalTrend STD Testing landing page (Claude Design "Design.html": Desktop 1440 + Mobile 390 boards).
// Selection rules, prices and branch hours live in shared/std.ts so the Worker recomputes the same total.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  STD_BOOKING_DAYS, STD_BRANCHES, STD_COVERS, STD_KEY_ORDER, STD_PACKAGES, STD_PATHOGENS, TIER_CAPS, TIER_PRICES,
  branchHours, tierPrice, type StdKey,
} from '../../shared/std';
import { detectRef } from '../ref';
import { bookingCopy, copyAll, noticeCopy, stiCopy, type StdLang } from './copy';

const money = (n: number) => n.toLocaleString('en-US');
const PKG_PRICES = STD_PACKAGES.map(p => p.price);

interface Form { name: string; email: string; phone: string; branch: string; pkgs: StdKey[]; date: string; slot: string; note: string; consent: boolean }
const emptyForm = (): Form => ({ name: '', email: '', phone: '', branch: '', pkgs: [], date: '', slot: '', note: '', consent: false });
type Errs = Partial<Record<'name' | 'email' | 'phone' | 'branch' | 'pkg' | 'pick' | 'date' | 'slot' | 'consent', string>>;

/** Bangkok wall-clock "now" as a Date whose UTC fields hold Bangkok time. */
const bkkNow = () => new Date(Date.now() + 7 * 3600_000);
const ymdUTC = (d: Date) => d.toISOString().slice(0, 10);

function initialLang(): StdLang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'th') return q;
  try { const l = localStorage.getItem('mt_lang'); if (l === 'en' || l === 'th') return l; } catch { /* storage blocked */ }
  return 'th';
}

const Check = ({ size = 16, color = '#1C75BC', w = 2.5 }: { size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);

export default function StdApp() {
  const [lang, setLangState] = useState<StdLang>(initialLang);
  const [ref] = useState(() => detectRef('mt_std_ref'));
  const [f, setF] = useState<Form>(emptyForm);
  const [picked, setPicked] = useState<number[]>([]);
  const [notice, setNotice] = useState('');
  const [errs, setErrs] = useState<Errs>({});
  const [mo, setMo] = useState(0);
  const [sending, setSending] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [done, setDone] = useState<{ ref: string; date: string; time: string; branch: string; pkg: string; total: string } | null>(null);

  const all = copyAll();
  const t = all[lang];
  const sc = stiCopy(lang);
  const nc = noticeCopy(lang);
  const c = bookingCopy(lang);

  useEffect(() => { document.documentElement.lang = lang; document.title = lang === 'th' ? 'ตรวจ HIV และโรคติดต่อทางเพศสัมพันธ์ เชียงใหม่ · Medical Trend' : 'HIV & STD Testing Chiang Mai · Medical Trend'; }, [lang]);
  const setLang = (l: StdLang) => { try { localStorage.setItem('mt_lang', l); } catch { /* ignore */ } setLangState(l); };

  // ---------------------------------------------------------------- selection (ported from the design logic)
  const keyName = (k: StdKey) => k.startsWith('p') ? t.packages[+k.slice(1)].name : k === 'custom' ? sc.customName : sc.unsure;

  const applyAdd = (pkgs: StdKey[], k: StdKey): { pkgs: StdKey[]; notice: string; blocked?: boolean } => {
    if (k === 'unsure') return { pkgs: ['unsure'], notice: '' };
    let cur = pkgs.filter(x => x !== 'unsure');
    const host = cur.find(s => s !== k && STD_COVERS[s].includes(k));
    if (host) return { pkgs: cur, notice: nc.inside(keyName(k), keyName(host)), blocked: true };
    const removed = cur.filter(s => STD_COVERS[k].includes(s));
    cur = cur.filter(s => !removed.includes(s)).concat([k]);
    cur.sort((a, b) => STD_KEY_ORDER.indexOf(a) - STD_KEY_ORDER.indexOf(b));
    return { pkgs: cur, notice: removed.length ? nc.replaced(keyName(k), removed.map(keyName).join(', ')) : '' };
  };
  const clearErr = (...ks: (keyof Errs)[]) => setErrs(e => { const n = { ...e }; ks.forEach(k => delete n[k]); return n; });

  const selectPkg = (key: StdKey) => {
    let pkgs: StdKey[], note = '', pk = picked;
    if (f.pkgs.includes(key)) {
      pkgs = f.pkgs.filter(x => x !== key);
      if (key === 'custom') pk = [];
    } else {
      const r = applyAdd(f.pkgs, key);
      pkgs = r.pkgs; note = r.notice;
      if (!pkgs.includes('custom')) pk = [];
    }
    setF({ ...f, pkgs }); setPicked(pk); setNotice(note); clearErr('pkg', 'pick');
  };
  const togglePick = (i: number) => {
    let pkgs = f.pkgs, note = '';
    if (!pkgs.includes('custom')) {
      const r = applyAdd(pkgs, 'custom');
      if (r.blocked) { setNotice(r.notice); return; }
      pkgs = r.pkgs; note = r.notice;
    }
    const p = f.pkgs.includes('custom') ? picked.slice() : [];
    const at = p.indexOf(i);
    if (at >= 0) p.splice(at, 1); else p.push(i);
    p.sort((a, b) => a - b);
    setPicked(p); setF({ ...f, pkgs }); setNotice(note); clearErr('pkg', 'pick');
  };
  const selectAll = () => {
    let pkgs = f.pkgs;
    if (!pkgs.includes('custom')) { const r = applyAdd(pkgs, 'custom'); if (r.blocked) { setNotice(r.notice); return; } pkgs = r.pkgs; }
    setPicked(STD_PATHOGENS.map((_, i) => i)); setF({ ...f, pkgs }); setNotice(''); clearErr('pkg', 'pick');
  };
  const clearPicks = () => { setPicked([]); setNotice(''); setF({ ...f, pkgs: f.pkgs.filter(k => k !== 'custom') }); };
  const clearAll = () => { setPicked([]); setNotice(''); setF({ ...f, pkgs: [] }); };

  // ---------------------------------------------------------------- cart
  const hasCustom = f.pkgs.includes('custom');
  const n = hasCustom ? picked.length : 0;
  const items = f.pkgs.map(k => {
    if (k.startsWith('p')) { const i = +k.slice(1); return { key: k, name: t.packages[i].name, price: PKG_PRICES[i] as number | null }; }
    if (k === 'custom') return { key: k, name: sc.customName + ' · ' + n + ' ' + sc.unit, price: tierPrice(n) as number | null };
    return { key: k, name: sc.unsure, price: null as number | null };
  });
  const unsure = f.pkgs.includes('unsure');
  const total = unsure ? null : items.reduce((a, x) => a + (x.price || 0), 0);
  const cartName = items.map(x => x.name).join(' + ');
  let cartSub = unsure ? sc.unsureSub : items.map(x => x.name.split(' · ')[0] + ' ' + money(x.price || 0)).join('  +  ');
  if (hasCustom) cartSub += '  ·  ' + (n ? picked.map(k => STD_PATHOGENS[k][0]).join(', ') : sc.needPick);
  const totalText = total === null ? '—' : money(total) + ' ' + t.baht;
  const tierIdx = n === 0 ? -1 : TIER_CAPS.findIndex(cap => n <= cap);
  let hint = sc.hintNone;
  if (n > 0) { const room = TIER_CAPS[tierIdx] - n; hint = n === 14 ? sc.hintFull : room > 0 ? sc.hintRoom(room) : sc.hintNext(money(TIER_PRICES[tierIdx + 1])); }
  let shownNotice = notice, hasUpgrade = false;
  const onlyBasics = f.pkgs.every(k => k === 'p0' || k === 'p1' || k === 'custom');
  if (!shownNotice && total !== null && onlyBasics && f.pkgs.includes('p0') && (f.pkgs.includes('p1') || (hasCustom && n > 0))) {
    const diff = total - 2690;
    if (diff > 0) { shownNotice = nc.save(money(diff)); hasUpgrade = true; }
    else if (diff >= -300) { shownNotice = nc.more(money(-diff)); hasUpgrade = true; }
  }
  const upgrade = () => { setF({ ...f, pkgs: ['p2'] }); setPicked([]); setNotice(''); };
  const stiList = STD_PATHOGENS.map((r, i) => ({ num: String(i + 1).padStart(2, '0'), code: r[0], name: r[1], desc: lang === 'th' ? r[2] : r[3] }));

  // ---------------------------------------------------------------- calendar (Bangkok time)
  const today = bkkNow(); today.setUTCHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setUTCDate(maxDate.getUTCDate() + STD_BOOKING_DAYS);
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + mo, 1));
  const y = base.getUTCFullYear(), m = base.getUTCMonth();
  const lead = (base.getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const bIdx = f.branch === '' ? -1 : +f.branch;
  const branchId = bIdx >= 0 ? STD_BRANCHES[bIdx] : null;
  const cells = useMemo(() => {
    const out: ({ blank: true } | { blank: false; key: string; label: string; disabled: boolean })[] = [];
    for (let i = 0; i < lead; i++) out.push({ blank: true });
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(Date.UTC(y, m, d));
      const key = ymdUTC(dt);
      const closed = !branchId || !branchHours(branchId, dt.getUTCDay());
      out.push({ blank: false, key, label: String(d), disabled: closed || dt < today || dt > maxDate });
    }
    return out;
  }, [lead, dim, y, m, branchId, today.getTime(), maxDate.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  let slots: string[] = [];
  let slotMsg = '';
  if (!branchId) slotMsg = c.pickBranchFirst;
  else if (!f.date) slotMsg = c.pickDateFirst;
  else {
    const dt = new Date(f.date + 'T00:00:00Z');
    const hrs = branchHours(branchId, dt.getUTCDay());
    const now = bkkNow();
    const isToday = ymdUTC(now) === f.date;
    if (hrs) for (let h = hrs[0]; h < hrs[1]; h++) { if (isToday && h <= now.getUTCHours()) continue; slots.push(String(h).padStart(2, '0') + ':00'); }
    if (!slots.length) slotMsg = c.noSlots;
  }
  const fmtDate = (ymd: string) => { if (!ymd) return ''; const p = ymd.split('-'); return (+p[2]) + ' ' + c.months[+p[1] - 1] + ' ' + (c.be ? +p[0] + 543 : p[0]); };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF(prev => ({ ...prev, [k]: v })); clearErr(k as keyof Errs); };
  const chooseBranch = (v: string) => { setF(prev => ({ ...prev, branch: prev.branch === v ? '' : v, date: '', slot: '' })); clearErr('branch'); };

  // ---------------------------------------------------------------- submit
  const submit = async () => {
    if (sending) return;
    const e: Errs = {};
    if (!f.name.trim()) e.name = c.eName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = c.eEmail;
    if (!/^0\d{8,9}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = c.ePhone;
    if (f.branch === '') e.branch = c.eBranch;
    if (!f.pkgs.length) e.pkg = c.ePkg;
    if (hasCustom && !picked.length) e.pick = c.ePick;
    if (!f.date) e.date = c.eDate;
    if (!f.slot) e.slot = c.eSlot;
    if (!f.consent) e.consent = c.eConsent;
    setErrs(e);
    if (Object.keys(e).length) {
      document.getElementById('booking')?.scrollIntoView({ block: 'start' });
      return;
    }
    setSending(true); setServerErr('');
    try {
      const res = await fetch('/api/std/bookings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: f.name.trim(), email: f.email.trim(), phone: f.phone.replace(/[\s-]/g, ''),
          branch: STD_BRANCHES[+f.branch], packages: f.pkgs, pathogens: hasCustom ? picked : [],
          date: f.date, time: f.slot, note: f.note.trim(), pdpaConsent: true, expectedTotal: total ?? 0, lang, ref,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ref) {
        setDone({ ref: body.ref, date: fmtDate(f.date), time: f.slot, branch: t.branches[+f.branch].name, pkg: cartName, total: totalText });
        document.getElementById('booking')?.scrollIntoView({ block: 'start' });
      } else if (body.error === 'slot_unavailable') {
        setErrs({ slot: c.noSlots }); setF(prev => ({ ...prev, slot: '' }));
      } else {
        setServerErr(lang === 'th' ? 'ส่งการจองไม่สำเร็จ กรุณาลองใหม่ หรือโทร 095-247-2631' : 'Could not send your booking. Please try again or call 095-247-2631.');
      }
    } catch {
      setServerErr(lang === 'th' ? 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' : 'Connection failed. Please try again.');
    } finally {
      setSending(false);
    }
  };
  const again = () => { setDone(null); setF(emptyForm()); setPicked([]); setNotice(''); setErrs({}); setMo(0); };

  // ---------------------------------------------------------------- styles for stateful controls
  const selStyle = (on: boolean, err?: boolean): CSSProperties => ({
    background: on ? '#1D3564' : '#FFFFFF', color: on ? '#FFFFFF' : '#1D3564', borderColor: on ? '#1D3564' : err ? '#B42318' : '#D5E0EC',
  });
  const inputBorder = (k: keyof Errs): CSSProperties => ({ borderColor: errs[k] ? '#B42318' : '#B9C8DA' });
  const Err = ({ k }: { k: keyof Errs }) => errs[k] ? <div className="s-err" role="alert">{errs[k]}</div> : null;
  const showBar = f.pkgs.length > 0 && !done;

  return (
    <div className="s-root">
      {/* NAV */}
      <div className="s-in">
        <nav className="s-nav">
          <a href="/" className="s-brand" aria-label="Medical Trend">
            <img src="/img/std/logo.webp" alt="Medical Trend" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="s-brand-t">MEDICAL TREND</div>
              <div className="s-brand-s">ศูนย์แล็บ ตรวจเลือด ตรวจสุขภาพ</div>
            </div>
          </a>
          <div className="s-links">
            <a className="s-l" href="#packages">{t.navPackages}</a>
            <a className="s-l" href="#branches">{t.navBranches}</a>
            <a className="s-l" href="#booking">{t.navBook}</a>
            <a className="s-l" href="#faq">{t.navFaq}</a>
            <div className="s-lang" role="group" aria-label="Language">
              <button type="button" aria-pressed={lang === 'th'} onClick={() => setLang('th')}>TH</button>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            </div>
            <a className="s-navcta" href="#booking">{t.navCta}</a>
          </div>
        </nav>
      </div>

      <main className="s-in">
        {/* HERO */}
        <section className="s-hero">
          <div className="s-hero-l">
            <div className="s-eyebrow">{t.heroEyebrow}</div>
            <h1 className="s-h1">{t.heroTitle}</h1>
            <p className="s-lede">{t.heroBody}</p>
            <div className="s-ctas">
              <a className="btn-p" href="#booking">{t.ctaLine}</a>
              <a className="btn-o" href="tel:0952472631">{t.ctaCall}</a>
            </div>
          </div>
          <div className="s-hero-card">
            <img src="/img/std/hero.svg" alt="" />
            <div className="s-from">
              <div className="s-from-l">{t.heroPriceLabel}</div>
              <div className="s-from-n">880</div>
              <div className="s-from-b">{t.baht}</div>
            </div>
            {t.stats.map(s => (
              <div key={s.l} className="s-stat"><div className="s-stat-v">{s.v}</div><div className="s-stat-l">{s.l}</div></div>
            ))}
          </div>
        </section>

        {/* TRUST */}
        <section className="s-trust">
          {t.trust.map(tr => (
            <div key={tr.t} className="s-trust-i">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1C75BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
              <div className="s-trust-txt">
                <div className="s-trust-t">{tr.t}</div>
                <div className="s-trust-d">{tr.d}</div>
              </div>
            </div>
          ))}
        </section>

        {/* PACKAGES */}
        <section id="packages" className="s-sec s-pk">
          <div className="s-pk-head">
            <h2 className="s-h2">{t.pkgTitle}</h2>
            <p className="s-sub">{t.pkgSub}</p>
          </div>
          <div className="s-pk-grid">
            {t.packages.map((p, i) => {
              const key = ('p' + i) as StdKey;
              const chosen = f.pkgs.includes(key);
              const featured = 'featured' in p && p.featured;
              return (
                <div key={p.name} className="s-card" style={{ border: '2px solid ' + (chosen ? '#1D3564' : featured ? '#1C75BC' : '#D5E0EC') }}>
                  <div className="s-badge-row">{featured && <div className="s-badge">{t.badge}</div>}</div>
                  <div className="s-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="s-pk-name">{p.name}</div>
                      <div className="s-pk-sub">{p.sub}</div>
                    </div>
                    {featured && <div className="s-badge m-only">{t.badge}</div>}
                  </div>
                  <div className="s-price-row">
                    <div className="s-price"><div className="s-price-n">{p.price}</div><div className="s-price-b">{t.baht}</div></div>
                    <div className="s-tat">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1C75BC" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                      <div>{p.tat}</div>
                    </div>
                  </div>
                  <div className="s-hr" />
                  <div className="s-items">
                    {p.items.map(it => <div key={it} className="s-item"><Check />{it}</div>)}
                  </div>
                  <div className="s-sample">{p.sample}</div>
                  {'note' in p && p.note && <div className="s-note">{p.note}</div>}
                  <button type="button" className="s-add" aria-pressed={chosen} onClick={() => selectPkg(key)}>
                    {chosen && <Check color="#FFFFFF" w={3} />}{chosen ? t.pkgChosen : t.pkgCta}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="s-foot-note">{t.pkgFoot}</div>
        </section>

        {/* STI CHOOSER */}
        <section id="sti" className="s-sec">
          <div className="s-box">
            <div className="s-sti-head">
              <div className="s-sti-head-t">
                <h2 className="s-h2 s-h2-40">{sc.title}</h2>
                <p className="s-sub" style={{ fontSize: 18 }}>{sc.sub}</p>
                <div className="s-meta">{sc.meta}</div>
              </div>
              <img src="/img/std/sti.svg" alt="" />
            </div>
            <div className="s-tiers">
              {TIER_PRICES.map((p, k) => {
                const on = k === tierIdx;
                return (
                  <div key={p} className="s-tier" style={{ borderColor: on ? '#1D3564' : '#E4ECF4', background: on ? '#1D3564' : '#F5F8FC', color: on ? '#FFFFFF' : '#1D3564' }}>
                    <div className="s-tier-l" style={{ color: on ? '#C4D2E6' : '#4E5E78' }}>{sc.tierLab[k]}</div>
                    <div className="s-tier-p">{money(p)} {t.baht}</div>
                  </div>
                );
              })}
            </div>
            <div className="s-count-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="s-count">{sc.count(n)}</div>
                <div className="s-hint" aria-live="polite">{hint}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="s-pill" onClick={selectAll}>{sc.all}</button>
                <button type="button" className="s-pill muted" onClick={clearPicks}>{sc.clear}</button>
              </div>
            </div>
            <div className="s-chips">
              {stiList.map((x, k) => {
                const on = hasCustom && picked.includes(k);
                return (
                  <button key={x.code} type="button" className="s-chip" aria-pressed={on} onClick={() => togglePick(k)} style={{ borderColor: on ? '#1C75BC' : '#D5E0EC', background: on ? '#E6F1FA' : '#FFFFFF' }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="s-chip-code">{x.num} · {x.code}</span>
                      {on ? <span className="s-tick"><Check size={13} color="#FFFFFF" w={3.5} /></span> : <span className="s-untick" />}
                    </span>
                    <span className="s-chip-name">{x.name}</span>
                    <span className="s-chip-desc">{x.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* BOOKING */}
        <section id="booking" className="s-sec">
          <div className="s-box s-book">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 className="s-h2">{c.title}</h2>
              <p className="s-sub" style={{ fontSize: 18 }}>{c.sub}</p>
            </div>

            {!done ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div className="s-book-grid">
                  <div className="s-col">
                    <div className="s-h3">{c.secContact}</div>
                    <div className="s-field">
                      <label htmlFor="bk-name" className="s-label">{c.name}</label>
                      <input id="bk-name" className="s-input" type="text" autoComplete="name" maxLength={120} value={f.name} onChange={e => set('name', e.target.value)} style={inputBorder('name')} />
                      <Err k="name" />
                    </div>
                    <div className="s-field">
                      <label htmlFor="bk-email" className="s-label">{c.email}</label>
                      <input id="bk-email" className="s-input" type="email" inputMode="email" autoComplete="email" maxLength={160} value={f.email} onChange={e => set('email', e.target.value)} style={inputBorder('email')} />
                      <Err k="email" />
                    </div>
                    <div className="s-field">
                      <label htmlFor="bk-phone" className="s-label">{c.phone}</label>
                      <input id="bk-phone" className="s-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={e => set('phone', e.target.value)} style={inputBorder('phone')} />
                      <Err k="phone" />
                    </div>
                    <div className="s-field" style={{ gap: 8 }}>
                      <div className="s-label">{c.branch}</div>
                      <div className="s-opts2">
                        {t.branches.map((b, i) => {
                          const on = f.branch === String(i);
                          return (
                            <button key={b.name} type="button" className="s-opt" aria-pressed={on} onClick={() => chooseBranch(String(i))} style={selStyle(on, !!errs.branch)}>
                              <span className="s-opt-l">{b.name}</span>
                              <span className="s-opt-a" style={{ color: on ? '#C4D2E6' : '#4E5E78' }}>{b.area}</span>
                            </button>
                          );
                        })}
                      </div>
                      <Err k="branch" />
                    </div>
                    <div className="s-field" style={{ gap: 8 }}>
                      <div className="s-label">{c.pkg}</div>
                      <div className="s-chipsrow">
                        {STD_KEY_ORDER.map(k => {
                          const on = f.pkgs.includes(k);
                          return <button key={k} type="button" className="s-pkopt" aria-pressed={on} onClick={() => selectPkg(k)} style={selStyle(on, !!errs.pkg)}>{keyName(k)}</button>;
                        })}
                      </div>
                      <Err k="pkg" />
                      {hasCustom && (
                        <div className="s-infobox">
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#15508A' }}>{c.pickedLab}</div>
                          <div style={{ fontSize: 15, lineHeight: 1.5 }}>{n ? picked.map(k => stiList[k].code + ' ' + stiList[k].desc).join(' · ') : sc.needPick}</div>
                          <a href="#sti" style={{ fontSize: 15, fontWeight: 600, color: '#15508A' }}>{c.editPick}</a>
                        </div>
                      )}
                      <Err k="pick" />
                    </div>
                    <div className="s-field">
                      <label htmlFor="bk-note" className="s-label">{c.note}</label>
                      <textarea id="bk-note" className="s-input" rows={3} maxLength={1000} value={f.note} onChange={e => set('note', e.target.value)} />
                    </div>
                  </div>

                  <div className="s-col">
                    <div className="s-h3">{c.secVisit}</div>
                    <div className="s-cal">
                      <div className="s-cal-head">
                        <button type="button" className="s-round" aria-label={c.prev} disabled={mo === 0} onClick={() => setMo(Math.max(0, mo - 1))}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D3564" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                        </button>
                        <div className="s-month" aria-live="polite">{c.months[m] + ' ' + (c.be ? y + 543 : y)}</div>
                        <button type="button" className="s-round" aria-label={c.next} disabled={mo === 2} onClick={() => setMo(Math.min(2, mo + 1))}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D3564" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                      </div>
                      <div className="s-days">
                        {c.dows.map(d => <div key={d} className="s-dow">{d}</div>)}
                        {cells.map((cd, i) => cd.blank ? <div key={'b' + i} /> : (() => {
                          const sel = cd.key === f.date;
                          return (
                            <button key={cd.key} type="button" className="s-day" disabled={cd.disabled} aria-pressed={sel} aria-label={fmtDate(cd.key)}
                              onClick={() => { setF(prev => ({ ...prev, date: prev.date === cd.key ? '' : cd.key, slot: '' })); clearErr('date'); }}
                              style={{ background: sel ? '#1D3564' : cd.disabled ? 'transparent' : '#FFFFFF', color: sel ? '#FFFFFF' : cd.disabled ? '#A9B6C8' : '#1D3564', borderColor: sel ? '#1D3564' : cd.disabled ? 'transparent' : '#D5E0EC' }}>
                              {cd.label}
                            </button>
                          );
                        })())}
                      </div>
                    </div>
                    <Err k="date" />
                    <div className="s-field" style={{ gap: 10 }}>
                      <div className="s-label">{c.slots}</div>
                      {slotMsg && <div className="s-msg">{slotMsg}</div>}
                      {slots.length > 0 && (
                        <div className="s-slots">
                          {slots.map(sl => {
                            const on = sl === f.slot;
                            return <button key={sl} type="button" className="s-slot" aria-pressed={on} onClick={() => { set('slot', f.slot === sl ? '' : sl); }} style={selStyle(on)}>{sl}</button>;
                          })}
                        </div>
                      )}
                      <Err k="slot" />
                    </div>
                  </div>
                </div>

                {serverErr && <div className="s-server-err" role="alert">{serverErr}</div>}
                <div className="s-submit-row">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 700 }}>
                    <div className="s-consent">
                      <input id="bk-consent" type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)} />
                      <label htmlFor="bk-consent">{c.consent}</label>
                    </div>
                    <Err k="consent" />
                  </div>
                  <div className="s-total-wrap">
                    <div className="s-total">
                      <div className="s-total-l">{c.total}</div>
                      <div className="s-total-n">{totalText}</div>
                    </div>
                    <button type="button" className="s-submit" disabled={sending} onClick={submit}>{sending ? (lang === 'th' ? 'กำลังส่ง…' : 'Sending…') : c.submit}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="s-done" role="status">
                <div className="s-done-ic"><Check size={36} color="#FFFFFF" /></div>
                <div className="ff-a" style={{ fontSize: 30, fontWeight: 700 }}>{c.doneTitle}</div>
                <div style={{ fontSize: 16, lineHeight: 1.6, color: '#3D4F6B', maxWidth: 620 }}>{c.doneSub}</div>
                <div className="s-sum">
                  <div><div className="s-sum-l">{lang === 'th' ? 'เลขที่การจอง' : 'Booking ref.'}</div><div className="s-sum-v" style={{ color: '#1C75BC', fontFamily: "'Anuphan', sans-serif" }}>{done.ref}</div></div>
                  <div><div className="s-sum-l">{c.sumDate}</div><div className="s-sum-v">{done.date}</div></div>
                  <div><div className="s-sum-l">{c.sumTime}</div><div className="s-sum-v">{done.time}</div></div>
                  <div><div className="s-sum-l">{c.sumBranch}</div><div className="s-sum-v">{done.branch}</div></div>
                  <div><div className="s-sum-l">{c.sumPkg}</div><div className="s-sum-v">{done.pkg}</div></div>
                  <div><div className="s-sum-l">{c.sumTotal}</div><div className="s-sum-v">{done.total}</div></div>
                </div>
                <button type="button" onClick={again} style={{ height: 50, padding: '0 28px', borderRadius: 999, border: '1.5px solid #1D3564', background: '#FFFFFF', color: '#1D3564', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{c.again}</button>
              </div>
            )}
          </div>
        </section>

        {/* ADD-ONS */}
        <section className="s-addons">
          {t.addons.map((ad, i) => (
            <div key={ad.t} className="s-addon">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="s-addon-t">{ad.t}</div>
                <div className="s-addon-d">{ad.d}</div>
                {i === 0 && <a href="/?mode=home&ref=std-home-addon" style={{ fontSize: 15, fontWeight: 600 }}>{lang === 'th' ? 'จองเจาะเลือดถึงบ้าน คำนวณค่าเดินทางอัตโนมัติ →' : 'Book home collection with automatic travel fee →'}</a>}
              </div>
              <div className="s-addon-p">
                <div className="s-addon-pl">{t.from}</div>
                <div className="s-addon-pn">{ad.p}</div>
              </div>
            </div>
          ))}
        </section>

        {/* STEPS */}
        <section className="s-sec s-steps">
          <h2 className="s-h2">{t.stepsTitle}</h2>
          <div className="s-steps-grid">
            {t.steps.map(st => (
              <div key={st.n} className="s-step">
                <div className="s-step-n">{st.n}</div>
                <div className="s-step-t">{st.t}</div>
                <div className="s-step-d">{st.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* WINDOW PERIOD */}
        <section className="s-sec s-win-sec">
          <div className="s-win">
            <div className="s-win-l">
              <h2 className="s-h2">{t.winTitle}</h2>
              <p className="s-sub" style={{ fontSize: 18, lineHeight: 1.65 }}>{t.winSub}</p>
              <div className="s-pep">{t.pep}</div>
            </div>
            <div className="s-table">
              <div className="s-trow s-thead"><div>{t.winColTest}</div><div>{t.winColTime}</div></div>
              {t.windows.map(w => (
                <div key={w.test} className="s-trow"><div style={{ fontWeight: 600 }}>{w.test}</div><div style={{ color: '#3D4F6B' }}>{w.time}</div></div>
              ))}
              <div className="s-tnote">{t.winNote}</div>
            </div>
          </div>
        </section>

        {/* BRANCHES */}
        <section id="branches" className="s-sec s-br">
          <h2 className="s-h2">{t.brTitle}</h2>
          <div className="s-brands"><img src="/img/std/brands.webp" alt="Medical Trend · Ratchaphruek Lab · MTH+ Medical Trend Healthcare" loading="lazy" /></div>
          <div className="s-br-grid">
            {t.branches.map((b, i) => (
              <div key={b.name} className="s-br-card">
                <div className="s-br-area">{b.area}</div>
                <div className="s-br-name">{b.name}</div>
                <div className="s-br-addr">{b.addr}</div>
                <div className="s-hr" />
                <div className="s-br-hours">{b.hours}</div>
                {'tag' in b && b.tag && <div className="s-tag">{b.tag}</div>}
                <div className="s-br-links">
                  <a href={'tel:' + BRANCH_TEL[i]}>{BRANCH_TEL[i].replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}</a>
                  <a href={BRANCH_MAP[i]} target="_blank" rel="noopener">{lang === 'th' ? 'แผนที่ ↗' : 'Map ↗'}</a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="s-sec s-faq-sec">
          <div className="s-faq">
            <h2 className="s-h2">{t.faqTitle}</h2>
            <div className="s-faq-list">
              {t.faq.map(q => (
                <div key={q.q} className="s-qa"><div className="s-q">{q.q}</div><div className="s-a">{q.a}</div></div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* CTA + FOOTER */}
      <footer className="s-end">
        <div className="s-in s-end-in">
          <div className="s-end-top">
            <img src="/img/std/footer.svg" alt="" />
            <div className="s-end-t">
              <h2 className="s-h2">{t.endTitle}</h2>
              <p>{t.endSub}</p>
            </div>
            <div className="s-end-btns">
              <a className="btn-w" href="#booking">{t.navCta}</a>
              <a className="btn-wo" href="tel:0952472631">095-247-2631</a>
            </div>
          </div>
          <div className="s-end-bottom">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{t.company}</div>
              <a href="https://www.medicaltrend.co.th">www.medicaltrend.co.th</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <a href="/">{lang === 'th' ? 'ตรวจเลือด ตรวจสุขภาพ และเจาะเลือดถึงบ้าน →' : 'Blood tests, health checks & home collection →'}</a>
            </div>
          </div>
        </div>
      </footer>

      {/* STICKY TOTAL */}
      {showBar && (
        <div className="s-bar">
          <div className="s-bar-in">
            {shownNotice && (
              <div className="s-notice">
                <div className="s-notice-t" aria-live="polite">{shownNotice}</div>
                {hasUpgrade && <button type="button" onClick={upgrade}>{nc.upgrade}</button>}
              </div>
            )}
            <div className="s-bar-row">
              <div className="s-bar-l">
                <div className="s-bar-sel">{sc.barSel}</div>
                <div className="s-bar-name">{cartName}</div>
                <div className="s-bar-sub">{cartSub}</div>
                <div className="s-bar-total m-only">{totalText}</div>
              </div>
              <div className="s-bar-r">
                <div className="s-total d-only">
                  <div className="s-total-l">{sc.barTotal}</div>
                  <div className="s-bar-total">{totalText}</div>
                </div>
                <button type="button" className="s-bar-clear" onClick={clearAll}>{sc.barClear}</button>
                <a className="s-bar-go" href="#booking">{sc.barGo}</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Same contact details as the main site's branch cards (src/content.tsx), in STD_BRANCHES order.
const BRANCH_TEL = ['0952472631', '0857178242', '0885647132', '0902264192'];
const BRANCH_MAP = [
  'https://maps.app.goo.gl/dHaP2e7HRyN2FW7V6', 'https://maps.app.goo.gl/y9izRjZqGh4rdBw3A',
  'https://maps.app.goo.gl/fLN92AkvcfVXRNn7A', 'https://maps.app.goo.gl/tDfmQh4GsNK9HKAbA',
];
