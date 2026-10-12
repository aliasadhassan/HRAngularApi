/** Employee API /api/relations — Employee relations page (confidential cases). Enums JSON mein string aate hain. */

export type CasePhase = 'Open' | 'Review' | 'Investigation' | 'Resolution' | 'Closed';
export type CaseType = 'Complaint' | 'Grievance' | 'Harassment' | 'Discrimination' | 'Misconduct' | 'Disciplinary' | 'Whistleblowing' | 'Other';
export type CaseSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type CaseConfidentiality = 'Standard' | 'Restricted';
export type CaseSource = 'Employee' | 'Hr' | 'Manager' | 'Hotline' | 'Other';
export type CaseMemberRole = 'Owner' | 'Investigator' | 'Viewer';
export type CasePartyRole = 'Complainant' | 'Respondent' | 'Witness' | 'Other';
export type CaseOutcome = 'Substantiated' | 'PartlySubstantiated' | 'NotSubstantiated' | 'ResolvedInformally' | 'Withdrawn';
export type CaseAction = 'None' | 'Coaching' | 'VerbalWarning' | 'WrittenWarning' | 'FinalWarning' | 'Suspension' | 'Termination' | 'Other';
export type CaseEntryKind =
  | 'Created' | 'Note' | 'Message' | 'ReporterMessage' | 'StageChanged' | 'MemberAdded' | 'MemberRemoved' | 'OwnerChanged'
  | 'PartyAdded' | 'PartyRemoved' | 'EvidenceAdded' | 'EvidenceRemoved' | 'DeadlineChanged' | 'Escalated' | 'Closed' | 'Reopened'
  | 'BreakGlass' | 'Updated';
export type CaseAccessAction = 'Viewed' | 'BreakGlass' | 'ViewedAccessLog';
export type CaseView = 'None' | 'Masked' | 'Team' | 'Viewer' | 'Investigator' | 'Owner';
export type CaseScope = 'all' | 'mine' | 'unassigned' | 'overdue' | 'escalated';

export const PHASES: readonly CasePhase[] = ['Open', 'Review', 'Investigation', 'Resolution', 'Closed'];
export const CASE_TYPES: readonly CaseType[] =
  ['Complaint', 'Grievance', 'Harassment', 'Discrimination', 'Misconduct', 'Disciplinary', 'Whistleblowing', 'Other'];
/** Employee khud ye uthata hai (disciplinary HR shuru karta hai). */
export const CONCERN_TYPES: readonly CaseType[] =
  ['Complaint', 'Grievance', 'Harassment', 'Discrimination', 'Misconduct', 'Whistleblowing', 'Other'];
export const SEVERITIES: readonly CaseSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
export const SOURCES: readonly CaseSource[] = ['Employee', 'Hr', 'Manager', 'Hotline', 'Other'];
export const MEMBER_ROLES: readonly CaseMemberRole[] = ['Investigator', 'Viewer'];
export const PARTY_ROLES: readonly CasePartyRole[] = ['Complainant', 'Respondent', 'Witness', 'Other'];
export const OUTCOMES: readonly CaseOutcome[] = ['Substantiated', 'PartlySubstantiated', 'NotSubstantiated', 'ResolvedInformally', 'Withdrawn'];
export const ACTIONS: readonly CaseAction[] =
  ['None', 'Coaching', 'VerbalWarning', 'WrittenWarning', 'FinalWarning', 'Suspension', 'Termination', 'Other'];
export const SCOPES: readonly CaseScope[] = ['all', 'mine', 'unassigned', 'overdue', 'escalated'];
export const MAX_RESPONDENTS = 10;
export const MAX_ESCALATION = 3;

/** Ye types hamesha restricted (backend bhi yahi maanta hai). */
export const ALWAYS_RESTRICTED: readonly CaseType[] = ['Harassment', 'Whistleblowing'];
/** Self-service default: harassment/discrimination/whistleblowing restricted aur high. */
export const SENSITIVE: readonly CaseType[] = ['Harassment', 'Discrimination', 'Whistleblowing'];

export const PHASE_CHIP: Record<CasePhase, string> = {
  Open: 'chip chip-amber', Review: 'chip chip-plain', Investigation: 'chip chip-ink', Resolution: 'chip chip-brass', Closed: 'chip chip-moss'
};

export const SEVERITY_CHIP: Record<CaseSeverity, string> = {
  Low: 'chip chip-plain', Medium: 'chip chip-neutral', High: 'chip chip-amber', Critical: 'chip chip-oxblood'
};

export const TYPE_ICON: Record<CaseType, string> = {
  Complaint: 'report', Grievance: 'balance', Harassment: 'front_hand', Discrimination: 'diversity_3', Misconduct: 'rule',
  Disciplinary: 'gavel', Whistleblowing: 'campaign', Other: 'help_outline'
};

export const ENTRY_ICON: Partial<Record<CaseEntryKind, string>> = {
  Created: 'flag', StageChanged: 'double_arrow', MemberAdded: 'person_add', MemberRemoved: 'person_remove', OwnerChanged: 'badge',
  PartyAdded: 'group_add', PartyRemoved: 'group_remove', EvidenceAdded: 'attach_file', EvidenceRemoved: 'link_off',
  DeadlineChanged: 'event', Escalated: 'trending_up', Closed: 'task_alt', Reopened: 'restart_alt', BreakGlass: 'lock_open', Updated: 'edit'
};

export interface Count {
  key: number;
  count: number;
}

