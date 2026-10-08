/** HR.Employee.API Application/Assets DTOs (enums JSON mein string). */
import { EmploymentStatus } from '../lifecycle/lifecycle.models';

export type AssetStatus = 'Available' | 'Assigned' | 'InRepair' | 'Retired' | 'Lost';
export type AssetCondition = 'New' | 'Good' | 'Fair' | 'Poor' | 'Damaged';
export type AssetEventType = 'Created' | 'Updated' | 'Assigned' | 'Returned' | 'StatusChanged' | 'Acknowledged';
export type AssignmentState = 'Open' | 'Due' | 'Returned';

export const STATUSES: readonly AssetStatus[] = ['Available', 'Assigned', 'InRepair', 'Retired', 'Lost'];
export const CONDITIONS: readonly AssetCondition[] = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];
export const EVENT_TYPES: readonly AssetEventType[] = ['Created', 'Updated', 'Assigned', 'Returned', 'StatusChanged', 'Acknowledged'];
/** Return ke baad asset kahan jaye */
export const AFTER_RETURN: readonly AssetStatus[] = ['Available', 'InRepair', 'Lost'];

export interface AssetSummary {
  total: number;
  available: number;
  assigned: number;
  inRepair: number;
  retiredOrLost: number;
  returnsDue: number;
  overdueReturns: number;
  withLeavers: number;
  unacknowledged: number;
  warrantyExpiring: number;
  totalValue: number;
}

export interface AssetListItem {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  locationId: string | null;
  locationName: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  purchaseDate: string | null;
  purchaseCost: number | null;
  warrantyUntil: string | null;
  holderEmployeeId: string | null;
  holderName: string | null;
  holderCode: string | null;
  assignedOn: string | null;
  dueBack: string | null;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  categoryName: string;
  categoryIcon: string | null;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  employmentStatus: EmploymentStatus;
  lastWorkingDay: string | null;
  assignedOn: string;
  dueBack: string | null;
  conditionOut: AssetCondition;
  assignNote: string | null;
  acknowledgedAt: string | null;
  returnedOn: string | null;
  conditionIn: AssetCondition | null;
  returnNote: string | null;
}

export interface AssetEvent {
  id: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  type: AssetEventType;
  status: AssetStatus;
  employeeId: string | null;
  employeeName: string | null;
  byName: string | null;
  at: string;
  detail: string | null;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  locationId: string | null;
  locationName: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  vendor: string | null;
  warrantyUntil: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  notes: string | null;
  createdAt: string;
  rowVersion: number;
  assignments: AssetAssignment[];
  events: AssetEvent[];
}

export interface MyAsset {
  assignmentId: string;
  assetId: string;
  assetTag: string;
  name: string;
  categoryName: string;
  categoryIcon: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  assignedOn: string;
  dueBack: string | null;
  conditionOut: AssetCondition;
  assignNote: string | null;
  acknowledgedAt: string | null;
  returnedOn: string | null;
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  assetCount: number;
}

export interface AssetBody {
  assetTag: string | null;
  name: string;
  categoryId: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  locationId: string | null;
  purchaseDate: string | null;
  purchaseCost: number | null;
  vendor: string | null;
  warrantyUntil: string | null;
  condition: AssetCondition;
  notes: string | null;
}

export interface CategoryBody {
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
}

export const STATUS_CHIP: Record<AssetStatus, string> = {
  Available: 'chip chip-moss',
  Assigned: 'chip chip-ink',
  InRepair: 'chip chip-amber',
  Retired: 'chip chip-muted',
  Lost: 'chip chip-oxblood'
};

export const EVENT_ICON: Record<AssetEventType, string> = {
  Created: 'add_box',
  Updated: 'edit_note',
  Assigned: 'person_add_alt',
  Returned: 'assignment_return',
  StatusChanged: 'swap_horiz',
  Acknowledged: 'how_to_reg'
};

/** Category icon picker (Material Symbols naam) */
export const CATEGORY_ICONS: readonly string[] = [
  'laptop_mac', 'desktop_windows', 'monitor', 'smartphone', 'tablet_mac', 'keyboard', 'mouse', 'headphones', 'print',
  'router', 'sim_card', 'badge', 'key', 'chair', 'directions_car', 'two_wheeler', 'construction', 'inventory_2'
];
