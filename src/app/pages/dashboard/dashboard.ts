import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { ChartComponent } from '../../shared/widgets/chart/chart';
import { AmountPipe } from '../../shared/pipes/amount.pipe';
import { LanguageService } from '../../core/i18n/language.service';
import { CurrentUserService } from '../../core/auth/current-user';
import { buildDashboardData, Task, TaskKind } from './dashboard.data';
import { buildGuilloche } from './guilloche';
import { AzureTranslateService } from '../../core/services/azure-translate';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, TranslatePipe, ChartComponent, AmountPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  private readonly translate = inject(TranslateService);
  private readonly language = inject(LanguageService);

  readonly lang = this.language.language;
  readonly firstName = inject(CurrentUserService).get().name.split(' ')[0];
  readonly today = new Date();
  readonly data = buildDashboardData(this.today);
  readonly guilloche = buildGuilloche();

  readonly greetingKey = (() => {
    const h = this.today.getHours();
    return h < 12 ? 'dashboard.greeting.morning' : h < 17 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
  })();

  readonly tasks = signal<Task[]>(this.data.tasks);

  readonly attendance = this.data.attendance;
  readonly atWork = this.attendance.present + this.attendance.remote;
  readonly segments = [
    { key: 'present', value: this.attendance.present, className: 'seg-present' },
    { key: 'remote', value: this.attendance.remote, className: 'seg-remote' },
    { key: 'onLeave', value: this.attendance.onLeave, className: 'seg-leave' },
    { key: 'absent', value: this.attendance.absent, className: 'seg-absent' }
  ].map(s => ({ ...s, percent: (s.value / this.attendance.total) * 100 }));

  readonly departmentTotal = this.data.departments.reduce((sum, d) => sum + d.monthlyCost, 0);

  /** Language badle to chart labels bhi (tooltips translate hote hain). */
  private readonly langTick = toSignal(this.translate.onLangChange.pipe(map(() => Date.now()), startWith(0)), {
    initialValue: 0
  });

  readonly trendLabels = computed(() => {
    this.langTick();
    const fmt = new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { day: 'numeric', month: 'short' });
    return this.data.attendanceTrend.map(p => fmt.format(p.date));
  });

  readonly trendDatasets = computed(() => {
    this.langTick();
    const last = this.data.attendanceTrend.length - 1;
    return [
      {
        label: this.translate.instant('dashboard.attendance.rate'),
        data: this.data.attendanceTrend.map(p => p.rate),
        backgroundColor: this.data.attendanceTrend.map((_, i) => (i === last ? '#b08d3e' : '#3f5e48')),
        borderRadius: 4,
        maxBarThickness: 22
      }
    ];
  });

  readonly trendOptions = {
    scales: {
      y: { min: 80, max: 100, ticks: { callback: (v: number | string) => `${v}%`, stepSize: 5 } }
    }
  };

  readonly deptLabels = computed(() => {
    this.langTick();
    return this.data.departments.map(d => this.translate.instant(d.nameKey) as string);
  });

  readonly deptDatasets = computed(() => [
    {
      data: this.data.departments.map(d => d.monthlyCost),
      backgroundColor: this.data.departments.map(d => d.color),
      borderWidth: 2,
      borderColor: '#fbfbf8',
      hoverOffset: 4
    }
  ]);

  readonly taskIcons: Record<TaskKind, string> = {
    leave: 'event_busy',
    salary: 'trending_up',
    payroll: 'receipt_long',
    contract: 'history_edu'
  };

  readonly eventIcons: Record<string, string> = {
    payday: 'payments',
    holiday: 'flag',
    anniversary: 'workspace_premium',
    joiner: 'person_add',
    leave: 'flight_takeoff',
    contract: 'history_edu'
  };

  /** Demo: faisla list se hata deta hai. API aane pe yahan approve/decline call hogi. */
  decide(task: Task, _approved: boolean): void {
    this.tasks.update(list => list.filter(t => t.id !== task.id));
  }

  daysUntil(date: Date): number {
    const start = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    return Math.round((date.getTime() - start.getTime()) / 86_400_000);
  }
}
