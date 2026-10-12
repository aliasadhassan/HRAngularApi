/** Employee API /api/compliance — Policies & compliance page. Enums JSON mein string aate hain. */

export type PolicyStatus = 'Draft' | 'Published' | 'Archived';
export type PolicyCategory = 'General' | 'Conduct' | 'Workplace' | 'TimeOff' | 'Pay' | 'Security' | 'HealthSafety' | 'Legal';
export type AckState = 'NotRequired' | 'Pending' | 'Overdue' | 'Done';
export type ObligationCategory = 'Tax' | 'SocialSecurity' | 'Labour' | 'Licence' | 'Reporting' | 'Other';
export type ObligationFrequency = 'Once' | 'Monthly' | 'Quarterly' | 'HalfYearly' | 'Annually';
export type ObligationState = 'Upcoming' | 'DueSoon' | 'Overdue' | 'Completed' | 'Paused';

export const POLICY_CATEGORIES: readonly PolicyCategory[] =
  ['General', 'Conduct', 'Workplace', 'TimeOff', 'Pay', 'Security', 'HealthSafety', 'Legal'];
export const POLICY_STATUSES: readonly PolicyStatus[] = ['Draft', 'Published', 'Archived'];
export const OBLIGATION_CATEGORIES: readonly ObligationCategory[] = ['Tax', 'SocialSecurity', 'Labour', 'Licence', 'Reporting', 'Other'];
export const FREQUENCIES: readonly ObligationFrequency[] = ['Once', 'Monthly', 'Quarterly', 'HalfYearly', 'Annually'];

export const CATEGORY_ICON: Record<PolicyCategory, string> = {
  General: 'policy', Conduct: 'handshake', Workplace: 'apartment', TimeOff: 'beach_access', Pay: 'payments',
  Security: 'security', HealthSafety: 'health_and_safety', Legal: 'gavel'
};

export const OBLIGATION_ICON: Record<ObligationCategory, string> = {
  Tax: 'request_quote', SocialSecurity: 'groups', Labour: 'engineering', Licence: 'verified', Reporting: 'summarize', Other: 'event_note'
};

export const STATUS_CHIP: Record<PolicyStatus, string> = {
  Draft: 'chip chip-amber', Published: 'chip chip-moss', Archived: 'chip chip-plain'
};

export const ACK_CHIP: Record<AckState, string> = {
  NotRequired: 'chip chip-plain', Pending: 'chip chip-amber', Overdue: 'chip chip-oxblood', Done: 'chip chip-moss'
};

export const STATE_CHIP: Record<ObligationState, string> = {
  Upcoming: 'chip chip-plain', DueSoon: 'chip chip-amber', Overdue: 'chip chip-oxblood', Completed: 'chip chip-moss', Paused: 'chip chip-plain'
};

export interface ComplianceSummary {
  published: number;
  drafts: number;
  reviewsDue: number;
  myPending: number;
  myOverdue: number;
  ackRate: number | null;
  peoplePending: number;
  obligationsOverdue: number;
  obligationsDueSoon: number;
  filedThisYear: number;
  canManage: boolean;
  canTrack: boolean;
  canViewStatutory: boolean;
  hasPolicies: boolean;
  myEmployeeId: string | null;
}

export interface Option {
  id: string;
  name: string;
  extra: string | null;
}

export interface Lookups {
  departments: Option[];
  people: Option[];
}

export interface PolicyListItem {
  id: string;
  title: string;
  category: PolicyCategory;
  summary: string | null;
  status: PolicyStatus;
  currentVersion: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  effectiveOn: string | null;
  departmentId: string | null;
  departmentName: string | null;
  ownerEmployeeId: string | null;
  ownerName: string | null;
  requiresAcknowledgement: boolean;
  acknowledgeWithinDays: number | null;
  reviewEveryMonths: number | null;
  ackVersion: number | null;
  ackDueOn: string | null;
  nextReviewOn: string | null;
  reviewDue: boolean;
  audienceCount: number | null;
  acknowledgedCount: number | null;
  overdueCount: number | null;
  inMyAudience: boolean;
  myAckState: AckState;
  myAcknowledgedAt: string | null;
  updatedAt: string;
  rowVersion: number;
}

