/** Employee API /api/learning — Learning & growth page. Enums JSON mein string aate hain. */

export type CourseCategory = 'Technical' | 'Leadership' | 'Compliance' | 'SoftSkills' | 'Onboarding' | 'Product' | 'Safety' | 'Other';
export type CourseFormat = 'Online' | 'Classroom' | 'Workshop' | 'Video' | 'Reading' | 'Mentoring';
export type EnrollmentSource = 'Assigned' | 'Self';
export type EnrollmentStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Cancelled';
export type SkillCategory = 'Technical' | 'Leadership' | 'Communication' | 'Domain' | 'Tools' | 'Language' | 'Other';
export type SkillSource = 'Self' | 'Assessed' | 'Course';
export type CareerGoalStatus = 'Active' | 'Achieved';

export const COURSE_CATEGORIES: readonly CourseCategory[] =
  ['Technical', 'Leadership', 'Compliance', 'SoftSkills', 'Onboarding', 'Product', 'Safety', 'Other'];
export const COURSE_FORMATS: readonly CourseFormat[] = ['Online', 'Classroom', 'Workshop', 'Video', 'Reading', 'Mentoring'];
export const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = ['NotStarted', 'InProgress', 'Completed', 'Cancelled'];
export const SKILL_CATEGORIES: readonly SkillCategory[] = ['Technical', 'Leadership', 'Communication', 'Domain', 'Tools', 'Language', 'Other'];
export const LEVELS: readonly number[] = [1, 2, 3, 4, 5];

export const COURSE_ICON: Record<CourseCategory, string> = {
  Technical: 'terminal', Leadership: 'diversity_3', Compliance: 'verified_user', SoftSkills: 'forum', Onboarding: 'waving_hand',
  Product: 'inventory_2', Safety: 'health_and_safety', Other: 'school'
};

export const FORMAT_ICON: Record<CourseFormat, string> = {
  Online: 'laptop_chromebook', Classroom: 'co_present', Workshop: 'groups', Video: 'smart_display', Reading: 'menu_book', Mentoring: 'support'
};

export const ENROLLMENT_CHIP: Record<EnrollmentStatus, string> = {
  NotStarted: 'chip chip-plain', InProgress: 'chip chip-amber', Completed: 'chip chip-moss', Cancelled: 'chip chip-plain'
};

export const SOURCE_CHIP: Record<SkillSource, string> = {
  Self: 'chip chip-plain', Assessed: 'chip chip-moss', Course: 'chip chip-brass'
};

export interface LearningSummary {
  myOpen: number;
  myOverdue: number;
  myCompletedThisYear: number;
  myHoursThisYear: number;
  teamOpen: number;
  teamOverdue: number;
  teamCompletedThisYear: number;
  activeCourses: number;
  skillCount: number;
  activeGoals: number;
  canManage: boolean;
  canSeeAll: boolean;
  isManager: boolean;
  myEmployeeId: string | null;
  hasCourses: boolean;
  hasSkills: boolean;
}

export interface Option {
  id: string;
  name: string;
  extra: string | null;
}

export interface Lookups {
  departments: Option[];
  people: Option[];
  designations: Option[];
  skills: Option[];
}

export interface CourseListItem {
  id: string;
  title: string;
  category: CourseCategory;
  format: CourseFormat;
  provider: string | null;
  description: string | null;
  linkUrl: string | null;
  durationHours: number | null;
  skillId: string | null;
  skillName: string | null;
  skillLevel: number | null;
  allowSelfEnrol: boolean;
  completeWithinDays: number | null;
  isActive: boolean;
  openCount: number;
  completedCount: number;
  averageRating: number | null;
  myEnrollmentId: string | null;
  myStatus: EnrollmentStatus | null;
  myProgress: number | null;
  myDueOn: string | null;
  myCompletedOn: string | null;
}

export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  category: CourseCategory;
  format: CourseFormat;
  durationHours: number | null;
  linkUrl: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  source: EnrollmentSource;
  status: EnrollmentStatus;
  progress: number;
  dueOn: string | null;
  isOverdue: boolean;
  daysLeft: number | null;
  assignedByName: string | null;
  startedAt: string | null;
  completedOn: string | null;
  score: number | null;
  rating: number | null;
  feedback: string | null;
  certificateUrl: string | null;
  createdAt: string;
  canUpdate: boolean;
  canManage: boolean;
}

