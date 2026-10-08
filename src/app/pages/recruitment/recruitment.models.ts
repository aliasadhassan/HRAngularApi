/** HR.Employee.API Application/Recruitment DTOs (enums JSON mein string). */
import { EmploymentType } from '../people/people.models';

export type JobStatus = 'Draft' | 'Submitted' | 'Open' | 'OnHold' | 'Filled' | 'Cancelled';
export type JobReason = 'NewPosition' | 'Replacement';
export type CandidateSource = 'Website' | 'Referral' | 'JobBoard' | 'LinkedIn' | 'Agency' | 'Direct' | 'Other';
export type Stage = 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected' | 'Withdrawn';
export type OfferStatus = 'Pending' | 'Accepted' | 'Declined';
export type EventKind = 'Applied' | 'Stage' | 'Note' | 'Offer' | 'OfferResponse' | 'Hired';
export type InterviewMode = 'InPerson' | 'Video' | 'Phone';
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow';
export type Recommendation = 'StrongNo' | 'No' | 'Yes' | 'StrongYes';

export const JOB_STATUSES: readonly JobStatus[] = ['Draft', 'Submitted', 'Open', 'OnHold', 'Filled', 'Cancelled'];
export const SOURCES: readonly CandidateSource[] = ['Website', 'Referral', 'JobBoard', 'LinkedIn', 'Agency', 'Direct', 'Other'];
export const STAGES: readonly Stage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected', 'Withdrawn'];
/** Kanban columns (pipeline mein) */
export const BOARD_STAGES: readonly Stage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
/** Haath se move ho sakte hain (Offer/Hired apne buttons se) */
export const MOVE_STAGES: readonly Stage[] = ['Applied', 'Screening', 'Interview'];
export const MODES: readonly InterviewMode[] = ['Video', 'InPerson', 'Phone'];
export const RECOMMENDATIONS: readonly Recommendation[] = ['StrongNo', 'No', 'Yes', 'StrongYes'];
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = ['FullTime', 'PartTime', 'Contract', 'Intern'];

export interface RecruitmentSummary {
  openJobs: number;
  openPositions: number;
  pendingApprovals: number;
  draftRequisitions: number;
  activeApplications: number;
  inInterview: number;
  offersPending: number;
  hiredLast30Days: number;
  averageDaysToHire: number | null;
  interviewsToday: number;
  myUpcomingInterviews: number;
  myFeedbackDue: number;
  isHr: boolean;
  canManage: boolean;
  canHire: boolean;
  canRequest: boolean;
  myEmployeeId: string | null;
}

export interface Option {
  id: string;
  name: string;
  extra: string | null;
}

export interface Lookups {
  departments: Option[];
  designations: Option[];
  locations: Option[];
  people: Option[];
}

export interface JobListItem {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName: string;
  designationId: string | null;
  designationTitle: string | null;
  locationId: string | null;
  locationName: string | null;
  hiringManagerEmployeeId: string | null;
  hiringManagerName: string | null;
  employmentType: EmploymentType;
  openings: number;
  hired: number;
  inPipeline: number;
  reason: JobReason;
  status: JobStatus;
  targetStartDate: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: string;
  submittedAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  reviewNote: string | null;
  isMine: boolean;
}

export interface Job {
  job: JobListItem;
  description: string | null;
  requirements: string | null;
  replacesEmployeeId: string | null;
  replacesName: string | null;
  requestedByName: string | null;
  approvedAt: string | null;
  closeNote: string | null;
  stageCounts: number[];
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canManage: boolean;
  canDelete: boolean;
  canAddCandidates: boolean;
  canWorkPipeline: boolean;
  rowVersion: number;
}

export interface CandidateListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  experienceYears: number | null;
  source: CandidateSource;
  referredByName: string | null;
  applications: number;
  activeApplications: number;
  latestJobTitle: string | null;
  latestStage: Stage | null;
  createdAt: string;
}

export interface ApplicationListItem {
  id: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  jobStatus: JobStatus;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  currentTitle: string | null;
  currentCompany: string | null;
  source: CandidateSource;
  stage: Stage;
  appliedAt: string;
  stageChangedAt: string;
  rating: number | null;
  offerStatus: OfferStatus | null;
  nextInterviewAt: string | null;
  interviewsDone: number;
  interviewScore: number | null;
  hiredEmployeeId: string | null;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  experienceYears: number | null;
  source: CandidateSource;
  referredByEmployeeId: string | null;
  referredByName: string | null;
  resumeUrl: string | null;
  linkedInUrl: string | null;
  notes: string | null;
  createdAt: string;
  applications: ApplicationListItem[];
  canEdit: boolean;
  rowVersion: number;
}

