/**
 * Letter template (TipTap HTML) ko asal data se bharna.
 * Template mein: <span data-field="employee.fullName" data-format="upper">, <tr data-repeat="pay.earnings">,
 * <section data-if="employee.gender" data-op="eq" data-value="Female">. Values hamesha text node bante hain (HTML nahi).
 */
import { LetterData, LetterLang, LetterPay, Letterhead, PaperSize, REF_MARKER } from './rb.models';

export type FieldKind = 'text' | 'date' | 'money' | 'number' | 'list';

export interface FieldDef {
  key: string;
  kind: FieldKind;
  /** list ke andar ki fields (item.*) */
  item?: FieldDef[];
}

export interface FieldGroup {
  key: string;
  fields: FieldDef[];
}

/** Editor ke "Fields" panel aur preview ka catalogue. Labels: rb.f.<key> (translations). */
export const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    key: 'employee', fields: [
      { key: 'employee.fullName', kind: 'text' }, { key: 'employee.firstName', kind: 'text' }, { key: 'employee.lastName', kind: 'text' },
      { key: 'employee.code', kind: 'text' }, { key: 'employee.title', kind: 'text' }, { key: 'employee.titleAr', kind: 'text' },
      { key: 'employee.heShe', kind: 'text' }, { key: 'employee.hisHer', kind: 'text' }, { key: 'employee.gender', kind: 'text' },
      { key: 'employee.nationality', kind: 'text' }, { key: 'employee.dateOfBirth', kind: 'date' }, { key: 'employee.workEmail', kind: 'text' },
      { key: 'employee.workPhone', kind: 'text' }, { key: 'employee.joiningDate', kind: 'date' }, { key: 'employee.confirmationDate', kind: 'date' },
      { key: 'employee.exitDate', kind: 'date' }, { key: 'employee.exitReason', kind: 'text' }, { key: 'employee.status', kind: 'text' },
      { key: 'employee.employmentType', kind: 'text' }, { key: 'employee.service', kind: 'text' }, { key: 'employee.serviceYears', kind: 'number' }
    ]
  },
  {
    key: 'job', fields: [
      { key: 'job.position', kind: 'text' }, { key: 'job.department', kind: 'text' }, { key: 'job.location', kind: 'text' },
      { key: 'job.city', kind: 'text' }, { key: 'job.level', kind: 'number' }, { key: 'job.manager', kind: 'text' },
      { key: 'job.managerPosition', kind: 'text' }
    ]
  },
  {
    key: 'pay', fields: [
      { key: 'pay.basic', kind: 'money' }, { key: 'pay.gross', kind: 'money' }, { key: 'pay.deductions', kind: 'money' },
      { key: 'pay.net', kind: 'money' }, { key: 'pay.annual', kind: 'money' }, { key: 'pay.currency', kind: 'text' },
      { key: 'pay.period', kind: 'text' }, { key: 'pay.bankName', kind: 'text' }, { key: 'pay.iban', kind: 'text' },
      { key: 'pay.earnings', kind: 'list', item: [{ key: 'item.name', kind: 'text' }, { key: 'item.amount', kind: 'money' }] },
      { key: 'pay.deductionLines', kind: 'list', item: [{ key: 'item.name', kind: 'text' }, { key: 'item.amount', kind: 'money' }] }
    ]
  },
  {
    key: 'company', fields: [
      { key: 'company.name', kind: 'text' }, { key: 'company.legalName', kind: 'text' }, { key: 'company.email', kind: 'text' },
      { key: 'company.phone', kind: 'text' }
    ]
  },
  {
    key: 'letter', fields: [
      { key: 'letter.ref', kind: 'text' }, { key: 'letter.date', kind: 'date' }, { key: 'letter.purpose', kind: 'text' },
      { key: 'letter.signatoryName', kind: 'text' }, { key: 'letter.signatoryTitle', kind: 'text' }
    ]
  }
];

export const ALL_FIELDS: readonly FieldDef[] = FIELD_GROUPS.flatMap(g => g.fields);
export const LIST_FIELDS = ALL_FIELDS.filter(f => f.kind === 'list');

/** Kis field kind par kaun se formats. Pehla = default. */
export const FORMATS: Record<FieldKind, readonly string[]> = {
  text: ['', 'upper'],
  date: ['', 'short', 'hijri'],
  money: ['', 'words', 'plain'],
  number: ['', 'words'],
  list: ['']
};

