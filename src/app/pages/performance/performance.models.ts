/** HR.Employee.API Application/Performance DTOs (enums JSON mein string). */
export type CycleStatus = 'Draft' | 'Active' | 'Closed';
export type ReviewStatus = 'SelfReview' | 'ManagerReview' | 'Shared' | 'Acknowledged';
export type GoalStatus = 'NotStarted' | 'OnTrack' | 'AtRisk' | 'OffTrack' | 'Completed' | 'Cancelled';

export const REVIEW_STATUSES: readonly ReviewStatus[] = ['SelfReview', 'ManagerReview', 'Shared', 'Acknowledged'];
export const GOAL_STATUSES: readonly GoalStatus[] = ['NotStarted', 'OnTrack', 'AtRisk', 'OffTrack', 'Completed', 'Cancelled'];
/** Check-in mein chun sakte hain (Cancelled alag button, Completed = 100%) */
export const CHECKIN_STATUSES: readonly GoalStatus[] = ['NotStarted', 'OnTrack', 'AtRisk', 'OffTrack', 'Completed'];
export const RATINGS: readonly number[] = [1, 2, 3, 4, 5];

export interface PerformanceSummary {
  activeCycleId: string | null;
  activeCycleName: string | null;
  selfReviewDue: string | null;
  managerReviewDue: string | null;
  reviews: number;
  selfPending: number;
  managerPending: number;
  shared: number;
  acknowledged: number;
  overdueReviews: number;
  averageRating: number | null;
  goalsOpen: number;
  goalsAtRisk: number;
  goalsCompleted: number;
  goalsOverdue: number;
  myActions: number;
  canManage: boolean;
}

export interface ReviewCycle {
  id: string;
  name: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  includeSelfReview: boolean;
  selfReviewDue: string | null;
  managerReviewDue: string;
  status: CycleStatus;
  launchedAt: string | null;
  closedAt: string | null;
  reviews: number;
  selfPending: number;
  managerPending: number;
  shared: number;
  acknowledged: number;
  averageRating: number | null;
  ratingCounts: number[];
  rowVersion: number;
}

export interface ReviewListItem {
  id: string;
  cycleId: string;
  cycleName: string;
  cycleStatus: CycleStatus;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationTitle: string | null;
  reviewerEmployeeId: string | null;
  reviewerName: string | null;
  status: ReviewStatus;
  selfRating: number | null;
  managerRating: number | null;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  acknowledgedAt: string | null;
  dueOn: string | null;
  isOverdue: boolean;
}

export interface GoalListItem {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  cycleId: string | null;
  cycleName: string | null;
  title: string;
  description: string | null;
  weight: number | null;
  startDate: string | null;
  dueDate: string;
  progress: number;
  status: GoalStatus;
  completedAt: string | null;
  lastCheckInAt: string | null;
  isOverdue: boolean;
  canEdit: boolean;
}

export interface GoalCheckIn {
  id: string;
  progress: number;
  status: GoalStatus;
  note: string | null;
  byName: string | null;
  at: string;
}

export interface GoalDetail {
  goal: GoalListItem;
  checkIns: GoalCheckIn[];
  rowVersion: number;
}

export interface Review {
  id: string;
  cycleId: string;
  cycleName: string;
  cycleStatus: CycleStatus;
  periodStart: string;
  periodEnd: string;
  includeSelfReview: boolean;
  selfReviewDue: string | null;
  managerReviewDue: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  designationTitle: string | null;
  reviewerEmployeeId: string | null;
  reviewerName: string | null;
  status: ReviewStatus;
  selfRating: number | null;
  selfSummary: string | null;
  selfSubmittedAt: string | null;
  managerRating: number | null;
  managerSummary: string | null;
  strengths: string | null;
  improvements: string | null;
  managerSubmittedAt: string | null;
  managerSubmittedByName: string | null;
  employeeComment: string | null;
  acknowledgedAt: string | null;
  dueOn: string | null;
  isOverdue: boolean;
  isSelf: boolean;
  canEditSelf: boolean;
  canEditManager: boolean;
  canManage: boolean;
  canAcknowledge: boolean;
  goals: GoalListItem[];
}

export interface MyPerformance {
  linked: boolean;
  reviews: ReviewListItem[];
  goals: GoalListItem[];
  toReview: ReviewListItem[];
}

export interface PerformancePerson {
  id: string;
  employeeCode: string;
  name: string;
  departmentName: string | null;
  isSelf: boolean;
}

export interface CycleBody {
  name: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  includeSelfReview: boolean;
  selfReviewDue: string | null;
  managerReviewDue: string;
}

export interface GoalBody {
  employeeId: string;
  title: string;
  description: string | null;
  cycleId: string | null;
  weight: number | null;
  startDate: string | null;
  dueDate: string;
}

export const REVIEW_CHIP: Record<ReviewStatus, string> = {
  SelfReview: 'chip chip-amber',
  ManagerReview: 'chip chip-ink',
  Shared: 'chip chip-brass',
  Acknowledged: 'chip chip-moss'
};

export const GOAL_CHIP: Record<GoalStatus, string> = {
  NotStarted: 'chip chip-plain',
  OnTrack: 'chip chip-moss',
  AtRisk: 'chip chip-amber',
  OffTrack: 'chip chip-oxblood',
  Completed: 'chip chip-ink',
  Cancelled: 'chip chip-muted'
};

export const CYCLE_CHIP: Record<CycleStatus, string> = {
  Draft: 'chip chip-plain',
  Active: 'chip chip-moss',
  Closed: 'chip chip-ink'
};

export const isClosedGoal = (s: GoalStatus): boolean => s === 'Completed' || s === 'Cancelled';
