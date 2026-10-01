import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../core/i18n/language.service';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { AdminService } from '../admin.service';
import { LoginActivityItem, LoginActivitySummary, LoginMethod, describeDevice, utc } from '../admin.models';

type Outcome = 'all' | 'success' | 'failed';

@Component({
  selector: 'app-login-activity',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './login-activity.html',
  styleUrl: './login-activity.css'
})
export class LoginActivityComponent {
  private readonly api = inject(AdminService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly lang = inject(LanguageService).language;
  readonly describeDevice = describeDevice;
  readonly utc = utc;
  readonly ranges = [1, 7, 30, 90];
  readonly outcomes: Outcome[] = ['all', 'success', 'failed'];

  readonly items = signal<LoginActivityItem[]>([]);
  readonly total = signal(0);
  readonly summary = signal<LoginActivitySummary | null>(null);
  readonly loading = signal(true);

  readonly days = signal(7);
  readonly outcome = signal<Outcome>('all');
  readonly page = signal(1);
  readonly pageSize = 25;
  method: LoginMethod | '' = '';
  search = '';

  /** Users page se "sign-in history" pe aaye to sirf us user ki */
  readonly userId = signal<string | null>(inject(ActivatedRoute).snapshot.queryParamMap.get('userId'));
  readonly userLabel = signal<string | null>(null);

  private readonly searchChanged = new Subject<void>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly rangeFrom = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize + 1));
  readonly rangeTo = computed(() => Math.min(this.page() * this.pageSize, this.total()));
  readonly failureRate = computed(() => {
    const s = this.summary();
    if (!s || s.signIns + s.failed === 0) return 0;
    return Math.round((s.failed / (s.signIns + s.failed)) * 100);
  });

  constructor() {
    this.searchChanged.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
    this.reload();
  }

  reload(resetPage = true): void {
    if (resetPage) this.page.set(1);
    this.loading.set(true);

    const o = this.outcome();
    this.api
      .getLoginActivity({
        userId: this.userId() ?? undefined,
        search: this.search,
        succeeded: o === 'all' ? null : o === 'success',
        method: this.method,
        days: this.days(),
        page: this.page(),
        pageSize: this.pageSize
      })
      .subscribe({
        next: res => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
          if (this.userId() && !this.userLabel()) {
            const first = res.items[0];
            this.userLabel.set(first ? first.userName ?? first.emailAttempted : null);
          }
        },
        error: err => {
          this.loading.set(false);
          this.alert.error(PayrollService.errorMessage(err, this.translate.instant('admin.activity.errorLoad')));
        }
      });

    if (resetPage) {
      this.api.getLoginSummary(this.days()).subscribe({ next: s => this.summary.set(s), error: () => this.summary.set(null) });
    }
  }

  setDays(days: number): void {
    this.days.set(days);
    this.reload();
  }

  setOutcome(outcome: Outcome): void {
    this.outcome.set(outcome);
    this.reload();
  }

  onSearch(): void {
    this.searchChanged.next();
  }

  clearUser(): void {
    this.userId.set(null);
    this.userLabel.set(null);
    this.router.navigate([], { queryParams: {} });
    this.reload();
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page.set(page);
    this.reload(false);
  }

  reasonKey(item: LoginActivityItem): string {
    return item.succeeded ? 'admin.activity.reason.success' : `admin.activity.reason.${item.failureReason ?? 'Unknown'}`;
  }

  /** "aaj 14:02" / "kal 09:10" / "3 Oct 14:02" */
  dayLabel(item: LoginActivityItem): string | null {
    const d = utc(item.occurredAt);
    if (!d) return null;
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    return diff === 0 ? 'admin.activity.today' : diff === 1 ? 'admin.activity.yesterday' : null;
  }
}
