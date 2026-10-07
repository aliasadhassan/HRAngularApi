/** HR.Payroll.API Application/Expenses DTOs (enums JSON mein string). */
export type ClaimStatus = 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled' | 'Paid';
export type TravelStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type AdvanceStatus = 'None' | 'Approved' | 'Paid' | 'Settled';
export type PayoutMethod = 'Payroll' | 'Direct';
export type TravelMode = 'Air' | 'Rail' | 'Road' | 'Other';

export const TRAVEL_MODES: readonly TravelMode[] = ['Air', 'Rail', 'Road', 'Other'];

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  maxPerClaim: number | null;
  receiptRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ExpenseLine {
  id: string;
  categoryId: string;
  categoryName: string;
  expenseDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  receiptNumber: string | null;
  hasReceipt: boolean;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  title: string;
  travelRequestId: string | null;
  travelDestination: string | null;
  currencyCode: string;
  totalAmount: number;
  status: ClaimStatus;
  approvedAmount: number | null;
  advanceAdjusted: number;
  netPayable: number;
  toRecover: number;
  payoutMethod: PayoutMethod | null;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  paidAt: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
  canCancel: boolean;
  lines: ExpenseLine[];
}

export interface TravelRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  purpose: string;
  destination: string;
  departDate: string;
  returnDate: string;
  travelMode: TravelMode;
  currencyCode: string;
  estimatedCost: number;
  advanceRequested: number;
  status: TravelStatus;
  advanceApproved: number;
  advanceStatus: AdvanceStatus;
  advancePayoutMethod: PayoutMethod | null;
  advancePaidAt: string | null;
  claimId: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
  canCancel: boolean;
  canClaim: boolean;
}

export interface ExpensePolicy {
  claimsEnabled: boolean;
  travelEnabled: boolean;
  receiptRequiredAbove: number | null;
  submitWithinDays: number;
  advancesEnabled: boolean;
  maxAdvancePercent: number;
  reimbursementComponentId: string | null;
  advanceRecoveryComponentId: string | null;
}

export interface MyExpenses {
  employeeId: string | null;
  currencyCode: string | null;
  policy: ExpensePolicy;
  categories: ExpenseCategory[];
  claims: ExpenseClaim[];
  travel: TravelRequest[];
}

export interface LineForm {
  categoryId: string;
  expenseDate: string;
  description: string;
  merchant: string;
  amount: number | null;
  receiptNumber: string;
  hasReceipt: boolean;
}

export const CLAIM_CHIP: Record<ClaimStatus, string> = {
  Submitted: 'chip chip-amber',
  Approved: 'chip chip-ink',
  Paid: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-muted'
};

export const TRAVEL_CHIP: Record<TravelStatus, string> = {
  Pending: 'chip chip-amber',
  Approved: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-muted'
};

export const ADVANCE_CHIP: Record<AdvanceStatus, string> = {
  None: 'chip chip-neutral',
  Approved: 'chip chip-amber',
  Paid: 'chip chip-ink',
  Settled: 'chip chip-moss'
};
