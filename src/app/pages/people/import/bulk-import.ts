import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../people.service';
import { DEFAULT_PAGE_SIZE, PaginationComponent } from '../../../shared/pagination/pagination';
import { BulkImportService, IMPORT_COLUMNS, ImportError, ImportKind, ImportResult, MAX_IMPORT_BYTES } from './bulk-import.service';

const KINDS: ImportKind[] = ['locations', 'departments', 'designations', 'employees'];

/** Har tab ke checks (i18n import.checks.<kind>.<n>) — user ko pehle se pata ho kya roka jayega. */
const CHECKS: Record<ImportKind, number> = { locations: 5, departments: 5, designations: 3, employees: 7 };

/**
 * Bulk import: Excel template download → bhar kar upload → server poori file check karta hai.
 * Ek bhi ghalti = kuch save nahi, row-wise list dikhti hai. Sab theek = sab rows ek saath (ek transaction) DB mein.
 */
@Component({
  selector: 'app-bulk-import',
  imports: [TranslatePipe, DecimalPipe, RouterLink, PaginationComponent],
  templateUrl: './bulk-import.html',
  styleUrl: './bulk-import.css'
})
export class BulkImportComponent {
  private readonly api = inject(BulkImportService);
  private readonly people = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly kinds = KINDS;
  readonly kind = signal<ImportKind>('locations');
  readonly columns = computed(() => IMPORT_COLUMNS[this.kind()]);
  readonly checks = computed(() => Array.from({ length: CHECKS[this.kind()] }, (_, i) => i + 1));

  readonly file = signal<File | null>(null);
  readonly dragging = signal(false);
  readonly busy = signal<'template' | 'check' | 'import' | null>(null);
  readonly result = signal<ImportResult | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly pagedErrors = computed(() => {
    const errors = this.result()?.errors ?? [];
    const start = (this.page() - 1) * this.pageSize();
    return errors.slice(start, start + this.pageSize());
  });
  readonly badRows = computed(() => new Set((this.result()?.errors ?? []).map(e => e.row)).size);

  constructor() {
    const tab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as ImportKind | null;
    if (tab && KINDS.includes(tab)) this.kind.set(tab);
  }

  setKind(kind: ImportKind): void {
    if (this.busy() === 'import' || kind === this.kind()) return;
    this.kind.set(kind);
    this.clearFile();
    this.router.navigate([], { queryParams: { tab: kind }, replaceUrl: true });
  }

  // ───── Template ─────
  downloadTemplate(): void {
    const kind = this.kind();
    this.busy.set('template');
    this.api.template(kind).subscribe({
      next: blob => {
        this.busy.set(null);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${kind}-import-template.xlsx`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => {
        this.busy.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('import.errors.template')));
      }
    });
  }

  // ───── File pick / drop ─────
  onPick(input: HTMLInputElement): void {
    this.setFile(input.files?.[0] ?? null);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  private setFile(file: File | null): void {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.alert.warning(this.translate.instant('import.errors.notXlsx'));
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      this.alert.warning(this.translate.instant('import.errors.tooBig'));
      return;
    }
    this.file.set(file);
    this.result.set(null);
  }

  clearFile(): void {
    this.file.set(null);
    this.result.set(null);
  }

  // ───── Check / import ─────
  run(dryRun: boolean): void {
    const file = this.file();
    if (!file || this.busy()) return;
    const kind = this.kind();
    this.busy.set(dryRun ? 'check' : 'import');
    this.result.set(null);

    this.api.upload(kind, file, dryRun).subscribe({
      next: r => {
        this.busy.set(null);
        this.page.set(1);
        this.result.set(r);
        // Nateeja steps ke neeche aata hai — wahan tak scroll
        setTimeout(() => document.querySelector('.import-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        const what = this.translate.instant('import.what.' + kind);
        const n = (v: number) => v.toLocaleString('en-US');
        if (!r.succeeded) {
          this.alert.warning(this.translate.instant('import.toast.failed', { count: n(r.errorCount) }));
        } else if (dryRun) {
          this.alert.info(this.translate.instant('import.toast.checked', { count: n(r.totalRows), what }));
        } else {
          this.alert.success(this.translate.instant('import.toast.done', { count: n(r.imported), what }));
          this.file.set(null);
          // Organization dropdowns ka cache purana ho gaya
          if (kind === 'departments') this.people.getDepartments(true).subscribe();
          if (kind === 'designations') this.people.getDesignations(true).subscribe();
          if (kind === 'locations') this.people.getLocations(true).subscribe();
        }
      },
      error: e => {
        this.busy.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('import.errors.upload')));
      }
    });
  }

  // ───── Error list ─────
  /** Server ka English header → is zubaan ka column naam */
  columnLabel(header: string | null): string {
    if (!header) return '—';
    const col = this.columns().find(c => c.header === header);
    return col ? this.translate.instant(`import.columns.${this.kind()}.${col.key}`) : header;
  }

  message(e: ImportError): string {
    const key = 'import.errors.' + e.code;
    const text = this.translate.instant(key, { ...(e.args ?? {}), column: this.columnLabel(e.column) });
    return text === key ? e.message : text;
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  /** Ghaltiyon ki list CSV — Excel mein khol kar file theek karna aasaan */
  downloadErrors(): void {
    const r = this.result();
    if (!r) return;
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Row', 'Column', 'Value', 'Problem'].map(quote).join(','),
      ...r.errors.map(e => [e.row, e.column ?? '', e.value ?? '', e.message].map(quote).join(','))
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.kind()}-import-errors.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  fileSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /** Kaamyabi ke baad kahan dekhein */
  readonly viewLink = computed(() => (this.kind() === 'employees' ? '/app/employees' : '/app/organization'));
  readonly viewParams = computed(() => (this.kind() === 'employees' ? {} : { tab: this.kind() }));
}
