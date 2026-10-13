import { utc } from '../admin/admin.models';

/** Employee API /api/safety — Health & safety page. Enums JSON mein string aate hain. */

export type IncidentType = 'Injury' | 'NearMiss' | 'Illness' | 'PropertyDamage' | 'Hazard' | 'Environmental' | 'Vehicle' | 'Other';
export type SafetySeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Reported' | 'Investigating' | 'ActionPending' | 'Closed';
export type IncidentTreatment = 'None' | 'FirstAid' | 'MedicalTreatment' | 'Hospitalised' | 'Fatal';
export type RootCauseCategory = 'UnsafeAct' | 'UnsafeCondition' | 'Equipment' | 'Training' | 'Procedure' | 'Environment' | 'Other';
export type IncidentEntryKind =
  | 'Created' | 'Note' | 'StatusChanged' | 'Updated' | 'InvestigatorChanged' | 'ActionAdded' | 'ActionCompleted'
  | 'AuthorityNotified' | 'Closed' | 'Reopened';
export type ActionStatus = 'Open' | 'InProgress' | 'Done' | 'Verified' | 'Cancelled';
export type InspectionStatus = 'Scheduled' | 'Completed' | 'Cancelled';
export type InspectionResult = 'Pass' | 'Fail' | 'NotApplicable';

export type IncidentScope = 'open' | 'all' | 'mine' | 'reportable';
export type ActionScope = 'open' | 'mine' | 'overdue' | 'verify' | 'all';
export type InspectionScope = 'upcoming' | 'mine' | 'overdue' | 'completed' | 'all';

export const INCIDENT_TYPES: readonly IncidentType[] =
  ['Injury', 'NearMiss', 'Illness', 'PropertyDamage', 'Hazard', 'Environmental', 'Vehicle', 'Other'];
export const SEVERITIES: readonly SafetySeverity[] = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES: readonly IncidentStatus[] = ['Reported', 'Investigating', 'ActionPending', 'Closed'];
export const TREATMENTS: readonly IncidentTreatment[] = ['None', 'FirstAid', 'MedicalTreatment', 'Hospitalised', 'Fatal'];
export const ROOT_CAUSES: readonly RootCauseCategory[] =
  ['UnsafeAct', 'UnsafeCondition', 'Equipment', 'Training', 'Procedure', 'Environment', 'Other'];
export const INCIDENT_SCOPES: readonly IncidentScope[] = ['open', 'mine', 'reportable', 'all'];
export const ACTION_SCOPES: readonly ActionScope[] = ['open', 'mine', 'overdue', 'verify', 'all'];
export const INSPECTION_SCOPES: readonly InspectionScope[] = ['upcoming', 'mine', 'overdue', 'completed', 'all'];
export const RESULTS: readonly InspectionResult[] = ['Pass', 'Fail', 'NotApplicable'];
/** Inke liye shakhs (jisay chot lagi / bimar hua) zaroori. */
export const NEEDS_PERSON: readonly IncidentType[] = ['Injury', 'Illness'];
export const MAX_LOST_DAYS = 999;
export const MAX_ITEMS = 60;