export interface ApplicationEvent {
  id: string;
  kind: EventKind;
  fromStage: Stage | null;
  toStage: Stage;
  note: string | null;
  byName: string | null;
  at: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateTitle: string | null;
  resumeUrl: string | null;
  jobId: string;
  jobTitle: string;
  stage: Stage;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  locationOrLink: string | null;
  interviewerEmployeeId: string;
  interviewerName: string;
  status: InterviewStatus;
  rating: number | null;
  recommendation: Recommendation | null;
  feedback: string | null;
  feedbackAt: string | null;
  isMine: boolean;
  canEdit: boolean;
  canFeedback: boolean;
  rowVersion: number;
}

export interface Application {
  application: ApplicationListItem;
  phone: string | null;
  city: string | null;
  experienceYears: number | null;
  resumeUrl: string | null;
  linkedInUrl: string | null;
  candidateNotes: string | null;
  departmentName: string;
  hiringManagerName: string | null;
  jobDesignationId: string | null;
  jobLocationId: string | null;
  jobDepartmentId: string;
  jobHiringManagerId: string | null;
  jobEmploymentType: EmploymentType;
  rejectReason: string | null;
  offerSalary: number | null;
  offerStartDate: string | null;
  offerExpiresOn: string | null;
  offeredAt: string | null;
  hiredAt: string | null;
  hiredEmployeeCode: string | null;
  events: ApplicationEvent[];
  interviews: Interview[];
  canWork: boolean;
  canOffer: boolean;
  canHire: boolean;
  rowVersion: number;
}

export interface HeadcountRow {
  departmentId: string;
  departmentName: string;
  employees: number;
  onNotice: number;
  openPositions: number;
  pendingRequisitions: number;
  inPipeline: number;
  hiredLast90Days: number;
}

export interface HireResult {
  employeeId: string;
  employeeCode: string;
  onboardingCaseId: string | null;
  onboardingError: string | null;
  jobFilled: boolean;
}

export interface JobBody {
  title: string;
  departmentId: string;
  designationId: string | null;
  locationId: string | null;
  hiringManagerEmployeeId: string | null;
  employmentType: EmploymentType;
  openings: number;
  reason: JobReason;
  replacesEmployeeId: string | null;
  targetStartDate: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string | null;
  requirements: string | null;
}

export interface CandidateBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  experienceYears: number | null;
  source: CandidateSource;
  referredByEmployeeId: string | null;
  resumeUrl: string | null;
  linkedInUrl: string | null;
  notes: string | null;
  jobId: string | null;
}

export interface InterviewBody {
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  mode: InterviewMode;
  locationOrLink: string | null;
  interviewerEmployeeId: string;
}

export interface HireBody {
  existingEmployeeId: string | null;
  employeeCode: string | null;
  workEmail: string | null;
  locationId: string | null;
  departmentId: string | null;
  designationId: string | null;
  managerId: string | null;
  employmentType: EmploymentType | null;
  joiningDate: string;
  probationEndDate: string | null;
  startOnboarding: boolean;
  onboardingTemplateId: string | null;
}

export const JOB_CHIP: Record<JobStatus, string> = {
  Draft: 'chip chip-plain',
  Submitted: 'chip chip-amber',
  Open: 'chip chip-moss',
  OnHold: 'chip chip-brass',
  Filled: 'chip chip-ink',
  Cancelled: 'chip chip-plain'
};

export const STAGE_CHIP: Record<Stage, string> = {
  Applied: 'chip chip-plain',
  Screening: 'chip chip-brass',
  Interview: 'chip chip-ink',
  Offer: 'chip chip-amber',
  Hired: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Withdrawn: 'chip chip-plain'
};

export const INTERVIEW_CHIP: Record<InterviewStatus, string> = {
  Scheduled: 'chip chip-brass',
  Completed: 'chip chip-moss',
  Cancelled: 'chip chip-plain',
  NoShow: 'chip chip-oxblood'
};

export const MODE_ICON: Record<InterviewMode, string> = {
  InPerson: 'meeting_room',
  Video: 'videocam',
  Phone: 'call'
};

export const isActiveStage = (s: Stage): boolean => s === 'Applied' || s === 'Screening' || s === 'Interview' || s === 'Offer';
export const isOpenJob = (s: JobStatus): boolean => s === 'Open' || s === 'OnHold';

/** "2026-10-08T09:30" (datetime-local, browser time) ↔ UTC ISO */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const isHttpLink = (v: string): boolean => /^https?:\/\/\S+$/i.test(v.trim());
