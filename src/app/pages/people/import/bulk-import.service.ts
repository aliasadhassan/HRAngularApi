import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ImportKind = 'locations' | 'departments' | 'designations' | 'employees';

export interface ImportError {
  row: number;
  column: string | null;
  value: string | null;
  code: string;
  message: string;
  args: Record<string, string> | null;
}

/** succeeded=false → DB mein kuch nahi gaya (poori file ya kuch nahi). */
export interface ImportResult {
  kind: string;
  dryRun: boolean;
  succeeded: boolean;
  totalRows: number;
  imported: number;
  errorCount: number;
  errors: ImportError[];
}

export interface ImportColumn {
  key: string;
  /** Excel template ka header (English) — server errors isi naam se aate hain */
  header: string;
  required: boolean;
}

/** Server ke ImportColumn (Application/Imports/*Import.cs) ke saath 1:1. */
export const IMPORT_COLUMNS: Record<ImportKind, ImportColumn[]> = {
  locations: [
    { key: 'code', header: 'Code', required: true },
    { key: 'name', header: 'Name', required: true },
    { key: 'country', header: 'Country', required: true },
    { key: 'timezone', header: 'Time zone', required: true },
    { key: 'city', header: 'City', required: false },
    { key: 'address', header: 'Address', required: false },
    { key: 'workweek', header: 'Work week', required: false },
    { key: 'headoffice', header: 'Head office', required: false }
  ],
  departments: [
    { key: 'code', header: 'Code', required: true },
    { key: 'name', header: 'Name', required: true },
    { key: 'description', header: 'Description', required: false },
    { key: 'parent', header: 'Parent department', required: false },
    { key: 'head', header: 'Head', required: false }
  ],
  designations: [
    { key: 'title', header: 'Title', required: true },
    { key: 'level', header: 'Level', required: false },
    { key: 'description', header: 'Description', required: false }
  ],
  employees: [
    { key: 'employeecode', header: 'Employee code', required: false },
    { key: 'firstname', header: 'First name', required: true },
    { key: 'middlename', header: 'Middle name', required: false },
    { key: 'lastname', header: 'Last name', required: true },
    { key: 'workemail', header: 'Work email', required: true },
    { key: 'personalemail', header: 'Personal email', required: false },
    { key: 'mobile', header: 'Mobile', required: false },
    { key: 'gender', header: 'Gender', required: false },
    { key: 'dateofbirth', header: 'Date of birth', required: false },
    { key: 'department', header: 'Department', required: true },
    { key: 'designation', header: 'Designation', required: true },
    { key: 'location', header: 'Location', required: true },
    { key: 'manager', header: 'Manager', required: false },
    { key: 'employmenttype', header: 'Employment type', required: true },
    { key: 'joiningdate', header: 'Joining date', required: true },
    { key: 'probationenddate', header: 'Probation end date', required: false }
  ]
};

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Gateway /imports/{x} → Employee API /api/imports/{x}. */
@Injectable({ providedIn: 'root' })
export class BulkImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/imports`;

  template(kind: ImportKind): Observable<Blob> {
    return this.http.get(`${this.base}/${kind}/template`, { responseType: 'blob' });
  }

  upload(kind: ImportKind, file: File, dryRun: boolean): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportResult>(`${this.base}/${kind}`, form, { params: { dryRun } });
  }
}
