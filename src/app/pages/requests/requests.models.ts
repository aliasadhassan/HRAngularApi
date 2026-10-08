/** Employee API /api/helpdesk — Requests & helpdesk page. Enums JSON mein string aate hain. */

export type TicketStatus =
  | 'PendingApproval' | 'Open' | 'InProgress' | 'WaitingOnEmployee' | 'Resolved' | 'Closed' | 'Rejected' | 'Cancelled';
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type ActivityKind = 'Created' | 'Comment' | 'InternalNote' | 'Status' | 'Assigned' | 'Approved' | 'Rejected' | 'Rated';
export type TicketScope = 'Mine' | 'Approvals' | 'Queue';

export const STATUSES: readonly TicketStatus[] =
  ['PendingApproval', 'Open', 'InProgress', 'WaitingOnEmployee', 'Resolved', 'Closed', 'Rejected', 'Cancelled'];
export const PRIORITIES: readonly TicketPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
export const RATINGS: readonly number[] = [1, 2, 3, 4, 5];

export interface HelpdeskSummary {
  myActive: number;
  myResolved: number;
  awaitingMyApproval: number;
  queueOpen: number;
  unassigned: number;
  assignedToMe: number;
  overdue: number;
  resolvedLast30: number;
  averageResolutionHours: number | null;
  satisfaction: number | null;
  isAgent: boolean;
  canViewQueue: boolean;
  canConfigure: boolean;
  hasCategories: boolean;
  myEmployeeId: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  needsManagerApproval: boolean;
  isConfidential: boolean;
  resolutionHours: number | null;
  defaultAssigneeEmployeeId: string | null;
  defaultAssigneeName: string | null;
  sortOrder: number;
  isActive: boolean;
  openTickets: number;
  totalTickets: number;
  rowVersion: number;
}

export interface Option {
  id: string;
  name: string;
  extra: string | null;
}

export interface Lookups {
  categories: Category[];
  people: Option[];
}

export interface TicketListItem {
  id: string;
  code: string;
  subject: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  priority: TicketPriority;
  status: TicketStatus;
  isConfidential: boolean;
  assigneeEmployeeId: string | null;
  assigneeName: string | null;
  approverEmployeeId: string | null;
  approverName: string | null;
  createdAt: string;
  lastActivityAt: string;
  dueAt: string | null;
  isOverdue: boolean;
  resolvedAt: string | null;
  satisfactionRating: number | null;
}

export interface Activity {
  id: string;
  kind: ActivityKind;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  note: string | null;
  byName: string | null;
  byMe: boolean;
  at: string;
}

export interface Ticket {
  ticket: TicketListItem;
  description: string | null;
  link: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  openedAt: string | null;
  firstResponseAt: string | null;
  resolution: string | null;
  closedAt: string | null;
  activities: Activity[];
  isRequester: boolean;
  canEdit: boolean;
  canComment: boolean;
  canInternalNote: boolean;
  canApprove: boolean;
  canWork: boolean;
  canAssign: boolean;
  canConfirm: boolean;
  canReopen: boolean;
  canCancel: boolean;
  canRate: boolean;
  rowVersion: number;
}

export interface TicketBody {
  categoryId: string;
  subject: string;
  description: string | null;
  link: string | null;
  priority: TicketPriority;
  employeeId: string | null;
}

export interface CategoryBody {
  name: string;
  description: string | null;
  icon: string | null;
  needsManagerApproval: boolean;
  isConfidential: boolean;
  resolutionHours: number | null;
  defaultAssigneeEmployeeId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface TicketFilter {
  scope: TicketScope;
  status: TicketStatus | '';
  active: boolean;
  categoryId: string;
  assignee: string;
  search: string;
}

export const STATUS_CHIP: Record<TicketStatus, string> = {
  PendingApproval: 'chip chip-amber',
  Open: 'chip chip-brass',
  InProgress: 'chip chip-ink',
  WaitingOnEmployee: 'chip chip-amber',
  Resolved: 'chip chip-moss',
  Closed: 'chip chip-plain',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-plain'
};

export const PRIORITY_CHIP: Record<TicketPriority, string> = {
  Low: 'prio prio-low',
  Normal: 'prio prio-normal',
  High: 'prio prio-high',
  Urgent: 'prio prio-urgent'
};

export const isFinal = (s: TicketStatus) => s === 'Closed' || s === 'Rejected' || s === 'Cancelled';
export const isActive = (s: TicketStatus) => s === 'Open' || s === 'InProgress' || s === 'WaitingOnEmployee';

export function isHttpLink(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isIconName(value: string): boolean {
  return !value.trim() || /^[a-z0-9_]+$/.test(value.trim());
}
