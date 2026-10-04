import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { PeopleService } from '../people/people.service';
import { Department } from '../people/people.models';
import { AttendanceService } from './attendance.service';
import {
  ATTENDANCE_STATUSES, ATTENDANCE_STATUS_CHIP, AttendanceDay, AttendanceDayDetail, AttendanceStatus, AttendanceSummary,
  MyToday, Paged, addDays, hm, isoDate
} from './attendance.models';
import { RosterTabComponent } from './roster/roster-tab';
import { RequestsTabComponent } from './requests/requests-tab';

type Tab = 'timesheet' | 'roster' | 'overtime' | 'requests';

/**
 * Attendance: upar "aaj" ka clock card, neeche 4 tabs.
 * Backend khud scope karta hai — employee ko apna, manager ko team, HR (employees.view) ko sab.
 */
@Component({
  selector: 'app-attendance',
  imports: [DatePipe, FormsModule, TranslatePipe, RosterTabComponent, RequestsTabComponent],
  templateUrl: './attendance.html',
  styleUrl: './attendance.css'
})
export class AttendanceComponent {
  private readonly api = inject(AttendanceService);
  private readonly people = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly perms = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  readonly chip = ATTENDANCE_STATUS_CHIP;
  readonly statuses = ATTENDANCE_STATUSES;
  readonly hm = hm;
  readonly canViewAll = this.perms.hasAny(P.employeesView);
  readonly canManage = this.perms.hasAny([P.employeesEdit, P.settingsManage]);
  readonly tabs: Tab[] = ['timesheet', 'roster', 'overtime', 'requests'];
  readonly tab = signal<Tab>('timesheet');

  private readonly requestsTab = viewChild<RequestsTabComponent>('requestsTab');

  // ── Today ──
  readonly today = signal<MyToday | null>(null);
  readonly notLinked = signal<string | null>(null);
  readonly clocking = signal(false);
  readonly now = signal(new Date());
  readonly canClock = computed(() => this.today()?.allowedSources.includes('Web') ?? false);
  /** Clock in ke baad se ab tak (out se pehle) — card pe chalti ghari. */
  readonly runningMinutes = computed(() => {
    const t = this.today();
    const first = t?.punches.find(p => !p.isIgnored);
    if (!t || !first || t.nextAction !== 'Out' || t.day?.lastOut) return t?.day?.workedMinutes ?? 0;
    return Math.max(0, Math.floor((this.now().getTime() - new Date(first.punchedAt).getTime()) / 60000));
  });

  // ── Timesheet ──
  readonly departments = signal<Department[]>([]);
  readonly sheet = signal<Paged<AttendanceDay> | null>(null);
  readonly loading = signal(false);
  filter = {
    from: isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: isoDate(new Date()),
    status: '' as AttendanceStatus | '',
    departmentId: '',
    lateOnly: false
  };
  readonly page = signal(1);
  readonly pageSize = 50;
  readonly pages = computed(() => Math.max(1, Math.ceil((this.sheet()?.totalCount ?? 0) / this.pageSize)));

  // Day overview (HR)
  summaryDate = isoDate(new Date());
  readonly summary = signal<AttendanceSummary | null>(null);
  readonly processing = signal(false);

  // ── Day drawer ──
  readonly detail = signal<AttendanceDayDetail | null>(null);
  readonly saving = signal(false);
  ignoringId: string | null = null;
  ignoreReason = '';
  punchForm = { time: '', note: '' };
  overrideForm = { status: 'Present' as AttendanceStatus, remarks: '' };
  readonly drawerMode = signal<'view' | 'punch' | 'override'>('view');