export function fieldKind(key: string): FieldKind {
  return ALL_FIELDS.find(f => f.key === key)?.kind ?? LIST_FIELDS.flatMap(f => f.item ?? []).find(f => f.key === key)?.kind ?? 'text';
}

export function usesPay(html: string | null | undefined): boolean {
  return !!html && /data-(field|repeat|if)="pay\./.test(html);
}

export interface LetterContextInput {
  data: LetterData;
  pay: LetterPay | null;
  company: Letterhead | null;
  lang: LetterLang;
  purpose: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  /** Issue ke waqt REF_MARKER (server number dalta hai); preview mein namoona. */
  ref: string;
  today?: Date;
}

export type LetterContext = Record<string, unknown>;

export function buildContext(i: LetterContextInput): LetterContext {
  const e = i.data.employee;
  const j = i.data.job;
  const p = i.pay;
  const today = i.today ?? new Date();
  return {
    employee: {
      ...e,
      nationality: countryName(e.nationality, i.lang),
      service: serviceText(e.serviceYears, e.serviceMonths, i.lang)
    },
    job: { ...j, city: j.locationCity },
    pay: p ? {
      basic: p.basic, gross: p.gross, deductions: p.deductions, net: p.net, annual: p.annualSalary ?? (p.gross !== null ? p.gross * 12 : null),
      currency: p.currency, period: p.periodStart ? monthName(p.periodStart, i.lang) : null, bankName: p.bankName, iban: p.iban,
      earnings: p.earnings, deductionLines: p.deductionLines
    } : {},
    company: i.company ? { name: i.company.name, legalName: i.company.legalName ?? i.company.name, email: i.company.email, phone: i.company.phone } : {},
    letter: {
      ref: i.ref,
      date: isoDate(today),
      purpose: i.purpose,
      signatoryName: i.signatoryName,
      signatoryTitle: i.signatoryTitle
    }
  };
}

export interface RenderResult {
  html: string;
  /** Jo fields khaali reh gaye (preview mein warning). */
  missing: string[];
}

const BLANK = '__________';

export function renderLetter(template: string, ctx: LetterContext, lang: LetterLang): RenderResult {
  const doc = new DOMParser().parseFromString(`<div id="rb-root">${template}</div>`, 'text/html');
  const root = doc.getElementById('rb-root')!;
  const missing = new Set<string>();
  scrub(root);

  // Shart wale hisse: andar wale pehle (reverse order)
  for (const s of Array.from(root.querySelectorAll<HTMLElement>('section[data-if]')).reverse()) {
    const show = test(lookup(ctx, s.dataset['if'] ?? ''), s.dataset['op'] ?? 'notempty', s.dataset['value'] ?? '');
    if (show) s.replaceWith(...Array.from(s.childNodes));
    else s.remove();
  }

  // Repeat rows: har item ke liye ek copy
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-repeat]'))) {
    const list = lookup(ctx, el.dataset['repeat'] ?? '');
    const items = Array.isArray(list) ? list : [];
    for (const item of items) {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.removeAttribute('data-repeat');
      copy.classList.remove('rb-repeat');
      fill(copy, { ...ctx, item }, lang, missing);
      el.parentNode!.insertBefore(copy, el);
    }
    if (!items.length) missing.add(el.dataset['repeat'] ?? '');
    el.remove();
  }

  fill(root, ctx, lang, missing);
  return { html: root.innerHTML, missing: [...missing].filter(Boolean) };
}

function fill(scope: HTMLElement, ctx: LetterContext, lang: LetterLang, missing: Set<string>): void {
  for (const f of Array.from(scope.querySelectorAll<HTMLElement>('span[data-field]'))) {
    const key = f.dataset['field'] ?? '';
    const value = lookup(ctx, key);
    let text: string;
    if (key === 'letter.ref' && value === REF_MARKER) text = REF_MARKER;
    else text = formatValue(value, fieldKind(key), f.dataset['format'] ?? '', lang, String(lookup(ctx, 'pay.currency') ?? ''));
    if (!text) {
      missing.add(key);
      text = BLANK;
    }
    f.replaceWith(f.ownerDocument.createTextNode(text));
  }
}

