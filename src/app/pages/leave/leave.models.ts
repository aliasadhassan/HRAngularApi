export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type ApproverType = 'LineManager' | 'DepartmentHead' | 'HR';
export type Decision = 'Pending' | 'Approved' | 'Rejected' | 'Skipped';
export type HalfDayPeriod = 'FirstHalf' | 'SecondHalf';
export type AccrualMethod = 'Upfront' | 'Monthly';
export type LeaveScope = 'Mine' | 'Approvals' | 'All';

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  code: string;
  color: string | null;
  isPaid: boolean;
  allowHalfDay: boolean;
  year: number;
  entitled: number;
  carriedForward: number;
  adjusted: number;
  used: number;
  pending: number;
  available: number;
}

export interface ApprovalStep {
  level: number;
  approverType: ApproverType;
  approverName: string | null;
  decision: Decision;
  decidedByName: string | null;
  decidedAt: string | null;
  comment: string | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  color: string | null;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod: HalfDayPeriod | null;
  totalDays: number;
  reason: string | null;
  status: LeaveStatus;
  currentApprovalLevel: number;
  createdAt: string;
  canApprove: boolean;
  canCancel: boolean;
  approvals: ApprovalStep[];
}

export interface MyLeave {
  employeeId: string;
  year: number;
  balances: LeaveBalance[];
  requests: LeaveRequest[];
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  color: string | null;
  isPaid: boolean;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
  allowNegativeBalance: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  locationId: string | null;
  locationName: string | null;
  isOptional: boolean;
}

export interface PolicyRule {
  leaveTypeId: string;
  leaveTypeName?: string;
  annualEntitlement: number;
  accrualMethod: AccrualMethod;
  maxCarryForward: number;
  carryForwardExpiryMonths: number | null;
  minServiceDays: number;
  maxConsecutiveDays: number | null;
  applicableGender: 'Male' | 'Female' | 'Other' | null;
  applicableEmploymentTypes: string | null;
}

export interface LeavePolicy {
  id: string;
  name: string;
  locationId: string | null;
  locationName: string | null;
  effectiveFrom: string;
  isActive: boolean;
  rules: PolicyRule[];
}

export interface ApprovalSettings {
  level1Approver: ApproverType;
  level2Approver: ApproverType | null;
  autoApproveAfterDays: number | null;
  allowCancelAfterApproval: boolean;
}

export const LEAVE_STATUS_CHIP: Record<LeaveStatus, string> = {
  Pending: 'chip chip-amber',
  Approved: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-muted'
};
