/** HRCoreWebApi Application/Attendance DTOs. Enums string mein aate hain (JsonStringEnumConverter). Times UTC ISO. */

export type AttendanceStatus = 'Present' | 'Absent' | 'HalfDay' | 'OnLeave' | 'Holiday' | 'WeeklyOff' | 'Incomplete';
export type DayType = 'Workday' | 'WeeklyOff' | 'Holiday';
export type PunchDirection = 'In' | 'Out' | 'Unknown';
export type PunchSource = 'Web' | 'Mobile' | 'Biometric' | 'Manual' | 'Request';
export type ClockInMethod = 'Web' | 'Mobile' | 'Biometric';
export type AttendanceRequestType = 'Correction' | 'WorkFromHome' | 'OnDuty' | 'Overtime';
export type AttendanceRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type AttendanceRequestScope = 'Mine' | 'Approvals' | 'All';
export type ApproverType = 'LineManager' | 'DepartmentHead' | 'HR';
export type ScheduleSource = 'Override' | 'Assignment' | 'WorkWeek';

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// ── Setup ──
export interface Shift {
  id: string;
  name: string;
  code: string;
  color: string | null;
  startTime: string;          // "09:00:00"
  endTime: string;
  breakMinutes: number;
  graceInMinutes: number;
  graceOutMinutes: number;
  isFlexible: boolean;
  isActive: boolean;
  crossesMidnight: boolean;
  netMinutes: number;
  assignedEmployees: number;
}
export type SaveShift = Omit<Shift, 'id' | 'crossesMidnight' | 'netMinutes' | 'assignedEmployees'>;

export interface AttendancePolicy {
  id: string;
  name: string;
  locationId: string | null;
  locationName: string | null;
  isActive: boolean;
  fullDayMinutes: number;
  halfDayMinutes: number;
  latesPerHalfDay: number | null;
  allowedMethods: string;     // flags: "Web, Mobile"
  requireGeofence: boolean;
  geoLatitude: number | null;
  geoLongitude: number | null;
  geoRadiusMeters: number | null;
  requestApprover: ApproverType;
  correctionWindowDays: number;
  maxCorrectionsPerMonth: number | null;
  overtimeEnabled: boolean;
  overtimeMinMinutes: number;
  overtimeMaxMinutesPerDay: number | null;
  overtimeRequiresApproval: boolean;
  overtimeRateWorkday: number;
  overtimeRateWeeklyOff: number;
  overtimeRateHoliday: number;
}
export type SavePolicy = Omit<AttendancePolicy, 'id' | 'locationName'>;

export interface AttendanceDevice {
  id: string;
  name: string;
  serialNumber: string;
  vendor: string | null;
  locationId: string;
  locationName: string;
  hasApiKey: boolean;
  lastSyncedAt: string | null;
  isActive: boolean;
}
export interface SaveDevice {
  name: string;
  serialNumber: string;
  vendor: string | null;
  locationId: string;
  isActive: boolean;
}

// ── Timesheet ──
export interface Punch {
  id: string;
  punchedAt: string;
  direction: PunchDirection;
  source: PunchSource;
  deviceName: string | null;
  latitude: number | null;
  longitude: number | null;
  isIgnored: boolean;
  note: string | null;
}

export interface AttendanceDay {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  workDate: string;
  dayType: DayType;
  shiftCode: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
  isManuallyEdited: boolean;
  remarks: string | null;
}

export interface AttendanceDayDetail {
  day: AttendanceDay;
  punches: Punch[];
}

export interface MyToday {
  employeeId: string;
  workDate: string;
  dayType: DayType;
  shiftName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  day: AttendanceDay | null;
  punches: Punch[];
  nextAction: PunchDirection;
  requiresLocation: boolean;
  allowedSources: PunchSource[];
}

export interface AttendanceSummary {
  date: string;
  total: number;
  byStatus: Partial<Record<AttendanceStatus, number>>;
  late: number;
}

export interface TimesheetQuery {
  from: string;
  to: string;
  employeeId?: string;
  departmentId?: string;
  locationId?: string;
  status?: AttendanceStatus | '';
  lateOnly?: boolean;
  page: number;
  pageSize: number;
}

// ── Roster ──
export interface RosterDay {
  date: string;
  dayType: DayType;
  shiftId: string | null;
  shiftCode: string | null;
  shiftColor: string | null;
  startTime: string | null;
  endTime: string | null;
  source: ScheduleSource;
}

export interface RosterRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  days: RosterDay[];
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  shiftCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  weeklyOffDays: number | null;
}

// ── Requests ──
export interface AttendanceRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  type: AttendanceRequestType;
  requestedIn: string | null;
  requestedOut: string | null;
  overtimeMinutes: number | null;
  approvedMinutes: number | null;
  overtimeRate: number | null;
  reason: string | null;
  status: AttendanceRequestStatus;
  approverType: ApproverType;
  approverName: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Absent', 'HalfDay', 'OnLeave', 'Holiday', 'WeeklyOff', 'Incomplete'];

export const ATTENDANCE_STATUS_CHIP: Record<AttendanceStatus, string> = {
  Present: 'chip chip-moss',
  Absent: 'chip chip-oxblood',
  HalfDay: 'chip chip-amber',
  OnLeave: 'chip chip-ink',
  Holiday: 'chip chip-neutral',
  WeeklyOff: 'chip chip-muted',
  Incomplete: 'chip chip-amber'
};

export const REQUEST_STATUS_CHIP: Record<AttendanceRequestStatus, string> = {
  Pending: 'chip chip-amber',
  Approved: 'chip chip-moss',
  Rejected: 'chip chip-oxblood',
  Cancelled: 'chip chip-muted'
};

/** Mon=1 … Sun=64 (backend AttendanceEngine.DayBit jaisa). */
export const WEEK_BITS: { key: string; bit: number }[] = [
  { key: 'mon', bit: 1 }, { key: 'tue', bit: 2 }, { key: 'wed', bit: 4 }, { key: 'thu', bit: 8 },
  { key: 'fri', bit: 16 }, { key: 'sat', bit: 32 }, { key: 'sun', bit: 64 }
];

/** 125 → "2h 05m" */
export function hm(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Local yyyy-MM-dd (toISOString UTC deta hai — Pakistan mein raat 12 ke baad ghalat din). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}