export interface PolicyVersion {
  number: number;
  title: string;
  changeSummary: string | null;
  effectiveOn: string;
  requiresAcknowledgement: boolean;
  publishedAt: string;
  publishedByName: string | null;
}

export interface PolicyVersionContent {
  number: number;
  title: string;
  body: string | null;
  documentUrl: string | null;
  changeSummary: string | null;
  effectiveOn: string;
  publishedAt: string;
}

export interface Policy {
  policy: PolicyListItem;
  current: PolicyVersionContent | null;
  workingBody: string | null;
  workingDocumentUrl: string | null;
  lastReviewedOn: string | null;
  versions: PolicyVersion[];
  canEdit: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
  canMarkReviewed: boolean;
  canAcknowledge: boolean;
  canTrack: boolean;
}

export interface PolicyBody {
  title: string;
  category: PolicyCategory;
  summary: string | null;
  body: string | null;
  documentUrl: string | null;
  departmentId: string | null;
  ownerEmployeeId: string | null;
  requiresAcknowledgement: boolean;
  acknowledgeWithinDays: number | null;
  reviewEveryMonths: number | null;
}

export interface AckPerson {
  employeeId: string;
  name: string;
  code: string;
  departmentName: string;
  designationName: string | null;
  joiningDate: string;
  state: AckState;
  acknowledgedAt: string | null;
  versionNumber: number | null;
}

export interface Obligation {
  id: string;
  title: string;
  authority: string | null;
  category: ObligationCategory;
  frequency: ObligationFrequency;
  description: string | null;
  linkUrl: string | null;
  ownerEmployeeId: string | null;
  ownerName: string | null;
  remindDaysBefore: number;
  nextDueOn: string | null;
  isActive: boolean;
  state: ObligationState;
  daysLeft: number | null;
  lastFiledOn: string | null;
  filingCount: number;
  lateCount: number;
  rowVersion: number;
}

export interface Filing {
  id: string;
  periodDueOn: string;
  filedOn: string;
  isLate: boolean;
  reference: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  byName: string | null;
  recordedAt: string;
  canUndo: boolean;
}

export interface ObligationDetail {
  obligation: Obligation;
  filings: Filing[];
  canManage: boolean;
}

export interface ObligationBody {
  title: string;
  authority: string | null;
  category: ObligationCategory;
  frequency: ObligationFrequency;
  description: string | null;
  linkUrl: string | null;
  ownerEmployeeId: string | null;
  remindDaysBefore: number;
  nextDueOn: string | null;
  isActive: boolean;
}

export interface FilingBody {
  filedOn: string;
  reference: string | null;
  evidenceUrl: string | null;
  notes: string | null;
}

/** Policy text ka halka markdown: "# " heading, "- " bullet, khaali line = naya paragraph. HTML nahi banta (sirf text). */
export interface TextBlock {
  kind: 'h' | 'p' | 'ul';
  text: string;
  items: string[];
}

export function parseBody(text: string | null): TextBlock[] {
  const blocks: TextBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' '), items: [] });
    para = [];
    if (list) blocks.push({ kind: 'ul', text: '', items: list });
    list = null;
  };
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'h', text: heading[1], items: [] });
    } else if (bullet) {
      if (para.length) {
        blocks.push({ kind: 'p', text: para.join(' '), items: [] });
        para = [];
      }
      (list ??= []).push(bullet[1]);
    } else {
      if (list) {
        blocks.push({ kind: 'ul', text: '', items: list });
        list = null;
      }
      para.push(line);
    }
  }
  flush();
  return blocks;
}

export const isHttpLink = (v: string | null | undefined): boolean => !v?.trim() || /^https?:\/\/\S+$/i.test(v.trim());
