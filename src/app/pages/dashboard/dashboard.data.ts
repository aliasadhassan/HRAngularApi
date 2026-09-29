/**
 * Demo data — dates hamesha "aaj" ke hisaab se banti hain, taake sales demo kabhi purana na lage.
 * Asal APIs aane pe ye file DashboardService se replace hogi; component ka shape wahi rahega.
 */

export interface PayrollSnapshot {
  periodStart: Date;
  payDate: Date;
  reference: string;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  employees: number;
  gross: number;
  deductions: number;
  taxWithheld: number;
  employerCost: number;
  net: number;
}

export interface AttendanceToday {
  total: number;
  present: number;
  remote: number;
  onLeave: number;
  absent: number;
  away: { name: string; initials: string; reasonKey: string; until?: Date }[];
}

export interface WorkforceStats {
  headcount: number;
  headcountChange: number;
  joinedThisMonth: number;
  attritionRate: number;
  averageTenureYears: number;
}

export interface DepartmentCost {
  nameKey: string;
  headcount: number;
  monthlyCost: number;
  color: string;
}

export type TaskKind = 'leave' | 'salary' | 'payroll' | 'contract';

export interface Task {
  id: number;
  kind: TaskKind;
  person?: string;
  titleKey: string;
  params: Record<string, string | number>;
  decidable: boolean;
}

export interface UpcomingEvent {
  date: Date;
  kind: 'payday' | 'holiday' | 'anniversary' | 'joiner' | 'leave' | 'contract';
  titleKey: string;
  params: Record<string, string | number>;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function buildDashboardData(today = new Date()) {
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const payDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const mm = String(periodStart.getMonth() + 1).padStart(2, '0');

  const payroll: PayrollSnapshot = {
    periodStart,
    payDate,
    reference: `PR-${periodStart.getFullYear()}-${mm}-0128`,
    status: 'calculated',
    employees: 128,
    gross: 19_824_500,
    deductions: 1_388_290,
    taxWithheld: 1_146_830,
    employerCost: 20_417_235,
    net: 18_436_210
  };

  const attendance: AttendanceToday = {
    total: 128,
    present: 104,
    remote: 12,
    onLeave: 7,
    absent: 5,
    away: [
      { name: 'Hira Baig', initials: 'HB', reasonKey: 'dashboard.away.annual', until: addDays(today, 4) },
      { name: 'Usman Tariq', initials: 'UT', reasonKey: 'dashboard.away.sick' },
      { name: 'Mariam Al-Harbi', initials: 'MA', reasonKey: 'dashboard.away.training', until: addDays(today, 1) },
      { name: 'Kamran Sheikh', initials: 'KS', reasonKey: 'dashboard.away.unplanned' }
    ]
  };

  const stats: WorkforceStats = {
    headcount: 128,
    headcountChange: 6,
    joinedThisMonth: 5,
    attritionRate: 4.1,
    averageTenureYears: 3.2
  };

  const departments: DepartmentCost[] = [
    { nameKey: 'dashboard.dept.engineering', headcount: 46, monthlyCost: 8_120_000, color: '#13211a' },
    { nameKey: 'dashboard.dept.sales', headcount: 28, monthlyCost: 4_310_000, color: '#3f5e48' },
    { nameKey: 'dashboard.dept.operations', headcount: 24, monthlyCost: 3_240_500, color: '#7d9a83' },
    { nameKey: 'dashboard.dept.finance', headcount: 12, monthlyCost: 2_046_000, color: '#b08d3e' },
    { nameKey: 'dashboard.dept.design', headcount: 10, monthlyCost: 1_388_000, color: '#d8c38f' },
    { nameKey: 'dashboard.dept.people', headcount: 8, monthlyCost: 720_000, color: '#8e3b2e' }
  ];

  // Pichhle 14 working din (Sat/Sun chhod kar), aakhri = aaj
  const attendanceTrend: { date: Date; rate: number }[] = [];
  const rates = [93.8, 95.1, 94.4, 91.2, 96.0, 95.3, 94.7, 92.9, 95.8, 96.4, 94.1, 93.6, 95.0, 90.6];
  for (let d = new Date(today), i = rates.length - 1; i >= 0; d = addDays(d, -1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    attendanceTrend.unshift({ date: d, rate: rates[i--] });
  }

  const tasks: Task[] = [
    { id: 1, kind: 'payroll', titleKey: 'dashboard.tasks.payrollReady', params: { count: payroll.employees }, decidable: false },
    { id: 2, kind: 'leave', person: 'Hira Baig', titleKey: 'dashboard.tasks.annualLeave', params: { days: 4 }, decidable: true },
    { id: 3, kind: 'salary', person: 'Bilal Ahmed', titleKey: 'dashboard.tasks.increment', params: { amount: '245,000' }, decidable: true },
    { id: 4, kind: 'leave', person: 'Usman Tariq', titleKey: 'dashboard.tasks.sickLeave', params: { days: 1 }, decidable: true },
    { id: 5, kind: 'contract', person: 'Sana Qureshi', titleKey: 'dashboard.tasks.contractEnds', params: { days: 16 }, decidable: false }
  ];

  const upcoming: UpcomingEvent[] = [
    { date: payDate, kind: 'payday', titleKey: 'dashboard.upcoming.payday', params: {} },
    { date: addDays(today, 6), kind: 'leave', titleKey: 'dashboard.upcoming.leave', params: { name: 'Hira Baig' } },
    { date: addDays(today, 13), kind: 'anniversary', titleKey: 'dashboard.upcoming.anniversary', params: { name: 'Ayesha Siddiqui', years: 5 } },
    { date: addDays(today, 16), kind: 'contract', titleKey: 'dashboard.upcoming.contract', params: { name: 'Sana Qureshi' } },
    { date: addDays(today, 21), kind: 'joiner', titleKey: 'dashboard.upcoming.joiner', params: { name: 'Faraz Khan' } }
  ].sort((a, b) => a.date.getTime() - b.date.getTime()) as UpcomingEvent[];

  return { payroll, attendance, stats, departments, attendanceTrend, tasks, upcoming };
}
