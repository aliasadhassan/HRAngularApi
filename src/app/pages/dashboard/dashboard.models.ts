import { AttendanceRequestType } from '../attendance/attendance.models';

/** Employee API /api/dashboard/summary — company (employees.view) ya apna department. */
export type DashboardScope = 'Company' | 'Department' | 'None';

export interface WorkforceStats {
  headcount: number;
  headcountChange: number;
  joinedThisMonth: number;
  attritionRate: number;
  averageTenureYears: number;
}

export interface AwayPerson {
  employeeId: string;
  name: string;
  kind: 'Leave' | 'Remote';
  leaveTypeName: string | null;
  until: string | null;
}

export interface AttendanceToday {
  date: string;
  total: number;
  present: number;
  remote: number;
  onLeave: number;
  notIn: number;
  late: number;
  away: AwayPerson[];
}

export interface PeopleTask {
  id: string;
  kind: 'Leave' | 'AttendanceRequest' | 'Probation';
  employeeId: string;
  employeeName: string;
  detail: string | null;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  requestType: AttendanceRequestType | null;
}

export interface PeopleEvent {
  date: string;
  kind: 'Holiday' | 'Leave' | 'Anniversary' | 'Joiner' | 'Probation';
  name: string;
  years: number | null;
}

export interface PeopleDashboard {
  scope: DashboardScope;
  stats: WorkforceStats;
  today: AttendanceToday;
  attendanceTrend: { date: string; rate: number }[];
  tasks: PeopleTask[];
  upcoming: PeopleEvent[];
}

/** Payroll API /api/payroll/dashboard — sirf payroll.view.all / payroll.approve. */
export interface DashboardRun {
  id: string;
  payGroupName: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: 'Calculated' | 'Approved' | 'Paid' | 'Processing';
  currencyCode: string;
  employees: number;
  gross: number;
  deductions: number;
  taxWithheld: number;
  employerCost: number;
  net: number;
}

export interface PayrollTask {
  id: string;
  kind: 'runApproval' | 'loanRequest' | 'advanceRequest';
  employeeName: string | null;
  amount: number | null;
  currencyCode: string | null;
  count: number | null;
}

export interface PayrollDashboard {
  latestRun: DashboardRun | null;
  departments: { name: string; headcount: number; monthlyCost: number }[];
  nextPayDate: string | null;
  tasks: PayrollTask[];
}

/** Template ke liye dono APIs ke kaam ek list mein. */
export type TaskKind = 'leave' | 'attendance' | 'probation' | 'payroll' | 'loan';

export interface Task {
  id: string;
  kind: TaskKind;
  person?: string;
  titleKey: string;
  params: Record<string, string | number>;
  /** Approve isi list se; decline ke liye wajah chahiye, isliye woh page pe hota hai */
  approvable: boolean;
  link: string;
  queryParams?: Record<string, string>;
}

export interface UpcomingEvent {
  date: Date;
  kind: 'payday' | 'holiday' | 'anniversary' | 'joiner' | 'leave' | 'probation';
  titleKey: string;
  params: Record<string, string | number>;
}
