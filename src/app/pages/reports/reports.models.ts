// /reports/people, /reports/time (Employee API) aur /payroll/reports/* (Payroll API) ke shapes

export interface CountRow { key: string; count: number; }

export interface PeopleReport {
  from: string;
  to: string;
  summary: {
    headcountStart: number;
    headcountEnd: number;
    joined: number;
    left: number;
    attritionRate: number;
    averageTenureYears: number;
    averageAgeYears: number | null;
  };
  departments: { departmentId: string | null; name: string; headcount: number; joined: number; left: number; averageTenureYears: number }[];
  byType: CountRow[];
  byStatus: CountRow[];
  byGender: CountRow[];
  byLocation: CountRow[];
  tenureBands: CountRow[];
  trend: { date: string; headcount: number }[];
  movements: Movement[];
}

export interface Movement {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  date: string;
  kind: 'Joined' | 'Left';
  reason: string | null;
}

export interface TimeEmployeeRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  scheduled: number;
  present: number;
  halfDays: number;
  absent: number;
  incomplete: number;
  lateDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  leaveDays: number;
  attendanceRate: number;
}

export interface TimeReport {
  from: string;
  to: string;
  summary: {
    scheduled: number;
    attended: number;
    absent: number;
    lateDays: number;
    lateMinutes: number;
    overtimeMinutes: number;
    leaveDays: number;
    attendanceRate: number;
  };
  employees: TimeEmployeeRow[];
  departments: { name: string; employees: number; scheduled: number; attended: number; lateDays: number; leaveDays: number; attendanceRate: number }[];
  leaveTypes: { name: string; color: string | null; isPaid: boolean; requests: number; employees: number; days: number }[];
}

export interface PayTotals {
  runs: number;
  payslips: number;
  gross: number;
  deductions: number;
  tax: number;
  employerCost: number;
  net: number;
}

export type ComponentType = 'Earning' | 'Deduction' | 'EmployerContribution' | 'Informational';

export interface PayReport {
  year: number;
  currencyCode: string | null;
  totals: PayTotals;
  months: (PayTotals & { month: number })[];
  departments: { name: string; employees: number; gross: number; employerCost: number; net: number; totalCost: number }[];
  components: { code: string; name: string; type: ComponentType; employees: number; amount: number }[];
  loans: { activeLoans: number; outstanding: number; activeAdvances: number; advancesOutstanding: number };
}

export interface RegisterRow {
  payslipId: string;
  payslipNumber: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  runType: 'Regular' | 'OffCycle' | 'FinalSettlement';
  status: 'Calculated' | 'OnHold' | 'Paid';
  payableDays: number;
  gross: number;
  deductions: number;
  tax: number;
  net: number;
  employerCost: number;
}

export interface PayRegister {
  year: number;
  month: number;
  currencyCode: string | null;
  totals: PayTotals;
  rows: RegisterRow[];
}

export type RangePreset = 'thisMonth' | 'lastMonth' | 'last3' | 'thisYear' | 'last12' | 'custom';

export const RANGE_PRESETS: readonly RangePreset[] = ['thisMonth', 'lastMonth', 'last3', 'thisYear', 'last12', 'custom'];

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Preset → [from, to] (local DateOnly strings). Aage ki date nahi — "to" aaj tak. */
export function presetRange(preset: Exclude<RangePreset, 'custom'>, now = new Date()): [string, string] {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'thisMonth': return [iso(new Date(y, m, 1)), iso(now)];
    case 'lastMonth': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case 'last3': return [iso(new Date(y, m - 2, 1)), iso(now)];
    case 'thisYear': return [iso(new Date(y, 0, 1)), iso(now)];
    case 'last12': return [iso(new Date(y - 1, m, now.getDate() + 1)), iso(now)];
  }
}

/** Excel-friendly CSV (BOM ke saath taake Arabic/Chinese sahi khulein). */
export function downloadCsv(fileName: string, header: string[], rows: (string | number | null | undefined)[][]): void {
  const cell = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
