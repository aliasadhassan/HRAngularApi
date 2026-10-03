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

// ───────────── Setup / structure / salaries ─────────────
export type ProrationMethod = 'CalendarDays' | 'WorkingDays' | 'Fixed30';
export type CalcType = 'Fixed' | 'PercentOfComponent' | 'PercentOfGross' | 'Variable' | 'Remainder';
export type SalaryBasis = 'Annual' | 'Monthly' | 'Hourly';
export type SalaryChangeReason = 'Joining' | 'Increment' | 'Promotion' | 'Correction' | 'Other';
export type TaxCalcMethod = 'None' | 'Annualized' | 'PerPeriodFlat';

export interface PayrollSettings {
  baseCurrency: string;
  prorationMethod: ProrationMethod;
  roundingDecimals: number;
  payslipNumberPrefix: string;
  requireApproval: boolean;
}

export interface PayComponent {
  id: string;
  code: string;
  name: string;
  systemCode: string | null;
  componentType: ComponentType;
  defaultCalcType: CalcType;
  defaultBaseComponentId: string | null;
  isTaxable: boolean;
  isProrated: boolean;
  isRecurring: boolean;
  showOnPayslip: boolean;
  sortOrder: number;
  isActive: boolean;
}
export type SavePayComponent = Omit<PayComponent, 'id' | 'systemCode' | 'isActive'>;

export interface TaxSlab {
  id?: string;
  fromAmount: number;
  toAmount: number | null;
  fixedAmount: number;
  ratePercent: number;
}
export interface TaxRegime {
  id: string;
  isPlatformDefined: boolean;
  countryCode: string;
  name: string;
  taxYearStartMonth: number;
  calcMethod: TaxCalcMethod;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  slabs: TaxSlab[];
}

export interface SalaryGrade {
  id: string;
  code: string;
  name: string;
  currencyCode: string;
  minAnnual: number | null;
  maxAnnual: number | null;
  isActive: boolean;
}

export interface TemplateListItem {
  id: string;
  name: string;
  salaryGradeId: string | null;
  gradeCode: string | null;
  lineCount: number;
  isActive: boolean;
}
export interface TemplateLine {
  payComponentId: string;
  componentCode?: string;
  componentName?: string;
  componentType?: ComponentType;
  calcType: CalcType;
  amount: number | null;
  percentage: number | null;
  baseComponentId: string | null;
}
export interface SalaryTemplate {
  id: string;
  name: string;
  salaryGradeId: string | null;
  isActive: boolean;
  lines: TemplateLine[];
}

export interface PayrollEmployee {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  departmentName: string | null;
  employmentType: string;
  joiningDate: string;
  exitDate: string | null;
  isActive: boolean;
  payGroupId: string | null;
  payGroupName: string | null;
  hasSalary: boolean;
  salaryBasis: SalaryBasis | null;
  salaryAmount: number | null;
  currencyCode: string | null;
}
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SalaryOverride {
  payComponentId: string;
  isExcluded: boolean;
  calcType: CalcType | null;
  amount: number | null;
  percentage: number | null;
  baseComponentId: string | null;
}
export interface EmployeeSalary {
  id: string;
  salaryTemplateId: string;
  templateName: string;
  salaryGradeId: string | null;
  currencyCode: string;
  salaryBasis: SalaryBasis;
  basisAmount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: SalaryChangeReason;
  remarks: string | null;
  overrides: SalaryOverride[];
}
export interface AssignSalary {
  employeeId: string;
  salaryTemplateId: string;
  salaryGradeId: string | null;
  currencyCode: string | null;
  salaryBasis: SalaryBasis;
  basisAmount: number;
  effectiveFrom: string;
  changeReason: SalaryChangeReason;
  remarks: string | null;
}

export interface MyPayslip {
  id: string;
  payrollRunId: string;
  payslipNumber: string;
  periodStart: string;
  periodEnd: string;
  payDate: string | null;
  currencyCode: string;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  runStatus: RunStatus;
}
