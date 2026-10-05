/** HR.Payroll.API Application/Loans DTOs (enums JSON mein string). */
export type LoanType = 'Loan' | 'SalaryAdvance';
export type LoanStatus = 'Active' | 'Paused' | 'Closed' | 'Cancelled';
export type LoanRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type LoanAction = 'pause' | 'resume' | 'cancel';

export const LOAN_TYPES: readonly LoanType[] = ['Loan', 'SalaryAdvance'];

export interface Loan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  loanType: LoanType;
  currencyCode: string;
  principalAmount: number;
  installmentAmount: number;
  outstandingAmount: number;
  repaidAmount: number;
  installmentsLeft: number;
  startDate: string;
  status: LoanStatus;
  deductionComponentId: string;
  deductionComponentName: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface LoanRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  loanType: LoanType;
  currencyCode: string;
  requestedAmount: number;
  requestedInstallments: number;
  suggestedInstallment: number;
  preferredStartDate: string;
  reason: string;
  status: LoanRequestStatus;
  approvedAmount: number | null;
  approvedInstallmentAmount: number | null;
  employeeLoanId: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
  canCancel: boolean;
}

export interface LoanRepayment {
  id: string;
  employeeLoanId: string;
  employeeId: string;
  employeeName: string;
  loanType: LoanType;
  payslipId: string;
  payslipNumber: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currencyCode: string;
  createdAt: string;
}

export interface LoanLimit {
  loanType: LoanType;
  enabled: boolean;
  eligible: boolean;
  notEligibleReason: string | null;
  maxAmount: number | null;
  maxInstallments: number;
}

export interface MyLoans {
  employeeId: string | null;
  currencyCode: string | null;
  monthlyGross: number | null;
  limits: LoanLimit[];
  loans: Loan[];
  requests: LoanRequest[];
}

export interface LoanPolicy {
  loansEnabled: boolean;
  maxLoanAmount: number | null;
  maxLoanSalaryMultiple: number | null;
  maxLoanInstallments: number;
  minServiceMonths: number;
  advancesEnabled: boolean;
  maxAdvancePercent: number;
  maxAdvanceInstallments: number;
  allowMultipleActive: boolean;
  loanDeductionComponentId: string | null;
  advanceDeductionComponentId: string | null;
}

export const LOAN_STATUS_CHIP: Record<LoanStatus, string> = {
  Active: 'chip chip-moss',
  Paused: 'chip chip-amber',
  Closed: 'chip chip-muted',
  Cancelled: 'chip chip-oxblood'
};

export const REQUEST_STATUS_CHIP: Record<LoanRequestStatus, string> = {
  Pending: 'chip chip-amber',
  Approved: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-muted'
};
