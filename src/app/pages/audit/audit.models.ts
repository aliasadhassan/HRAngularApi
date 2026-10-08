/** Audit page: teeno services (people / payroll / access) ka ek jaisa shape — HR.Shared.Library AuditQueries. */

export type AuditSource = 'people' | 'payroll' | 'access';
export type AuditAction = 'Created' | 'Updated' | 'Deleted';

export const AUDIT_SOURCES: readonly AuditSource[] = ['people', 'payroll', 'access'];
export const AUDIT_ACTIONS: readonly AuditAction[] = ['Created', 'Updated', 'Deleted'];

export const ACTION_CHIP: Record<AuditAction, string> = { Created: 'chip-moss', Updated: 'chip-amber', Deleted: 'chip-oxblood' };
export const ACTION_ICON: Record<AuditAction, string> = { Created: 'add_circle', Updated: 'edit', Deleted: 'delete' };
export const SOURCE_ICON: Record<AuditSource, string> = { people: 'groups', payroll: 'payments', access: 'admin_panel_settings' };

export interface AuditFieldChange {
  field: string;
  old: string | null;
  new: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string | null;
  userName: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  subjectEmployeeId: string | null;
  subjectName: string | null;
  operation: string | null;
  correlationId: string;
  changes: AuditFieldChange[];
}

/** Angular mein: kis service se aaya */
export interface SourcedEntry extends AuditEntry {
  source: AuditSource;
}

export interface AuditPage {
  items: AuditEntry[];
  next: string | null;
}

export interface AuditCount {
  key: string;
  count: number;
}

export interface AuditUserCount {
  userId: string | null;
  userName: string | null;
  count: number;
}

export interface AuditDay {
  date: string;
  created: number;
  updated: number;
  deleted: number;
}

export interface AuditSummary {
  days: number;
  total: number;
  created: number;
  updated: number;
  deleted: number;
  operations: number;
  activeUsers: number;
  byDay: AuditDay[];
  topUsers: AuditUserCount[];
  topEntities: AuditCount[];
}

export interface AuditQuery {
  before?: string | null;
  from?: string | null;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  action?: AuditAction | '';
  search?: string;
  limit?: number;
}

/** Ek request ke saare badlaav = Activity mein ek line */
export interface AuditOperation {
  key: string;
  at: string;
  source: AuditSource;
  userId: string | null;
  userName: string | null;
  operation: string | null;
  entries: SourcedEntry[];
}

/** "LeaveRequestApproval" → "Leave request approval" (jab tarjuma na ho) */
export function humanize(name: string): string {
  const words = name.replace(/\./g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export type ValueKind = 'empty' | 'text' | 'id' | 'datetime' | 'bool' | 'hidden';

export function valueKind(v: string | null): ValueKind {
  if (v === null || v === '') return 'empty';
  if (v.startsWith('••••')) return 'hidden';
  if (v === 'true' || v === 'false') return 'bool';
  if (GUID.test(v)) return 'id';
  if (ISO.test(v)) return 'datetime';
  return 'text';
}

/** Server ke "lucky" cursors se: jitni rows pakki hain (har source ki agli page is se purani hogi) */
export function watermark(next: Partial<Record<AuditSource, string | null>>): number {
  let mark = -Infinity;
  for (const v of Object.values(next)) if (v) mark = Math.max(mark, new Date(v).getTime());
  return mark;
}
