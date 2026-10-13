/** Employee API /api/ai ke DTOs (Application/Ai/AiFeature.cs). Enums string mein aate hain. */

/** [Flags] AiArea — JSON mein "People, TimeLeave" jaisa string. */
export type AiArea = 'People' | 'TimeLeave' | 'Payroll' | 'LoansExpenses' | 'Recruitment' | 'PoliciesLearning' | 'RelationsSafety';
export type AiRole = 'User' | 'Assistant';
export type InsightLevel = 'Attention' | 'Look' | 'Info';
export type InsightStatus = 'Open' | 'Dismissed';
export type ScreeningFit = 'Strong' | 'Partial' | 'Weak';
export type JobStatus = 'Draft' | 'PendingApproval' | 'Open' | 'OnHold' | 'Closed' | 'Cancelled';
export type Stage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected' | 'Withdrawn';

export interface AiUsage {
  used: number;
  limit: number;
  chat: number;
  screens: number;
  insightRuns: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AiSettings {
  areas: string;
  monthlyLimit: number;
  historyDays: number;
  selfService: boolean;
  rowVersion: number;
}

export interface AiHome {
  configured: boolean;
  model: string;
  canChat: boolean;
  canInsights: boolean;
  canScreen: boolean;
  canManage: boolean;
  usage: AiUsage;
  settings: AiSettings;
  areas: AiArea[];
}

export interface ConversationItem {
  id: string;
  title: string;
  lastMessageAt: string;
  turnCount: number;
}

export interface ChatMessage {
  id: string;
  seq: number;
  role: AiRole;
  text: string;
  tools: string[];
  failed: boolean;
  at: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  canContinue: boolean;
}

export interface AskResult {
  conversationId: string;
  title: string;
  question: ChatMessage;
  answer: ChatMessage;
  usage: AiUsage;
}

export interface Insight {
  id: string;
  runId: string;
  area: string;
  level: InsightLevel;
  title: string;
  body: string;
  metric: string | null;
  metricLabel: string | null;
  source: string | null;
  link: string | null;
  status: InsightStatus;
  runAt: string;
  runByName: string | null;
}

export interface Insights {
  lastRunAt: string | null;
  lastRunBy: string | null;
  items: Insight[];
}

export interface ScreeningJob {
  id: string;
  code: string;
  title: string;
  department: string | null;
  status: JobStatus;
  applicants: number;
  hasRequirements: boolean;
}

export interface ScreeningRow {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  currentTitle: string | null;
  experienceYears: number | null;
  city: string | null;
  stage: Stage;
  appliedAt: string;
  screeningId: string | null;
  score: number | null;
  fit: ScreeningFit | null;
  screenedAt: string | null;
}

export interface ScreeningBoard {
  jobs: ScreeningJob[];
  jobId: string | null;
  rows: ScreeningRow[];
}

export interface RequirementCheck {
  requirement: string;
  met: 'yes' | 'partial' | 'no';
  evidence: string;
}

export interface Screening {
  id: string;
  applicationId: string;
  score: number;
  fit: ScreeningFit;
  summary: string;
  requirements: RequirementCheck[];
  questions: string[];
  byName: string | null;
  at: string;
}

export interface AiSettingsBody {
  areas: string;
  monthlyLimit: number;
  historyDays: number;
  selfService: boolean;
  rowVersion: number | null;
}

/** Settings ki fehrist — order mockup jaisa. sensitive = "Sensitive" tag; offByDefault = RelationsSafety. */
export const AREAS: readonly { key: AiArea; icon: string; sensitive: boolean; offByDefault?: boolean }[] = [
  { key: 'People', icon: 'groups', sensitive: false },
  { key: 'TimeLeave', icon: 'event_available', sensitive: false },
  { key: 'Payroll', icon: 'payments', sensitive: true },
  { key: 'LoansExpenses', icon: 'account_balance_wallet', sensitive: true },
  { key: 'Recruitment', icon: 'person_search', sensitive: false },
  { key: 'PoliciesLearning', icon: 'menu_book', sensitive: false },
  { key: 'RelationsSafety', icon: 'health_and_safety', sensitive: true, offByDefault: true }
];

export const HISTORY_DAYS = [30, 90, 180, 365] as const;
export const MAX_QUESTION = 4000;
export const MAX_CV_CHARS = 60_000;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export const LEVEL_CHIP: Record<InsightLevel, string> = { Attention: 'chip-oxblood', Look: 'chip-amber', Info: 'chip-moss' };
export const FIT_CHIP: Record<ScreeningFit, string> = { Strong: 'chip-moss', Partial: 'chip-amber', Weak: 'chip-oxblood' };

/** "People, TimeLeave" ⇄ Set. "None" / khaali = kuch nahi. */
export function parseAreas(value: string | null | undefined): Set<AiArea> {
  const keys = AREAS.map(a => a.key) as string[];
  return new Set((value ?? '').split(',').map(s => s.trim()).filter(s => keys.includes(s)) as AiArea[]);
}

export function joinAreas(set: ReadonlySet<AiArea>): string {
  const list = AREAS.map(a => a.key).filter(k => set.has(k));
  return list.length ? list.join(', ') : 'None';
}
