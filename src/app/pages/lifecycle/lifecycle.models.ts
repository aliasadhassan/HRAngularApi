/** HR.Employee.API Application/Lifecycle DTOs (enums JSON mein string). */
export type LifecycleKind = 'Onboarding' | 'Exit';
export type TaskOwner = 'Hr' | 'Manager' | 'It' | 'Finance' | 'Employee' | 'Admin';
export type CaseStatus = 'InProgress' | 'Completed' | 'Cancelled';
export type TaskStatus = 'Open' | 'Done' | 'Skipped';
export type ExitType = 'Resignation' | 'Termination' | 'EndOfContract' | 'Retirement' | 'Other';
export type EmploymentStatus = 'Active' | 'Probation' | 'OnNotice' | 'Suspended' | 'Exited';

export const OWNERS: readonly TaskOwner[] = ['Hr', 'Manager', 'It', 'Finance', 'Employee', 'Admin'];
export const EXIT_TYPES: readonly ExitType[] = ['Resignation', 'Termination', 'EndOfContract', 'Retirement', 'Other'];

export interface LifecycleSummary {
  onboardingOpen: number;
  exitsOpen: number;
  overdueTasks: number;
  dueThisWeek: number;
  joinersWithoutChecklist: number;
  closedThisMonth: number;
}

export interface CaseListItem {
  id: string;
  kind: LifecycleKind;
  status: CaseStatus;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationTitle: string | null;
  anchorDate: string;
  exitType: ExitType | null;
  totalTasks: number;
  closedTasks: number;
  openRequired: number;
  overdueTasks: number;
  nextDue: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface LifecycleTask {
  id: string;
  title: string;
  description: string | null;
  owner: TaskOwner;
  assigneeEmployeeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  isRequired: boolean;
  sortOrder: number;
  status: TaskStatus;
  note: string | null;
  completedAt: string | null;
}

export interface LifecycleCase {
  id: string;
  kind: LifecycleKind;
  status: CaseStatus;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationTitle: string | null;
  managerName: string | null;
  workEmail: string;
  employmentStatus: EmploymentStatus;
  joiningDate: string;
  anchorDate: string;
  templateId: string | null;
  templateName: string | null;
  exitType: ExitType | null;
  noticeDate: string | null;
  reason: string | null;
  eligibleForRehire: boolean | null;
  interviewNotes: string | null;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  tasks: LifecycleTask[];
}

export interface MyTask {
  taskId: string;
  caseId: string;
  kind: LifecycleKind;
  employeeId: string;
  employeeName: string;
  isSelf: boolean;
  title: string;
  description: string | null;
  owner: TaskOwner;
  dueDate: string | null;
  isRequired: boolean;
}

export interface Candidate {
  id: string;
  employeeCode: string;
  name: string;
  departmentName: string | null;
  joiningDate: string;
  status: EmploymentStatus;
}

export interface TemplateTask {
  id?: string;
  title: string;
  description: string | null;
  owner: TaskOwner;
  dueOffsetDays: number;
  isRequired: boolean;
}

export interface ChecklistTemplate {
  id: string;
  kind: LifecycleKind;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  inUse: number;
  tasks: TemplateTask[];
}

export interface TaskBody {
  title: string;
  description: string | null;
  owner: TaskOwner;
  assigneeEmployeeId: string | null;
  dueDate: string | null;
  isRequired: boolean;
}

export const CASE_CHIP: Record<CaseStatus, string> = {
  InProgress: 'chip chip-amber',
  Completed: 'chip chip-moss',
  Cancelled: 'chip chip-muted'
};

export const OWNER_ICON: Record<TaskOwner, string> = {
  Hr: 'badge',
  Manager: 'supervisor_account',
  It: 'computer',
  Finance: 'payments',
  Employee: 'person',
  Admin: 'meeting_room'
};

/** Aaj ki local date "2026-10-07" (DateOnly) */
export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
