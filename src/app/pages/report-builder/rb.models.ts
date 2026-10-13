/** Report builder — Employee API /report-builder/* aur Payroll API /payroll/report-builder/* ke DTOs. */

export type FieldType = 'Text' | 'Number' | 'Money' | 'Date' | 'Bool';
export type ReportChart = 'None' | 'Bar' | 'Pie' | 'Line';
export type ReportPeriod = 'None' | 'ThisMonth' | 'LastMonth' | 'Last30Days' | 'ThisQuarter' | 'ThisYear' | 'LastYear' | 'Custom';
export type LetterCategory = 'Experience' | 'Salary' | 'Employment' | 'Offer' | 'Warning' | 'NoObjection' | 'Other';
export type LetterLanguages = 'English' | 'Arabic' | 'Both';
export type PaperSize = 'A4' | 'Letter';
export type TemplateStatus = 'Draft' | 'Published' | 'Archived';
export type LetterLang = 'en' | 'ar';

export interface ReportField {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  noTotal: boolean;
}

export interface ReportSource {
  key: string;
  label: string;
  description: string;
  needsRange: boolean;
  fields: ReportField[];
}

export interface ReportFilter {
  field: string;
  op: string;
  value: string | null;
  value2?: string | null;
}

export interface ReportAggregate {
  fn: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field: string | null;
}

export interface ReportSpec {
  columns: string[];
  filters: ReportFilter[];
  groupBy: string | null;
  aggregates: ReportAggregate[];
  sort: { key: string; desc: boolean } | null;
  limit: number | null;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: FieldType;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: (string | number | boolean | null)[][];
  totals: (string | number | boolean | null)[] | null;
  totalRows: number;
  truncated: boolean;
}

export interface RunResult {
  result: ReportResult;
  from: string | null;
  to: string | null;
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  source: string;
  spec: ReportSpec;
  chart: ReportChart;
  period: ReportPeriod;
  fromDate: string | null;
  toDate: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string | null;
  lastRunAt: string | null;
  canRun: boolean;
  runFrom: string | null;
  runTo: string | null;
}

export interface ReportBody {
  name: string;
  description: string | null;
  source: string;
  spec: ReportSpec;
  chart: ReportChart;
  period: ReportPeriod;
  fromDate: string | null;
  toDate: string | null;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  category: LetterCategory;
  languages: LetterLanguages;
  status: TemplateStatus;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  refPrefix: string;
  updatedAt: string | null;
  createdAt: string;
  issuedCount: number;
  lastIssuedAt: string | null;
}

export interface Home {
  canBuild: boolean;
  canIssue: boolean;
  canSeePayroll: boolean;
  sources: ReportSource[];
  reports: SavedReport[];
  templates: TemplateListItem[];
}