/** Server bhi saaf karta hai; yahan dobara taake preview mein bhi kuch na chale. */
function scrub(root: HTMLElement): void {
  root.querySelectorAll('script, style, iframe, object, embed, form, input, button, link, meta').forEach(n => n.remove());
  root.querySelectorAll('*').forEach(el => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase();
      if (a.name.startsWith('on') || ((a.name === 'href' || a.name === 'src') && !/^(https?:|#|\/)/.test(v) && v !== '')) el.removeAttribute(a.name);
    }
  });
}

function lookup(ctx: LetterContext, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), ctx);
}

function test(value: unknown, op: string, want: string): boolean {
  const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  const text = empty ? '' : String(value).trim().toLowerCase();
  switch (op) {
    case 'empty': return empty;
    case 'eq': return text === want.trim().toLowerCase();
    case 'ne': return text !== want.trim().toLowerCase();
    default: return !empty;
  }
}

// ───── Formatting ─────

const DATE_LOCALE: Record<LetterLang, string> = { en: 'en-GB', ar: 'ar-u-ca-gregory-nu-latn' };

export function formatValue(value: unknown, kind: FieldKind, format: string, lang: LetterLang, currency = ''): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'date' || format === 'hijri' || format === 'short') {
    const d = parseDate(String(value));
    if (!d) return String(value);
    if (format === 'hijri') {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-latn' : 'en-u-ca-islamic-umalqura',
        { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    }
    if (format === 'short') return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    return new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  }
  if (kind === 'money' || kind === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (format === 'words') return amountInWords(n, lang, kind === 'money' ? currency : '');
    if (kind === 'number') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: format !== 'plain' }).format(n);
  }
  const s = String(value);
  return format === 'upper' ? s.toLocaleUpperCase(lang) : s;
}

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthName(iso: string, lang: LetterLang): string {
  const d = parseDate(iso);
  return d ? new Intl.DateTimeFormat(DATE_LOCALE[lang], { month: 'long', year: 'numeric' }).format(d) : iso;
}

function countryName(code: string | null, lang: LetterLang): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function serviceText(years: number, months: number, lang: LetterLang): string {
  if (lang === 'ar') {
    const y = years === 0 ? '' : years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
    const m = months === 0 ? '' : months === 1 ? 'شهر واحد' : months === 2 ? 'شهران' : months <= 10 ? `${months} أشهر` : `${months} شهرًا`;
    return [y, m].filter(Boolean).join(' و') || 'أقل من شهر';
  }
  const y = years === 0 ? '' : `${years} year${years === 1 ? '' : 's'}`;
  const m = months === 0 ? '' : `${months} month${months === 1 ? '' : 's'}`;
  return [y, m].filter(Boolean).join(' and ') || 'less than a month';
}

// ───── Amount in words (English + Arabic tafqeet) ─────

const CURRENCY_NAMES: Record<string, { en: string; ar: string; fracEn: string; fracAr: string }> = {
  SAR: { en: 'Saudi riyals', ar: 'ريال سعودي', fracEn: 'halalas', fracAr: 'هللة' },
  AED: { en: 'UAE dirhams', ar: 'درهم إماراتي', fracEn: 'fils', fracAr: 'فلس' },
  QAR: { en: 'Qatari riyals', ar: 'ريال قطري', fracEn: 'dirhams', fracAr: 'درهم' },
  KWD: { en: 'Kuwaiti dinars', ar: 'دينار كويتي', fracEn: 'fils', fracAr: 'فلس' },
  BHD: { en: 'Bahraini dinars', ar: 'دينار بحريني', fracEn: 'fils', fracAr: 'فلس' },
  OMR: { en: 'Omani rials', ar: 'ريال عماني', fracEn: 'baisa', fracAr: 'بيسة' },
  EGP: { en: 'Egyptian pounds', ar: 'جنيه مصري', fracEn: 'piastres', fracAr: 'قرش' },
  PKR: { en: 'Pakistani rupees', ar: 'روبية باكستانية', fracEn: 'paisa', fracAr: 'بيسة' },
  USD: { en: 'US dollars', ar: 'دولار أمريكي', fracEn: 'cents', fracAr: 'سنت' },
  EUR: { en: 'euros', ar: 'يورو', fracEn: 'cents', fracAr: 'سنت' },
  GBP: { en: 'pounds sterling', ar: 'جنيه إسترليني', fracEn: 'pence', fracAr: 'بنس' }
};

