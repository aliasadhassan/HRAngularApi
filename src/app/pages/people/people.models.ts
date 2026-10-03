/** HR.Employee.API ke DTOs — enums string mein (JsonStringEnumConverter). */

export type Gender = 'Male' | 'Female' | 'Other';
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed';
export type EmploymentType = 'FullTime' | 'PartTime' | 'Contract' | 'Intern';
export type EmploymentStatus = 'Active' | 'Probation' | 'OnNotice' | 'Suspended' | 'Exited';
export type JobChangeType = 'Joined' | 'DesignationChange' | 'Transfer' | 'ManagerChange' | 'StatusChange' | 'Exit';

export interface Lookup {
  id: string;
  name: string;
}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  departmentName: string;
  designationTitle: string;
  locationName: string;
  managerName: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  joiningDate: string;
  photoStorageKey: string | null;
}

export interface Address {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone: string | null;
  isPrimary: boolean;
}

export interface JobHistory {
  id: string;
  effectiveDate: string;
  changeType: JobChangeType;
  departmentId: string;
  designationId: string;
  locationId: string;
  managerId: string | null;
  employmentStatus: EmploymentStatus;
  remarks: string | null;
}

export interface EmployeeDetails {
  id: string;
  employeeCode: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  maritalStatus: MaritalStatus | null;
  nationalityCode: string | null;
  workEmail: string;
  personalEmail: string | null;
  workPhone: string | null;
  personalPhone: string | null;
  address: Address;
  location: Lookup;
  department: Lookup;
  designation: Lookup;
  manager: Lookup | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  joiningDate: string;
  probationEndDate: string | null;
  confirmationDate: string | null;
  noticePeriodDays: number | null;
  exitDate: string | null;
  exitReason: string | null;
  photoStorageKey: string | null;
  emergencyContacts: EmergencyContact[];
  jobHistory: JobHistory[];
}

export interface CreateEmployee {
  employeeCode: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  workEmail: string;
  locationId: string;
  departmentId: string;
  designationId: string;
  managerId: string | null;
  employmentType: EmploymentType;
  joiningDate: string;
  probationEndDate: string | null;
}

export interface UpdateProfile {
  employeeId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  maritalStatus: MaritalStatus | null;
  nationalityCode: string | null;
  personalEmail: string | null;
  workPhone: string | null;
  personalPhone: string | null;
  address: Address | null;
}

export interface ChangeJob {
  employeeId: string;
  departmentId: string;
  locationId: string;
  designationId: string;
  managerId: string | null;
  effectiveDate: string;
  remarks: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parentDepartmentId: string | null;
  parentName: string | null;
  headEmployeeId: string | null;
  headName: string | null;
  isActive: boolean;
  employeeCount: number;
}
export interface SaveDepartment {
  name: string;
  code: string;
  description: string | null;
  parentDepartmentId: string | null;
  headEmployeeId: string | null;
}

export interface Designation {
  id: string;
  title: string;
  level: number | null;
  description: string | null;
  isActive: boolean;
  employeeCount: number;
}
export interface SaveDesignation {
  title: string;
  level: number | null;
  description: string | null;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  countryCode: string;
  city: string | null;
  addressLine: string | null;
  timeZone: string;
  workWeekDays: number;
  isHeadOffice: boolean;
  isActive: boolean;
  employeeCount: number;
}
export interface SaveLocation {
  name: string;
  code: string;
  countryCode: string;
  timeZone: string;
  city: string | null;
  addressLine: string | null;
  workWeekDays: number;
  isHeadOffice: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export const STATUS_CHIP: Record<EmploymentStatus, string> = {
  Active: 'chip chip-moss',
  Probation: 'chip chip-amber',
  OnNotice: 'chip chip-oxblood',
  Suspended: 'chip chip-oxblood',
  Exited: 'chip chip-muted'
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