export interface TemplateSettings {
  name: string;
  description: string | null;
  category: LetterCategory;
  languages: LetterLanguages;
  paper: PaperSize;
  showLetterhead: boolean;
  showPageNumbers: boolean;
  refPrefix: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

export interface PublishedTemplate {
  version: number;
  htmlEn: string | null;
  htmlAr: string | null;
  paper: PaperSize;
  showLetterhead: boolean;
  showPageNumbers: boolean;
  signatoryName: string | null;
  signatoryTitle: string | null;
  publishedAt: string;
}

export interface TemplateDetail extends TemplateSettings {
  id: string;
  refPrefix: string;
  status: TemplateStatus;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  draftHtmlEn: string | null;
  draftHtmlAr: string | null;
  published: PublishedTemplate | null;
  versions: { version: number; publishedAt: string; publishedByName: string | null }[];
  rowVersion: number;
}

export interface SaveResult {
  id: string;
  rowVersion: number;
}

export interface LetterPerson {
  id: string;
  code: string;
  name: string;
  department: string | null;
  designation: string | null;
  status: string;
}

export interface LetterEmployeeData {
  id: string;
  code: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string | null;
  title: string | null;
  titleAr: string | null;
  heShe: string | null;
  hisHer: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  workEmail: string;
  workPhone: string | null;
  joiningDate: string;
  probationEnd: string | null;
  confirmationDate: string | null;
  exitDate: string | null;
  exitReason: string | null;
  status: string;
  employmentType: string;
  serviceYears: number;
  serviceMonths: number;
}

export interface LetterData {
  employee: LetterEmployeeData;
  job: {
    position: string;
    department: string;
    location: string;
    locationCity: string | null;
    level: number | null;
    manager: string | null;
    managerPosition: string | null;
  };
}

export interface LetterPayLine {
  name: string;
  code: string;
  amount: number;
}

export interface LetterPay {
  employeeId: string;
  currency: string | null;
  period: string | null;
  periodStart: string | null;
  basic: number | null;
  gross: number | null;
  deductions: number | null;
  net: number | null;
  earnings: LetterPayLine[];
  deductionLines: LetterPayLine[];
  salaryAmount: number | null;
  salaryBasis: string | null;
  annualSalary: number | null;
  bankName: string | null;
  iban: string | null;
}

export interface Letterhead {
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
}

export interface IssuedLetterItem {
  id: string;
  ref: string;
  templateId: string;
  templateName: string;
  category: LetterCategory;
  templateVersion: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  language: LetterLang;
  issuedAt: string;
  issuedByName: string | null;
  purpose: string | null;
  isVoid: boolean;
  voidReason: string | null;
  batchId: string | null;
}

export interface IssuedLetter {
  info: IssuedLetterItem;
  html: string;
  paper: PaperSize;
  voidedAt: string | null;
}

export interface IssuedResult {
  id: string;
  employeeId: string;
  ref: string;
  html: string;
}

// ───── Constants ─────

export const CHARTS: readonly ReportChart[] = ['None', 'Bar', 'Pie', 'Line'];
export const PERIODS: readonly ReportPeriod[] = ['ThisMonth', 'LastMonth', 'Last30Days', 'ThisQuarter', 'ThisYear', 'LastYear', 'Custom'];
export const CATEGORIES: readonly LetterCategory[] = ['Experience', 'Salary', 'Employment', 'Offer', 'Warning', 'NoObjection', 'Other'];
export const LANGUAGE_MODES: readonly LetterLanguages[] = ['English', 'Arabic', 'Both'];
export const MAX_BATCH = 200;
export const REF_MARKER = '[[REF]]';

export const CATEGORY_ICON: Record<LetterCategory, string> = {
  Experience: 'workspace_premium',
  Salary: 'payments',
  Employment: 'badge',
  Offer: 'handshake',
  Warning: 'report',
  NoObjection: 'verified',
  Other: 'description'
};

export const TEMPLATE_CHIP: Record<TemplateStatus, string> = {
  Draft: 'chip-amber',
  Published: 'chip-moss',
  Archived: 'chip-muted'
};

/** Har field type par kaun se filter operator. */
export const OPS: Record<FieldType, readonly string[]> = {
  Text: ['eq', 'ne', 'contains', 'starts', 'in', 'empty', 'notempty'],
  Number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notempty'],
  Money: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notempty'],
  Date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notempty'],
  Bool: ['eq']
};

export const NO_VALUE_OPS = ['empty', 'notempty'];

export function aggKey(a: ReportAggregate): string {
  return a.field ? `${a.fn}:${a.field}` : a.fn;
}

export function emptySpec(): ReportSpec {
  return { columns: [], filters: [], groupBy: null, aggregates: [], sort: null, limit: null };
}

export function isPayroll(source: string): boolean {
  return source.startsWith('payroll:');
}

/** Client par period → from/to (server bhi yahi karta hai; naye, abhi save na hue report ke liye). */
export function resolvePeriod(period: ReportPeriod, from: string | null, to: string | null, today = new Date()): { from: string; to: string } | null {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3) * 3;
  switch (period) {
    case 'ThisMonth': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'LastMonth': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'Last30Days': return { from: iso(new Date(y, m, today.getDate() - 29)), to: iso(today) };
    case 'ThisQuarter': return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    case 'ThisYear': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'LastYear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'Custom': return from && to ? { from, to } : null;
    default: return null;
  }
}

/**
 * Server ke labels English mein aate hain. Doosri zubaan mein rb.src.* / rb.col.* / rb.grp.* translation ho to woh,
 * warna server wala label.
 */
export type Tr = (key: string) => string;

function tryTr(tr: Tr, key: string): string | null {
  const v = tr(key);
  return v && v !== key ? v : null;
}

export function sourceKey(source: string): string {
  return source.replace(/^(employee|payroll):/, '');
}

export function sourceLabel(tr: Tr, lang: string, s: ReportSource | undefined, fallback = ''): string {
  if (!s) return fallback;
  return (lang !== 'en' && tryTr(tr, `rb.src.${sourceKey(s.key)}`)) || s.label;
}

export function sourceDescription(tr: Tr, lang: string, s: ReportSource): string {
  return (lang !== 'en' && tryTr(tr, `rb.srcDesc.${sourceKey(s.key)}`)) || s.description;
}

export function fieldLabel(tr: Tr, lang: string, f: { key: string; label: string }): string {
  return (lang !== 'en' && tryTr(tr, `rb.col.${f.key}`)) || f.label;
}

export function groupLabel(tr: Tr, lang: string, g: string): string {
  return (lang !== 'en' && tryTr(tr, `rb.grp.${g}`)) || g;
}