export const STATUS_CHIP: Record<IncidentStatus, string> = {
  Reported: 'chip chip-amber', Investigating: 'chip chip-ink', ActionPending: 'chip chip-brass', Closed: 'chip chip-moss'
};
export const SEVERITY_CHIP: Record<SafetySeverity, string> = {
  Low: 'chip chip-plain', Medium: 'chip chip-neutral', High: 'chip chip-amber', Critical: 'chip chip-oxblood'
};
export const ACTION_CHIP: Record<ActionStatus, string> = {
  Open: 'chip chip-amber', InProgress: 'chip chip-ink', Done: 'chip chip-brass', Verified: 'chip chip-moss', Cancelled: 'chip chip-plain'
};
export const INSPECTION_CHIP: Record<InspectionStatus, string> = {
  Scheduled: 'chip chip-ink', Completed: 'chip chip-moss', Cancelled: 'chip chip-plain'
};
export const TYPE_ICON: Record<IncidentType, string> = {
  Injury: 'personal_injury', NearMiss: 'warning_amber', Illness: 'sick', PropertyDamage: 'broken_image', Hazard: 'report_problem',
  Environmental: 'eco', Vehicle: 'local_shipping', Other: 'help_outline'
};
export const ENTRY_ICON: Partial<Record<IncidentEntryKind, string>> = {
  Created: 'flag', StatusChanged: 'double_arrow', Updated: 'edit', InvestigatorChanged: 'badge', ActionAdded: 'playlist_add',
  ActionCompleted: 'playlist_add_check', AuthorityNotified: 'account_balance', Closed: 'task_alt', Reopened: 'restart_alt'
};
export const RESULT_ICON: Record<InspectionResult, string> = { Pass: 'check_circle', Fail: 'cancel', NotApplicable: 'remove_circle_outline' };

export interface SafetyMonth { month: string; incidents: number; nearMisses: number; }
export interface SafetyCount { key: number; count: number; }

export interface SafetySummary {
  daysSinceLostTime: number | null;
  lastLostTimeAt: string | null;
  openIncidents: number;
  reportedLast30: number;
  lostTimeYtd: number;
  lostDaysYtd: number;
  recordableYtd: number;
  nearMissYtd: number;
  reportablePending: number;
  openActions: number;
  overdueActions: number;
  actionsDueSoon: number;
  actionsToVerify: number;
  inspectionsDue: number;
  overdueInspections: number;
  averageScore90: number | null;
  byMonth: SafetyMonth[];
  byType: SafetyCount[];
  myOpenActions: number;
  myOverdueActions: number;
  myInspectionsDue: number;
  myReportsOpen: number;
  myInvestigations: number;
  canManage: boolean;
  hasChecklists: boolean;
  myEmployeeId: string | null;
}

export interface SafetyOption { id: string; name: string; extra: string | null; }
export interface ChecklistOption { id: string; name: string; itemCount: number; isActive: boolean; }

export interface SafetyLookups {
  people: SafetyOption[];
  departments: SafetyOption[];
  locations: SafetyOption[];
  checklists: ChecklistOption[];
}

export interface IncidentListItem {
  id: string;
  code: string;
  title: string;
  type: IncidentType;
  severity: SafetySeverity;
  status: IncidentStatus;
  occurredAt: string;
  locationName: string | null;
  area: string | null;
  departmentName: string | null;
  reporterName: string | null;
  anonymous: boolean;
  affectedName: string | null;
  treatment: IncidentTreatment | null;
  lostDays: number;
  isReportable: boolean;
  authorityNotifiedOn: string | null;
  investigatorEmployeeId: string | null;
  investigatorName: string | null;
  openActions: number;
  overdueActions: number;
  closedAt: string | null;
  lastActivityAt: string;
  isMine: boolean;
}

export interface IncidentEntry {
  id: string;
  kind: IncidentEntryKind;
  text: string | null;
  byName: string | null;
  byMe: boolean;
  at: string;
}

export interface SafetyAction {
  id: string;
  title: string;
  description: string | null;
  incidentId: string | null;
  incidentCode: string | null;
  inspectionId: string | null;
  inspectionCode: string | null;
  assigneeEmployeeId: string;
  assigneeName: string;
  priority: SafetySeverity;
  dueOn: string;
  daysLeft: number;
  isOverdue: boolean;
  status: ActionStatus;
  completedAt: string | null;
  completionNote: string | null;
  verifiedAt: string | null;
  createdAt: string;
  isMine: boolean;
  canUpdate: boolean;
  canProgress: boolean;
  canVerify: boolean;
}

