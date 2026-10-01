export type UserStatus = 'Active' | 'Invited' | 'Locked' | 'Disabled';

export interface RoleRef {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface UserListItem {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: RoleRef[];
  status: UserStatus;
  isSso: boolean;
  isYou: boolean;
  lastLoginAt: string | null;
  lockoutEnd: string | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserCounts {
  all: number;
  active: number;
  invited: number;
  locked: number;
  disabled: number;
}

export interface AssignableRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
}

export const USER_STATUS_CHIP: Record<UserStatus, string> = {
  Active: 'chip chip-moss',
  Invited: 'chip chip-amber',
  Locked: 'chip chip-oxblood',
  Disabled: 'chip chip-muted'
};

/** Backend dates UTC hain lekin "Z" ke baghair aati hain. */
export function utc(value: string | null): Date | null {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value + 'Z');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export interface PermissionItem {
  id: number;
  code: string;
  module: string;
  description: string | null;
  sortOrder: number;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionIds: number[];
}

export type LoginMethod = 'Password' | 'Microsoft' | 'Refresh';

export interface LoginActivityItem {
  id: number;
  occurredAt: string;
  userId: string | null;
  userName: string | null;
  emailAttempted: string;
  method: LoginMethod;
  succeeded: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginActivitySummary {
  days: number;
  signIns: number;
  failed: number;
  lockouts: number;
  uniqueUsers: number;
}

/** User-agent se "Chrome on Windows" jaisa — poori library ki zaroorat nahi. */
export function describeDevice(ua: string | null): { browser: string; os: string; mobile: boolean } {
  if (!ua) return { browser: '—', os: '', mobile: false };
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /PostmanRuntime/.test(ua) ? 'Postman' : 'Other';
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : '';
  return { browser, os, mobile: /Mobile|Android|iPhone/.test(ua) };
}

export interface CompanyProfile {
  name: string;
  legalName: string | null;
  slug: string;
  logoUrl: string | null;
  primaryEmail: string | null;
  phone: string | null;
  plan: string;
  ssoEnabled: boolean;
}

export interface CompanySettings {
  timeZone: string;
  currency: string;
  dateFormat: string;
  fiscalYearStartMonth: number;
  workWeekDays: number;
  passwordMinLength: number;
  maxFailedLoginAttempts: number;
}

export interface Company {
  profile: CompanyProfile;
  settings: CompanySettings;
  updatedAt: string | null;
}