  constructor() {
    this.loadToday();
    this.loadSheet();
    if (this.canViewAll) {
      this.loadSummary();
      this.people.getDepartments().subscribe({ next: d => this.departments.set(d.filter(x => x.isActive)) });
    }
    const timer = setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  // ───── Today / clock ─────
  loadToday(): void {
    this.api.today().subscribe({
      next: t => {
        this.today.set(t);
        this.notLinked.set(null);
      },
      error: e => this.notLinked.set(PayrollService.errorMessage(e, this.translate.instant('attendance.errors.load')))
    });
  }

  clock(): void {
    const t = this.today();
    if (!t) return;
    this.clocking.set(true);
    const send = (lat: number | null, lng: number | null) =>
      this.api.clock({ source: 'Web', latitude: lat, longitude: lng, note: null }).subscribe({
        next: res => {
          this.clocking.set(false);
          this.today.set(res);
          this.alert.success(this.translate.instant(t.nextAction === 'In' ? 'attendance.today.inDone' : 'attendance.today.outDone'));
          this.loadSheet();
        },
        error: e => {
          this.clocking.set(false);
          this.fail(e, 'attendance.errors.clock');
        }
      });

    if (!t.requiresLocation) {
      send(null, null);
      return;
    }
    if (!navigator.geolocation) {
      this.clocking.set(false);
      this.alert.error(this.translate.instant('attendance.errors.location'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => send(+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6)),
      () => {
        this.clocking.set(false);
        this.alert.error(this.translate.instant('attendance.errors.location'));
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  // ───── Timesheet ─────
  setTab(t: Tab): void {
    this.tab.set(t);
  }

  applyFilter(): void {
    if (this.filter.to < this.filter.from) this.filter.to = this.filter.from;
    this.page.set(1);
    this.loadSheet();
  }

  goPage(p: number): void {
    this.page.set(p);
    this.loadSheet();
  }

  loadSheet(): void {
    const f = this.filter;
    this.loading.set(true);
    this.api.timesheet({ ...f, page: this.page(), pageSize: this.pageSize }).subscribe({
      next: s => {
        this.sheet.set(s);
        this.loading.set(false);
      },
      error: e => {
        this.loading.set(false);
        this.fail(e, 'attendance.errors.load');
      }
    });
  }

  loadSummary(): void {
    this.api.summary(this.summaryDate).subscribe({ next: s => this.summary.set(s), error: () => this.summary.set(null) });
  }

  shiftSummary(delta: number): void {
    this.summaryDate = addDays(this.summaryDate, delta);
    this.loadSummary();
  }

  count(status: AttendanceStatus): number {
    return this.summary()?.byStatus[status] ?? 0;
  }

  /** Us din ka roster/punches dobara chala kar totals (HR — roster badla ho ya machine late sync hui ho). */
  process(): void {
    this.processing.set(true);
    this.api.process(this.summaryDate, null).subscribe({
      next: n => {
        this.processing.set(false);
        this.alert.success(this.translate.instant('attendance.overview.processed', { n }));
        this.loadSummary();
        this.loadSheet();
      },
      error: e => {
        this.processing.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  isMine(d: AttendanceDay): boolean {
    return d.employeeId === this.today()?.employeeId;
  }

  // ───── Day drawer ─────
  openDay(d: AttendanceDay): void {
    this.drawerMode.set('view');
    this.ignoringId = null;
    this.api.day(d.id).subscribe({
      next: det => this.detail.set(det),
      error: e => this.fail(e, 'attendance.errors.load')
    });
  }

  closeDay(): void {
    this.detail.set(null);
  }

  private refreshDay(): void {
    const det = this.detail();
    if (det) this.api.day(det.day.id).subscribe({ next: d => this.detail.set(d) });
    this.loadSheet();
    this.loadToday();
  }

  startPunch(): void {
    const det = this.detail()!;
    this.punchForm = { time: det.day.scheduledStart ? this.localTime(det.day.scheduledStart) : '09:00', note: '' };
    this.drawerMode.set('punch');
  }

  savePunch(): void {
    const det = this.detail()!;
    const [y, m, d] = det.day.workDate.split('-').map(Number);
    const [hh, mm] = this.punchForm.time.split(':').map(Number);
    let at = new Date(y, m - 1, d, hh, mm);
    // Raat ki shift: scheduled start se pehle ka waqt agle din ka hai
    if (det.day.scheduledStart && det.day.scheduledEnd && new Date(det.day.scheduledEnd).getDate() !== new Date(det.day.scheduledStart).getDate()
        && this.punchForm.time < this.localTime(det.day.scheduledStart)) {
      at = new Date(y, m - 1, d + 1, hh, mm);
    }
    this.run(this.api.addPunch(det.day.employeeId, at.toISOString(), this.punchForm.note.trim()), () => this.drawerMode.set('view'));
  }

  ignore(punchId: string): void {
    const det = this.detail()!;
    this.run(this.api.ignorePunch(det.day.id, punchId, this.ignoreReason.trim()), () => (this.ignoringId = null));
  }

  startOverride(): void {
    const det = this.detail()!;
    this.overrideForm = { status: det.day.status, remarks: det.day.remarks ?? '' };
    this.drawerMode.set('override');
  }

  saveOverride(): void {
    const det = this.detail()!;
    this.run(this.api.overrideDay(det.day.id, this.overrideForm.status, this.overrideForm.remarks.trim()), () => this.drawerMode.set('view'));
  }

  requestCorrection(): void {
    const det = this.detail()!;
    this.closeDay();
    this.tab.set('requests');
    // Tab render hone ke baad
    setTimeout(() => this.requestsTab()?.openSubmit(det.day.workDate, det.day.firstIn, det.day.lastOut));
  }

  private run(req: Observable<unknown>, after: () => void): void {
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
        after();
        this.refreshDay();
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  private localTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private fail(e: unknown, key: string): void {
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(key)));
  }
}
