/** Payroll API /api/payroll/rewards — Benefits & rewards page. Enums JSON mein string aate hain. */

export type BenefitType = 'Health' | 'Life' | 'Retirement' | 'Allowance' | 'Wellness' | 'Education' | 'Other';
export type EnrolmentStatus = 'Requested' | 'Active' | 'Ended' | 'Rejected' | 'Cancelled';
export type RevisionStatus = 'Pending' | 'Applied' | 'Rejected' | 'Cancelled';
export type RevisionReason = 'Increment' | 'Promotion' | 'Correction' | 'Other';
export type BonusType = 'Performance' | 'Festival' | 'Annual' | 'Retention' | 'Referral' | 'Spot' | 'Other';
export type BonusStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Paid';
export type BonusBasis = 'Fixed' | 'PercentOfMonthlySalary';
export type PayoutMethod = 'Payroll' | 'Direct';
export type SalaryBasis = 'Annual' | 'Monthly' | 'Hourly';

export const BENEFIT_TYPES: readonly BenefitType[] = ['Health', 'Life', 'Retirement', 'Allowance', 'Wellness', 'Education', 'Other'];
export const ENROLMENT_STATUSES: readonly EnrolmentStatus[] = ['Requested', 'Active', 'Ended', 'Rejected', 'Cancelled'];
export const REVISION_STATUSES: readonly RevisionStatus[] = ['Pending', 'Applied', 'Rejected', 'Cancelled'];
export const REVISION_REASONS: readonly RevisionReason[] = ['Increment', 'Promotion', 'Correction', 'Other'];
export const BONUS_TYPES: readonly BonusType[] = ['Performance', 'Festival', 'Annual', 'Retention', 'Referral', 'Spot', 'Other'];
export const BONUS_STATUSES: readonly BonusStatus[] = ['Pending', 'Approved', 'Paid', 'Rejected', 'Cancelled'];

export const BENEFIT_ICON: Record<BenefitType, string> = {
  Health: 'health_and_safety', Life: 'shield', Retirement: 'savings', Allowance: 'payments', Wellness: 'self_improvement',
  Education: 'school', Other: 'redeem'
};

export interface RewardsSummary {
  activePlans: number;
  coveredEmployees: number;
  monthlyEmployerCost: number;
  monthlyEmployeeCost: number;
  currencyCode: string | null;
  pendingEnrolments: number;
  pendingRevisions: number;
  pendingBonuses: number;
  revisionsAppliedThisYear: number;
  averageIncreaseThisYear: number | null;
  bonusesThisYear: number;
  bonusesThisYearCount: number;
  canView: boolean;
  canManage: boolean;
  canApprove: boolean;
  canConfigure: boolean;
  myEmployeeId: string | null;
}

export interface BenefitPlan {
  id: string;
  name: string;
  benefitType: BenefitType;
  provider: string | null;
  description: string | null;
  currencyCode: string;
  employerMonthlyCost: number;
  employeeMonthlyCost: number;
  dependentMonthlyCost: number;
  maxDependents: number;
  deductionComponentId: string | null;
  deductionComponentName: string | null;
  openForRequests: boolean;
  isActive: boolean;
  sortOrder: number;
  enrolled: number;
  requested: number;
  monthlyEmployerTotal: number;
  rowVersion: number;
}

export interface Enrolment {
  id: string;
  benefitPlanId: string;
  planName: string;
  benefitType: BenefitType;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  status: EnrolmentStatus;
  dependents: number;
  startDate: string | null;
  endDate: string | null;
  employerMonthlyCost: number;
  employeeMonthlyCost: number;
  currencyCode: string;
  deductedInPayroll: boolean;
  employeeNote: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  canCancel: boolean;
}

export interface Revision {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  designationTitle: string | null;
  reason: RevisionReason;
  currencyCode: string;
  salaryBasis: SalaryBasis;
  currentAmount: number;
  proposedAmount: number;
  changePercent: number;
  effectiveFrom: string;
  newTitle: string | null;
  justification: string | null;
  status: RevisionStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface Bonus {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  bonusType: BonusType;
  title: string;
  currencyCode: string;
  amount: number;
  payComponentId: string;
  payComponentName: string;
  batchId: string | null;
  reason: string | null;
  status: BonusStatus;
  payoutMethod: PayoutMethod | null;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  paidAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface SalaryLine {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string | null;
  designationTitle: string | null;
  joiningDate: string;
  currencyCode: string | null;
  salaryBasis: SalaryBasis | null;
  currentAmount: number | null;
  currentFrom: string | null;
  monthlyEquivalent: number | null;
  lastChangeOn: string | null;
  lastChangePercent: number | null;
  hasPendingRevision: boolean;
}

export interface Option {
  id: string;
  name: string;
  extra: string | null;
}

export interface RewardsLookups {
  employees: Option[];
  departments: Option[];
  earningComponents: Option[];
  deductionComponents: Option[];
  baseCurrency: string | null;
}

export interface MyRewards {
  employeeId: string | null;
  currencyCode: string | null;
  plans: BenefitPlan[];
  enrolments: Enrolment[];
  bonuses: Bonus[];
  revisions: Revision[];
}

export interface BatchResult {
  created: number;
  skipped: string[];
}

export interface PlanBody {
  name: string;
  benefitType: BenefitType;
  provider: string | null;
  description: string | null;
  currencyCode: string | null;
  employerMonthlyCost: number;
  employeeMonthlyCost: number;
  dependentMonthlyCost: number;
  maxDependents: number;
  deductionComponentId: string | null;
  openForRequests: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface RevisionBody {
  reason: RevisionReason;
  proposedAmount: number;
  effectiveFrom: string;
  newTitle: string | null;
  justification: string | null;
}

export interface BonusBody {
  bonusType: BonusType;
  title: string;
  amount: number;
  payComponentId: string;
  reason: string | null;
}

export const ENROLMENT_CHIP: Record<EnrolmentStatus, string> = {
  Requested: 'chip chip-amber',
  Active: 'chip chip-moss',
  Ended: 'chip chip-plain',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-plain'
};

export const REVISION_CHIP: Record<RevisionStatus, string> = {
  Pending: 'chip chip-amber',
  Applied: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-plain'
};

export const BONUS_CHIP: Record<BonusStatus, string> = {
  Pending: 'chip chip-amber',
  Approved: 'chip chip-brass',
  Paid: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-plain'
};

/** Employee ka mahana hissa + dependents ke saath employer ka kharcha (server ka EmployerCostFor jaisa). */
export const employerCostFor = (p: BenefitPlan, dependents: number) => p.employerMonthlyCost + p.dependentMonthlyCost * dependents;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Increment batch: hourly ke ilawa poore number tak (server jaisa). */
export const raised = (amount: number, percent: number, basis: SalaryBasis | null) => {
  const v = amount * (1 + percent / 100);
  return basis === 'Hourly' ? round2(v) : Math.round(v);
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const firstOfNextMonth = () => {
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
};