export function amountInWords(n: number, lang: LetterLang, currency = ''): string {
  const whole = Math.floor(Math.abs(n));
  const frac = Math.round((Math.abs(n) - whole) * 100);
  const cur = CURRENCY_NAMES[currency.toUpperCase()];
  if (lang === 'ar') {
    const main = arabicWords(whole);
    const unit = cur?.ar ?? currency;
    const part = frac ? ` و${arabicWords(frac)} ${cur?.fracAr ?? ''}`.trimEnd() : '';
    return unit ? `فقط ${main} ${unit}${part} لا غير` : `${main}${part}`;
  }
  const main = englishWords(whole);
  const cap = main.charAt(0).toUpperCase() + main.slice(1);
  const unit = cur?.en ?? currency;
  const part = frac ? ` and ${englishWords(frac)} ${cur?.fracEn ?? ''}`.trimEnd() : '';
  return unit ? `${cap} ${unit}${part} only` : `${cap}${part}`;
}

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function englishWords(n: number): string {
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '');
  if (n < 1000) return EN_ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + englishWords(n % 100) : '');
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    if (n >= size) return englishWords(Math.floor(n / size)) + ' ' + name + (n % size ? ' ' + englishWords(n % size) : '');
  }
  return String(n);
}

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر',
  'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function arabicBelowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(AR_HUNDREDS[Math.floor(n / 100)]);
  const r = n % 100;
  if (r > 0 && r < 20) parts.push(AR_ONES[r]);
  else if (r >= 20) parts.push(r % 10 ? `${AR_ONES[r % 10]} و${AR_TENS[Math.floor(r / 10)]}` : AR_TENS[Math.floor(r / 10)]);
  return parts.join(' و');
}

/** Tafqeet: 12150 → "اثنا عشر ألفًا ومائة وخمسون". */
export function arabicWords(n: number): string {
  if (n === 0) return 'صفر';
  const scales: [number, string, string, string, string][] = [
    [1e9, 'مليار', 'ملياران', 'مليارات', 'مليارًا'],
    [1e6, 'مليون', 'مليونان', 'ملايين', 'مليونًا'],
    [1e3, 'ألف', 'ألفان', 'آلاف', 'ألفًا']
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [size, one, two, few, many] of scales) {
    const c = Math.floor(rest / size);
    rest %= size;
    if (!c) continue;
    if (c === 1) parts.push(one);
    else if (c === 2) parts.push(two);
    else if (c <= 10) parts.push(`${arabicBelowThousand(c)} ${few}`);
    else parts.push(`${arabicBelowThousand(c)} ${c % 100 === 0 ? one : many}`);
  }
  if (rest) parts.push(arabicBelowThousand(rest));
  return parts.join(' و');
}

// ───── Page wrapper (letterhead) ─────

export interface PageOptions {
  lang: LetterLang;
  paper: PaperSize;
  letterhead: Letterhead | null;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Bhara hua body + letterhead = ek sheet. Yahi HTML server par snapshot banta hai (reprint bilkul wesa). */
export function wrapPage(body: string, o: PageOptions): string {
  const lh = o.letterhead;
  const head = lh
    ? `<header class="rb-lh">${lh.logoUrl && /^https?:\/\//.test(lh.logoUrl) ? `<img class="rb-lh-logo" src="${esc(lh.logoUrl)}" alt="">` : `<span class="rb-lh-mark">${esc(lh.name.charAt(0))}</span>`}`
      + `<span class="rb-lh-name"><strong>${esc(lh.legalName || lh.name)}</strong>`
      + `<span class="rb-lh-contact">${[lh.email, lh.phone].filter(Boolean).map(x => esc(x!)).join(' · ')}</span></span></header>`
    : '';
  return `<article class="rb-page rb-${o.paper.toLowerCase()}" dir="${o.lang === 'ar' ? 'rtl' : 'ltr'}" lang="${o.lang}">${head}<div class="rb-body">${body}</div></article>`;
}

/** Print ke liye @page size (A4 / Letter) — ek hi style tag, har print se pehle update. */
export function setPrintPage(paper: PaperSize, pageNumbers: boolean): void {
  let el = document.getElementById('rb-print-page') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'rb-print-page';
    document.head.appendChild(el);
  }
  const size = paper === 'Letter' ? 'letter' : 'A4';
  el.textContent = `@page { size: ${size}; margin: 14mm 0 16mm; ${pageNumbers ? '@bottom-center { content: counter(page) " / " counter(pages); font: 9pt sans-serif; color: #777; }' : ''} }`;
}
