import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { AttendanceService } from '../attendance.service';
import {
  AttendanceRequest, AttendanceRequestScope, AttendanceRequestStatus, AttendanceRequestType, Paged, REQUEST_STATUS_CHIP, hm, isoDate
} from '../attendance.models';

/** Overtime aur Corrections & requests tabs — ek hi table, `overtime` input se filter. */
@Component({
  selector: 'app-requests-tab',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './requests-tab.html',
  styleUrl: './requests-tab.css'
})
export class RequestsTabComponent implements OnInit {
  private readonly api = inject(AttendanceService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly overtime = input(false);
  readonly canViewAll = input(false);

  readonly lang = inject(LanguageService).language;
  readonly chip = REQUEST_STATUS_CHIP;
  readonly hm = hm;
  readonly statuses: AttendanceRequestStatus[] = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
  readonly types: AttendanceRequestType[] = ['Correction', 'WorkFromHome', 'OnDuty'];
  readonly scopes = computed<AttendanceRequestScope[]>(() => (this.canViewAll() ? ['Mine', 'Approvals', 'All'] : ['Mine', 'Approvals']));

  readonly scope = signal<AttendanceRequestScope>('Mine');
  status: AttendanceRequestStatus | '' = '';
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly data = signal<Paged<AttendanceRequest> | null>(null);
  readonly pages = computed(() => Math.max(1, Math.ceil((this.data()?.totalCount ?? 0) / this.pageSize)));
  readonly loading = signal(false);
  readonly busy = signal<string | null>(null);
  /** Approvals tab pe badge */
  readonly pendingCount = signal(0);

  // Decide inline
  decidingId: string | null = null;
  decision = { approve: true, comment: '', minutes: null as number | null };

  // Submit drawer
  readonly submitting = signal(false);
  readonly saving = signal(false);
  form = { workDate: isoDate(new Date()), type: 'Correction' as AttendanceRequestType, inTime: '', outTime: '', minutes: null as number | null, reason: '' };

  ngOnInit(): void {
    this.load();
    this.loadPendingCount();
  }

  setScope(s: AttendanceRequestScope): void {
    this.scope.set(s);
    this.page.set(1);
    this.decidingId = null;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.requests({ scope: this.scope(), overtime: this.overtime(), status: this.status, page: this.page(), pageSize: this.pageSize }).subscribe({
      next: d => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: e => {
        this.loading.set(false);
        this.data.set(null);
        this.fail(e, 'attendance.errors.load');
      }
    });
  }

  private loadPendingCount(): void {
    this.api.requests({ scope: 'Approvals', overtime: this.overtime(), status: 'Pending', page: 1, pageSize: 1 }).subscribe({
      next: d => this.pendingCount.set(d.totalCount),
      error: () => this.pendingCount.set(0)
    });
  }

  goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  // ── Submit ──
  /** Timesheet ke din se "Request correction" — date aur jo punches hain wo pehle se bhar do. */
  openSubmit(workDate?: string, firstIn?: string | null, lastOut?: string | null): void {
    this.form = {
      workDate: workDate ?? isoDate(new Date()), type: 'Correction',
      inTime: firstIn ? this.localTime(firstIn) : '', outTime: lastOut ? this.localTime(lastOut) : '',
      minutes: null, reason: ''
    };
    this.submitting.set(true);
  }

  validSubmit(): boolean {
    const f = this.form;
    if (!f.workDate) return false;
    if (this.overtime()) return f.minutes === null || (f.minutes as unknown) === '' || +f.minutes > 0;
    return !!(f.reason.trim() && (f.inTime || f.outTime));
  }

  submit(): void {
    const f = this.form;
    let req: Observable<unknown>;
    if (this.overtime()) {
      const mins = f.minutes === null || (f.minutes as unknown) === '' ? null : +f.minutes;
      req = this.api.submitOvertime({ workDate: f.workDate, minutes: mins, reason: f.reason.trim() || null });
    } else {
      const inAt = f.inTime ? this.at(f.workDate, f.inTime, false) : null;
      // Out in se pehle ho to raat ki shift — agla din
      const outAt = f.outTime ? this.at(f.workDate, f.outTime, !!f.inTime && f.outTime <= f.inTime) : null;
      req = this.api.submitRequest({ workDate: f.workDate, type: f.type, requestedIn: inAt, requestedOut: outAt, reason: f.reason.trim() });
    }
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.submitting.set(false);
        this.alert.success(this.translate.instant('leave.submitted'));
        this.setScope('Mine');
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  // ── Decide / cancel ──
  startDecide(r: AttendanceRequest, approve: boolean): void {
    this.decidingId = r.id;
    this.decision = { approve, comment: '', minutes: approve && r.type === 'Overtime' ? r.overtimeMinutes : null };
  }

  decide(r: AttendanceRequest): void {
    const d = this.decision;
    const mins = d.minutes === null || (d.minutes as unknown) === '' ? null : +d.minutes;
    const req = d.approve ? this.api.approve(r.id, d.comment.trim() || null, mins) : this.api.reject(r.id, d.comment.trim());
    this.act(r, req, d.approve ? 'attendance.requests.approvedMsg' : 'attendance.requests.rejectedMsg');
  }

  cancel(r: AttendanceRequest): void {
    this.act(r, this.api.cancel(r.id), 'attendance.requests.cancelledMsg');
  }

  private act(r: AttendanceRequest, req: Observable<unknown>, msg: string): void {
    this.busy.set(r.id);
    req.subscribe({
      next: () => {
        this.busy.set(null);
        this.decidingId = null;
        this.alert.success(this.translate.instant(msg, { name: r.employeeName }));
        this.load();
        this.loadPendingCount();
      },
      error: e => {
        this.busy.set(null);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  private at(date: string, time: string, nextDay: boolean): string {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d + (nextDay ? 1 : 0), hh, mm).toISOString();
  }

  private localTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private fail(e: unknown, key: string): void {
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(key)));
  }
}