export interface IncidentDetail {
  incident: IncidentListItem;
  description: string | null;
  locationId: string | null;
  departmentId: string | null;
  affectedEmployeeId: string | null;
  injuryNature: string | null;
  bodyPart: string | null;
  witnesses: string | null;
  immediateAction: string | null;
  rootCauseCategory: RootCauseCategory | null;
  rootCause: string | null;
  authorityReference: string | null;
  closureNote: string | null;
  reportedAt: string;
  entries: IncidentEntry[];
  actions: SafetyAction[];
  canEdit: boolean;
  canWork: boolean;
  canClose: boolean;
  canReopen: boolean;
}

export interface MyReport {
  id: string;
  code: string;
  title: string;
  type: IncidentType;
  status: IncidentStatus;
  occurredAt: string;
  reportedAt: string;
  anonymous: boolean;
  closedAt: string | null;
  lastActivityAt: string;
}

export interface MyReportUpdate { id: string; kind: IncidentEntryKind; text: string | null; at: string; }

export interface MyReportDetail {
  report: MyReport;
  description: string | null;
  locationName: string | null;
  area: string | null;
  closureNote: string | null;
  updates: MyReportUpdate[];
}

export interface SafetyChecklist {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items: string[];
  inspections: number;
}

export interface InspectionListItem {
  id: string;
  code: string;
  title: string;
  checklistId: string | null;
  checklistName: string | null;
  locationName: string | null;
  area: string | null;
  inspectorEmployeeId: string;
  inspectorName: string;
  dueOn: string;
  daysLeft: number;
  isOverdue: boolean;
  repeatDays: number | null;
  status: InspectionStatus;
  completedAt: string | null;
  scorePercent: number | null;
  itemCount: number;
  failed: number;
  openActions: number;
  isMine: boolean;
}

export interface InspectionLine { id: string; sortOrder: number; text: string; result: InspectionResult | null; note: string | null; }

export interface InspectionDetail {
  inspection: InspectionListItem;
  locationId: string | null;
  notes: string | null;
  lines: InspectionLine[];
  actions: SafetyAction[];
  canComplete: boolean;
  canEdit: boolean;
}

export interface IncidentBody {
  title: string;
  description: string | null;
  type: IncidentType;
  severity: SafetySeverity;
  occurredAt: string;
  locationId: string | null;
  area: string | null;
  departmentId: string | null;
  affectedEmployeeId: string | null;
  affectedName: string | null;
  treatment: IncidentTreatment | null;
  injuryNature: string | null;
  bodyPart: string | null;
  lostDays: number;
  witnesses: string | null;
  immediateAction: string | null;
  isReportable: boolean;
  reporterEmployeeId?: string | null;
  investigatorEmployeeId?: string | null;
}

export interface ReportBody {
  title: string;
  description: string | null;
  type: IncidentType;
  severity: SafetySeverity;
  occurredAt: string;
  locationId: string | null;
  area: string | null;
  affectedEmployeeId: string | null;
  affectedName: string | null;
  injuryNature: string | null;
  bodyPart: string | null;
  witnesses: string | null;
  immediateAction: string | null;
  anonymous: boolean;
}

export interface ActionBody {
  title: string;
  description: string | null;
  assigneeEmployeeId: string;
  priority: SafetySeverity;
  dueOn: string;
  incidentId?: string | null;
  inspectionId?: string | null;
}

export interface ChecklistBody { name: string; description: string | null; isActive: boolean; items: string[]; }

export interface InspectionBody {
  title: string;
  checklistId: string;
  inspectorEmployeeId: string;
  locationId: string | null;
  area: string | null;
  dueOn: string;
  repeatDays: number | null;
}

export interface FailedLineAction { assigneeEmployeeId: string; priority: SafetySeverity; dueOn: string; title: string | null; }
export interface InspectionAnswer { lineId: string; result: InspectionResult; note: string | null; action: FailedLineAction | null; }
export interface CompleteResult { actionsCreated: number; nextInspectionId: string | null; nextInspectionCode: string | null; nextDueOn: string | null; }

export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';

/** <input type="datetime-local"> ki value (local) → UTC ISO; aur ulta. */
export const localToIso = (v: string): string => new Date(v).toISOString();
export const isoToLocal = (iso: string): string => {
  const d = utc(iso)!;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