export interface CourseDetail {
  course: CourseListItem;
  enrollments: Enrollment[];
  canEdit: boolean;
  canAssign: boolean;
  canEnrol: boolean;
  canDelete: boolean;
}

export interface CourseBody {
  title: string;
  category: CourseCategory;
  format: CourseFormat;
  provider: string | null;
  description: string | null;
  linkUrl: string | null;
  durationHours: number | null;
  skillId: string | null;
  skillLevel: number | null;
  allowSelfEnrol: boolean;
  completeWithinDays: number | null;
  isActive: boolean;
}

export interface CompleteBody {
  completedOn: string | null;
  score: number | null;
  rating: number | null;
  feedback: string | null;
  certificateUrl: string | null;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string | null;
  isActive: boolean;
  peopleCount: number;
  averageLevel: number | null;
  courseCount: number;
  roleCount: number;
}

export interface SkillBody {
  name: string;
  category: SkillCategory;
  description: string | null;
  isActive: boolean;
}

export interface PersonSkill {
  skillId: string;
  name: string;
  category: SkillCategory;
  level: number;
  source: SkillSource;
  updatedAt: string;
  byName: string | null;
  requiredNow: number | null;
  requiredNext: number | null;
}

export interface SkillGap {
  skillId: string;
  name: string;
  required: number;
  current: number | null;
  met: boolean;
}

export interface CourseSuggestion {
  courseId: string;
  title: string;
  skillId: string;
  skillLevel: number | null;
  durationHours: number | null;
  allowSelfEnrol: boolean;
  myStatus: EnrollmentStatus | null;
}

export interface CareerGoal {
  targetDesignationId: string;
  targetTitle: string;
  targetDate: string | null;
  notes: string | null;
  status: CareerGoalStatus;
  achievedOn: string | null;
  readiness: number | null;
  gaps: SkillGap[];
  suggestions: CourseSuggestion[];
  updatedAt: string;
  byName: string | null;
}

export interface PersonGrowth {
  employeeId: string;
  name: string;
  code: string;
  departmentName: string;
  designationId: string;
  designationName: string;
  skills: PersonSkill[];
  currentRoleReadiness: number | null;
  currentRoleGaps: SkillGap[];
  goal: CareerGoal | null;
  isMe: boolean;
  canRate: boolean;
  canAssess: boolean;
  canSetGoal: boolean;
  canMarkAchieved: boolean;
}

export interface MatrixSkill {
  id: string;
  name: string;
  category: SkillCategory;
}

export interface MatrixRow {
  employeeId: string;
  name: string;
  code: string;
  departmentName: string;
  designationName: string;
  levels: Record<string, number>;
}

export interface SkillMatrix {
  skills: MatrixSkill[];
  people: MatrixRow[];
}

export interface RoleSkill {
  skillId: string;
  name: string;
  requiredLevel: number;
}

export interface CareerRole {
  designationId: string;
  title: string;
  level: number | null;
  peopleCount: number;
  aimingCount: number;
  skills: RoleSkill[];
}

export interface CareerGoalRow {
  employeeId: string;
  name: string;
  code: string;
  departmentName: string;
  currentTitle: string;
  targetDesignationId: string;
  targetTitle: string;
  targetDate: string | null;
  status: CareerGoalStatus;
  achievedOn: string | null;
  readiness: number | null;
  gapCount: number;
  updatedAt: string;
}

export interface EnrollmentFilter {
  scope: 'mine' | 'team';
  status: EnrollmentStatus | '';
  overdue: boolean;
  courseId: string;
  departmentId: string;
  search: string;
}

export const isHttpLink = (v: string | null | undefined): boolean => !v?.trim() || /^https?:\/\/\S+$/i.test(v.trim());

/** Readiness % ke liye rang: poora = moss, aadha+ = brass, kam = oxblood. */
export const readinessTone = (p: number | null): string => p === null ? '' : p >= 100 ? 'is-good' : p >= 50 ? 'is-mid' : 'is-low';