export interface Reminder {
  id: string;
  code: string;
  title: string;
  dueOn: string | null;
  daysLeft: number | null;
  role: CaseMemberRole;
  escalationLevel: number;
  stageName: string;
}

export interface RelationsSummary {
  open: number;
  unassigned: number;
  mine: number;
  overdue: number;
  dueSoon: number;
  escalated: number;
  closedLast90: number;
  averageDaysToClose: number | null;
  byPhase: Count[];
  byType: Count[];
  reminders: Reminder[];
  myConcernsOpen: number;
  myConcernsTotal: number;
  canManage: boolean;
  isAdmin: boolean;
  seesCases: boolean;
  hasStages: boolean;
  myEmployeeId: string | null;
}

export interface Stage {
  id: string;
  name: string;
  description: string | null;
  phase: CasePhase;
  sortOrder: number;
  targetDays: number | null;
  isActive: boolean;
  openCases: number;
  totalCases: number;
  rowVersion: number;
}

export interface Option {
  id: string;
  name: string;
  extra: string | null;
}

export interface Lookups {
  stages: Stage[];
  people: Option[];
}

export interface CaseListItem {
  id: string;
  code: string;
  title: string | null;
  type: CaseType;
  severity: CaseSeverity;
  confidentiality: CaseConfidentiality;
  source: CaseSource;
  stageId: string;
  stageName: string;
  phase: CasePhase;
  ownerEmployeeId: string | null;
  ownerName: string | null;
  reporterName: string | null;
  reporterHidden: boolean;
  respondents: string[];
  reportedOn: string;
  dueOn: string | null;
  daysLeft: number | null;
  isOverdue: boolean;
  escalationLevel: number;
  myRole: CaseMemberRole | null;
  masked: boolean;
  outcome: CaseOutcome | null;
  closedAt: string | null;
  lastActivityAt: string;
}

export interface CaseMember {
  employeeId: string;
  name: string;
  detail: string | null;
  role: CaseMemberRole;
  addedAt: string;
}

export interface CaseParty {
  id: string;
  employeeId: string | null;
  name: string;
  detail: string | null;
  role: CasePartyRole;
  note: string | null;
  addedAt: string;
}

export interface CaseEntry {
  id: string;
  kind: CaseEntryKind;
  text: string | null;
  shared: boolean;
  stageName: string | null;
  byName: string | null;
  byMe: boolean;
  byReporter: boolean;
  at: string;
}

export interface CaseEvidence {
  id: string;
  title: string;
  url: string;
  note: string | null;
  isRestricted: boolean;
  fromReporter: boolean;
  addedByName: string | null;
  addedAt: string;
}

export interface CaseDetail {
  case: CaseListItem;
  description: string | null;
  incidentOn: string | null;
  location: string | null;
  actionTaken: CaseAction | null;
  resolutionSummary: string | null;
  escalatedAt: string | null;
  reopenCount: number;
  createdAt: string;
  members: CaseMember[];
  parties: CaseParty[];
  entries: CaseEntry[];
  evidence: CaseEvidence[];
  hiddenEvidence: number;
  view: CaseView;
  canEdit: boolean;
  canWork: boolean;
  canManageTeam: boolean;
  canClose: boolean;
  canReopen: boolean;
  canTake: boolean;
  canBreakGlass: boolean;
  canSeeAccessLog: boolean;
  canRemoveEvidence: boolean;
  hasReporter: boolean;
  rowVersion: number;
}

export interface AccessLogItem {
  id: string;
  name: string | null;
  action: CaseAccessAction;
  note: string | null;
  at: string;
}

export interface ConcernListItem {
  id: string;
  code: string;
  title: string;
  type: CaseType;
  phase: CasePhase;
  stageName: string;
  reportedOn: string;
  reporterHidden: boolean;
  outcome: CaseOutcome | null;
  closedAt: string | null;
  lastActivityAt: string;
}

export interface ConcernDetail {
  concern: ConcernListItem;
  description: string | null;
  incidentOn: string | null;
  location: string | null;
  entries: CaseEntry[];
  evidence: CaseEvidence[];
  canMessage: boolean;
}

export interface PartyBody {
  employeeId: string | null;
  name: string | null;
  role: CasePartyRole;
  note: string | null;
}

export interface CreateCaseBody {
  title: string;
  description: string | null;
  type: CaseType;
  severity: CaseSeverity;
  confidentiality: CaseConfidentiality;
  source: CaseSource;
  reportedOn: string | null;
  incidentOn: string | null;
  location: string | null;
  reporterEmployeeId: string | null;
  ownerEmployeeId: string | null;
  dueOn: string | null;
  parties: PartyBody[];
}

export interface UpdateCaseBody {
  title: string;
  description: string | null;
  type: CaseType;
  severity: CaseSeverity;
  confidentiality: CaseConfidentiality;
  incidentOn: string | null;
  location: string | null;
}

export interface ConcernBody {
  type: CaseType;
  title: string;
  description: string;
  incidentOn: string | null;
  location: string | null;
  respondentIds: string[];
  hideIdentity: boolean;
  evidenceTitle: string | null;
  evidenceUrl: string | null;
}

export interface StageBody {
  name: string;
  description: string | null;
  phase: CasePhase;
  sortOrder: number;
  targetDays: number | null;
  isActive: boolean;
}

/** Naam se do huroof (avatar). */
export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');

export const isHttpUrl = (v: string): boolean => /^https?:\/\/\S+$/i.test(v.trim());
