/** Payroll API ke DTOs — backend ke records ke saath 1:1 (enums string mein aate hain). */

export type RunStatus = 'Draft' | 'Processing' | 'Calculated' | 'Approved' | 'Paid' | 'Cancelled' | 'Failed';
export type RunType = 'Regular' | 'OffCycle' | 'FinalSettlement';
export type PayslipStatus = 'Calculated' | 'OnHold' | 'Paid';
export type ComponentType = 'Earning' | 'Deduction' | 'EmployerContribution' | 'Informational';
export type LineSource = 'Template' | 'Override' | 'Input' | 'Proration' | 'Contribution' | 'Tax' | 'Loan';
export type PayFrequency = 'Monthly' | 'SemiMonthly' | 'BiWeekly' | 'Weekly';
export type PayPeriodStatus = 'Open' | 'Locked';

export interface PayrollRun {
  id: string;
  payGroupId: string;
  payGroupName: string;
  payPeriodId: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  runType: RunType;
  status: RunStatus;
  currencyCode: string;
  totalEmployees: number;
  processedEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  calculatedAt: string | null;
  approvedAt: string | null;
  failureReason: string | null;
}

export interface PayslipListItem {
  id: string;
  employeeId: string;
  payslipNumber: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  payableDays: number;
  grossEarnings: number;
  totalDeductions: number;
  taxAmount: number;
  netPay: number;
  status: PayslipStatus;
  holdReason: string | null;
}

export interface PayslipLine {
  componentCode: string;
  componentName: string;
  componentType: ComponentType;
  amount: number;
  quantity: number | null;
  rate: number | null;
  isTaxable: boolean;
  source: LineSource;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  payslipNumber: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationTitle: string | null;
  bankAccountMasked: string | null;
  currencyCode: string;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  payableDays: number;
  unpaidLeaveDays: number;
  grossEarnings: number;
  totalDeductions: number;
  taxAmount: number;
  netPay: number;
  employerContributions: number;
  taxableIncome: number;
  status: PayslipStatus;
  holdReason: string | null;
  calculatedAt: string;
  lines: PayslipLine[];
}

export interface PayGroup {
  id: string;
  name: string;
  code: string;
  payFrequency: PayFrequency;
  countryCode: string;
  currencyCode: string;
  anchorDate: string;
  payDayOffset: number;
  isActive: boolean;
  employeeCount: number;
}

export interface PayPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  fiscalYear: number;
  periodNumber: number;
  status: PayPeriodStatus;
}

/** Status → chip ka rang. Ek jagah, taake har page pe ek jaisa dikhe. */
export const RUN_STATUS_CHIP: Record<RunStatus, string> = {
  Draft: 'chip',
  Processing: 'chip chip-amber',
  Calculated: 'chip chip-amber',
  Approved: 'chip chip-moss',
  Paid: 'chip chip-ink',
  Cancelled: 'chip chip-muted',
  Failed: 'chip chip-oxblood'
};

export const PAYSLIP_STATUS_CHIP: Record<PayslipStatus, string> = {
  Calculated: 'chip chip-amber',
  OnHold: 'chip chip-oxblood',
  Paid: 'chip chip-ink'
};
