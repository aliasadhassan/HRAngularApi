/** Employee API /api/engagement — Engagement page (surveys + recognition). Enums JSON mein string aate hain. */

export type SurveyStatus = 'Draft' | 'Open' | 'Closed';
export type SurveyAudience = 'Everyone' | 'Department';
export type QuestionType = 'Rating' | 'Nps' | 'YesNo' | 'Choice' | 'Text';
export type RecognitionValue = 'Teamwork' | 'Customer' | 'Innovation' | 'Ownership' | 'Leadership' | 'Helping' | 'Excellence';
export type FeedScope = 'all' | 'received' | 'given';
export type StatsPeriod = 'month' | 'quarter' | 'year';

export const SURVEY_STATUSES: readonly SurveyStatus[] = ['Draft', 'Open', 'Closed'];
export const QUESTION_TYPES: readonly QuestionType[] = ['Rating', 'Nps', 'YesNo', 'Choice', 'Text'];
export const RECOGNITION_VALUES: readonly RecognitionValue[] =
  ['Teamwork', 'Customer', 'Innovation', 'Ownership', 'Leadership', 'Helping', 'Excellence'];
export const RATINGS: readonly number[] = [1, 2, 3, 4, 5];
export const NPS_SCALE: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MAX_QUESTIONS = 30;
export const MAX_OPTIONS = 10;
export const MAX_RECIPIENTS = 10;

export const STATUS_CHIP: Record<SurveyStatus, string> = {
  Draft: 'chip chip-plain', Open: 'chip chip-moss', Closed: 'chip chip-brass'
};

export const QUESTION_ICON: Record<QuestionType, string> = {
  Rating: 'star_half', Nps: 'speed', YesNo: 'rule', Choice: 'checklist', Text: 'notes'
};

export const VALUE_ICON: Record<RecognitionValue, string> = {
  Teamwork: 'groups', Customer: 'support_agent', Innovation: 'lightbulb', Ownership: 'verified',
  Leadership: 'flag', Helping: 'volunteer_activism', Excellence: 'workspace_premium'
};

export interface EngagementSummary {
  myPendingSurveys: number;
  openSurveys: number;
  draftSurveys: number;
  averageResponseRate: number | null;
  recognitionsThisMonth: number;
  myReceived: number;
  myGiven: number;
  myReceivedThisMonth: number;
  canManage: boolean;
  canSeeResults: boolean;
  myEmployeeId: string | null;
  hasSurveys: boolean;
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

export interface SurveyListItem {
  id: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  audience: SurveyAudience;
  departmentId: string | null;
  departmentName: string | null;
  closesOn: string | null;
  status: SurveyStatus;
  publishedAt: string | null;
  closedAt: string | null;
  questionCount: number;
  eligible: number | null;
  responded: number | null;
  responseRate: number | null;
  daysLeft: number | null;
  forMe: boolean;
  iHaveResponded: boolean;
  canRespond: boolean;
  createdAt: string;
  rowVersion: number;
}

export interface SurveyQuestion {
  id: string;
  order: number;
  text: string;
  type: QuestionType;
  options: string[];
  isRequired: boolean;
}

export interface SurveyDetail {
  survey: SurveyListItem;
  questions: SurveyQuestion[];
  canEdit: boolean;
  canPublish: boolean;
  canClose: boolean;
  canReopen: boolean;
  canDelete: boolean;
  canSeeResults: boolean;
}

export interface SurveyComment {
  text: string;
  name: string | null;
  submittedOn: string;
}

export interface QuestionResult {
  questionId: string;
  order: number;
  text: string;
  type: QuestionType;
  options: string[];
  answered: number;
  average: number | null;
  score: number | null;
  distribution: number[];
  comments: SurveyComment[];
}

export interface DepartmentResult {
  departmentId: string;
  name: string;
  responded: number;
  eligible: number;
  responseRate: number | null;
  averageRating: number | null;
  nps: number | null;
  hidden: boolean;
}

export interface SurveyResults {
  surveyId: string;
  title: string;
  isAnonymous: boolean;
  responded: number;
  eligible: number;
  responseRate: number | null;
  hidden: boolean;
  threshold: number;
  averageRating: number | null;
  nps: number | null;
  questions: QuestionResult[];
  departments: DepartmentResult[];
}

export interface SurveyTemplate {
  key: string;
  title: string;
  description: string | null;
  isAnonymous: boolean;
  questionCount: number;
}

export interface QuestionBody {
  text: string;
  type: QuestionType;
  options: string[] | null;
  isRequired: boolean;
}

export interface SurveyBody {
  title: string;
  description: string | null;
  isAnonymous: boolean;
  audience: SurveyAudience;
  departmentId: string | null;
  closesOn: string | null;
  questions: QuestionBody[] | null;
}

export interface AnswerBody {
  questionId: string;
  value: number | null;
  text: string | null;
}

export interface Recognition {
  id: string;
  fromEmployeeId: string;
  fromName: string;
  toEmployeeId: string;
  toName: string;
  toDetail: string;
  value: RecognitionValue;
  message: string;
  createdAt: string;
  cheers: number;
  iCheered: boolean;
  isMine: boolean;
  canDelete: boolean;
}

export interface Leader {
  employeeId: string;
  name: string;
  detail: string;
  count: number;
}

export interface RecognitionStats {
  period: StatsPeriod;
  from: string;
  total: number;
  previousTotal: number;
  people: number;
  topReceivers: Leader[];
  topGivers: Leader[];
  byValue: { value: RecognitionValue; count: number }[];
}

export interface FeedFilter {
  scope: FeedScope;
  value: RecognitionValue | '';
  departmentId: string;
  before: string | null;
}

/** Naam se do huroof (avatar). */
export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');

/** eNPS ka rang: +30 se upar acha, 0 se neeche kharab. */
export const npsTone = (n: number | null): string => n === null ? '' : n >= 30 ? 'is-good' : n >= 0 ? 'is-mid' : 'is-low';

/** 1-5 average ka rang. */
export const ratingTone = (n: number | null): string => n === null ? '' : n >= 4 ? 'is-good' : n >= 3 ? 'is-mid' : 'is-low';
