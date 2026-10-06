import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, Observable, of, startWith } from 'rxjs';
import { ChartComponent } from '../../shared/widgets/chart/chart';
import { AmountPipe } from '../../shared/pipes/amount.pipe';
import { LanguageService } from '../../core/i18n/language.service';
import { CurrentUserService } from '../../core/auth/current-user';
import { buildGuilloche } from '../../shared/guilloche/guilloche';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { LeaveService } from '../leave/leave.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PayrollService } from '../payroll/payroll.service';
import { DashboardService } from './dashboard.service';
import { PayrollDashboard, PeopleDashboard, Task, TaskKind, UpcomingEvent } from './dashboard.models';

/** Ledger palette — department slices isi tarteeb se */
const DEPT_COLORS = ['#13211a', '#3f5e48', '#7d9a83', '#b08d3e', '#d8c38f', '#8e3b2e', '#5b6b61', '#c9b27a'];

/** API ki "yyyy-MM-dd" ko local date (UTC shift ke baghair) */
const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, TranslatePipe, ChartComponent, AmountPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);
  private readonly api = inject(DashboardService);
  private readonly leaves = inject(LeaveService);
  private readonly attendanceApi = inject(AttendanceService);
  private readonly alert = inject(AlertService);

  readonly lang = this.language.language;
  readonly firstName = inject(CurrentUserService).get().name.split(' ')[0];
  readonly today = new Date();
  readonly guilloche = buildGuilloche();

  readonly greetingKey = (() => {
    const h = this.today.getHours();
    return h < 12 ? 'dashboard.greeting.morning' : h < 17 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
  })();

  /** Company ka payroll sirf unhe dikhe jin ke paas payroll.view.all / payroll.approve hai */
  readonly canSeePayroll = inject(PermissionService).hasAny([P.payrollViewAll, P.payrollApprove]);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly people = signal<PeopleDashboard | null>(null);
  readonly pay = signal<PayrollDashboard | null>(null);
  /** Approve ke baad list se hatane ke liye */
  private readonly done = signal<Set<string>>(new Set());
  readonly busy = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const payroll$: Observable<PayrollDashboard | null> = this.canSeePayroll
      ? this.api.payroll().pipe(catchError(() => of(null)))   // payroll na aaye to baqi dashboard phir bhi
      : of(null);
    forkJoin({ people: this.api.people(), pay: payroll$ }).subscribe({
      next: ({ people, pay }) => {
        this.people.set(people);
        this.pay.set(pay);
        this.loadError.set(null);
        this.done.set(new Set());
        this.loading.set(false);
      },
      error: e => {
        this.loadError.set(PayrollService.errorMessage(e, this.translate.instant('dashboard.errors.load')));
        this.loading.set(false);
      }
    });
  }

  // ───── Banknote ─────
  readonly run = computed(() => this.pay()?.latestRun ?? null);
  readonly showNote = computed(() => this.canSeePayroll && !!this.run());
  readonly runStatusKey = computed(() => {
    const s = this.run()?.status;
    return `dashboard.note.status.${s === 'Approved' ? 'approved' : s === 'Paid' ? 'paid' : 'calculated'}`;
  });
  readonly periodStart = computed(() => (this.run() ? day(this.run()!.periodStart) : null));
  readonly payDate = computed(() => (this.run() ? day(this.run()!.payDate) : null));

  // ───── Aaj ─────
  readonly attendance = computed(() => this.people()?.today ?? null);
  readonly atWork = computed(() => (this.attendance() ? this.attendance()!.present + this.attendance()!.remote : 0));
  readonly segments = computed(() => {
    const a = this.attendance();
    if (!a) return [];
    return [
      { key: 'present', value: a.present, className: 'seg-present' },
      { key: 'remote', value: a.remote, className: 'seg-remote' },
      { key: 'onLeave', value: a.onLeave, className: 'seg-leave' },
      { key: 'absent', value: a.notIn, className: 'seg-absent' }
    ].map(s => ({ ...s, percent: a.total ? (s.value / a.total) * 100 : 0 }));
  });
  readonly away = computed(() =>
    (this.attendance()?.away ?? []).map(p => ({
      ...p,
      initials: p.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(''),
      until: p.until ? day(p.until) : null
    }))
  );

  readonly stats = computed(() => this.people()?.stats ?? null);

  /** Language badle to chart labels bhi (tooltips translate hote hain). */
  private readonly langTick = toSignal(this.translate.onLangChange.pipe(map(() => Date.now()), startWith(0)), {
    initialValue: 0
  });

  // ───── Charts ─────
  readonly trend = computed(() => (this.people()?.attendanceTrend ?? []).map(p => ({ date: day(p.date), rate: p.rate })));

  readonly trendLabels = computed(() => {
    this.langTick();
    const fmt = new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { day: 'numeric', month: 'short' });
    return this.trend().map(p => fmt.format(p.date));
  });

  readonly trendDatasets = computed(() => {
    this.langTick();
    const points = this.trend();
    const last = points.length - 1;
    return [
      {
        label: this.translate.instant('dashboard.attendance.rate'),
        data: points.map(p => p.rate),
        backgroundColor: points.map((_, i) => (i === last ? '#b08d3e' : '#3f5e48')),
        borderRadius: 4,
        maxBarThickness: 22
      }
    ];
  });

  /** Y axis neeche se kaata hua taake farq dikhe, lekin sab se kam din bhi poora nazar aaye */
  readonly trendOptions = computed(() => {
    const low = Math.min(100, ...this.trend().map(p => p.rate));
    const min = Math.max(0, Math.floor((low - 5) / 10) * 10);
    return {
      scales: {
        y: { min, max: 100, ticks: { callback: (v: number | string) => `${v}%`, stepSize: min >= 80 ? 5 : 10 } }
      }
    };
  });

  readonly departments = computed(() =>
    (this.pay()?.departments ?? []).map((d, i) => ({ ...d, color: DEPT_COLORS[i % DEPT_COLORS.length] }))
  );
  readonly showCost = computed(() => this.canSeePayroll && this.departments().length > 0);
  readonly departmentTotal = computed(() => this.departments().reduce((sum, d) => sum + d.monthlyCost, 0));

  readonly deptLabels = computed(() => {
    this.langTick();
    return this.departments().map(d => d.name || (this.translate.instant('dashboard.cost.unassigned') as string));
  });

  readonly deptDatasets = computed(() => [
    {
      data: this.departments().map(d => d.monthlyCost),
      backgroundColor: this.departments().map(d => d.color),
      borderWidth: 2,
      borderColor: '#fbfbf8',
      hoverOffset: 4
    }
  ]);

  // ───── Kaam ─────
  readonly tasks = computed<Task[]>(() => {
    const done = this.done();
    const list: Task[] = [];

    for (const t of this.pay()?.tasks ?? []) {
      if (t.kind === 'runApproval') {
        list.push({ id: t.id, kind: 'payroll', titleKey: 'dashboard.tasks.payrollReady', params: { count: t.count ?? 0 },
          approvable: false, link: `/app/payroll/runs/${t.id}` });
      } else {
        list.push({ id: t.id, kind: 'loan', person: t.employeeName ?? undefined,
          titleKey: t.kind === 'advanceRequest' ? 'dashboard.tasks.advanceRequest' : 'dashboard.tasks.loanRequest',
          params: { currency: t.currencyCode ?? '', amount: this.formatAmount(t.amount ?? 0) },
          approvable: false, link: '/app/payroll/loans', queryParams: { tab: 'requests' } });
      }
    }

    for (const t of this.people()?.tasks ?? []) {
      if (t.kind === 'Leave') {
        list.push({ id: t.id, kind: 'leave', person: t.employeeName, titleKey: 'dashboard.tasks.leave',
          params: { type: t.detail ?? '', days: t.days ?? 0, date: this.formatDate(t.startDate) },
          approvable: true, link: '/app/leaves', queryParams: { tab: 'approvals' } });
      } else if (t.kind === 'AttendanceRequest') {
        list.push({ id: t.id, kind: 'attendance', person: t.employeeName, titleKey: 'dashboard.tasks.attendanceRequest',
          params: { type: this.translate.instant(`attendance.requestType.${t.requestType}`), date: this.formatDate(t.startDate) },
          approvable: true, link: '/app/attendance', queryParams: { tab: t.requestType === 'Overtime' ? 'overtime' : 'requests' } });
      } else {
        list.push({ id: t.id, kind: 'probation', person: t.employeeName, titleKey: 'dashboard.tasks.probationEnds',
          params: { days: t.days ?? 0, date: this.formatDate(t.endDate) },
          approvable: false, link: `/app/employees/${t.employeeId}` });
      }
    }

    return list.filter(t => !done.has(t.id));
  });

  readonly taskIcons: Record<TaskKind, string> = {
    leave: 'event_busy',
    attendance: 'schedule',
    probation: 'verified_user',
    payroll: 'receipt_long',
    loan: 'account_balance_wallet'
  };

  approve(task: Task): void {
    const call$ = task.kind === 'leave'
      ? this.leaves.decide(task.id, true, null)
      : this.attendanceApi.approve(task.id, null, null);
    this.busy.set(task.id);
    call$.subscribe({
      next: () => {
        this.busy.set(null);
        this.done.update(s => new Set(s).add(task.id));
        this.alert.success(this.translate.instant('dashboard.tasks.approved', { name: task.person ?? '' }));
      },
      error: e => {
        this.busy.set(null);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('dashboard.errors.approve')));
      }
    });
  }

  // ───── Aane wale din ─────
  readonly upcoming = computed<UpcomingEvent[]>(() => {
    const events: UpcomingEvent[] = (this.people()?.upcoming ?? []).map(e => {
      const kind = e.kind.toLowerCase() as UpcomingEvent['kind'];
      return { date: day(e.date), kind, titleKey: `dashboard.upcoming.${kind}`, params: { name: e.name, years: e.years ?? 0 } };
    });
    const payDate = this.pay()?.nextPayDate;
    if (payDate) events.push({ date: day(payDate), kind: 'payday', titleKey: 'dashboard.upcoming.payday', params: {} });
    return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 8);
  });

  readonly eventIcons: Record<string, string> = {
    payday: 'payments',
    holiday: 'flag',
    anniversary: 'workspace_premium',
    joiner: 'person_add',
    leave: 'flight_takeoff',
    probation: 'verified_user'
  };

  daysUntil(date: Date): number {
    const start = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    return Math.round((date.getTime() - start.getTime()) / 86_400_000);
  }

  private formatDate(iso: string | null): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { day: 'numeric', month: 'short' }).format(day(iso));
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat(`${this.lang()}-u-nu-latn`, { maximumFractionDigits: 0 }).format(value);
  }
}
