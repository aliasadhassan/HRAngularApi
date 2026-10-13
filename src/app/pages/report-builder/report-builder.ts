import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { ReportBuilderService } from './rb.service';
import {
  CATEGORIES, CATEGORY_ICON, Home, IssuedLetterItem, LANGUAGE_MODES, LetterCategory, LetterLanguages, ReportSource, SavedReport,
  TEMPLATE_CHIP, TemplateListItem, sourceLabel
} from './rb.models';
import { STARTERS, STARTER_CATEGORY, StarterKey, starterHtml } from './rb-starters';

type Tab = 'all' | 'reports' | 'templates' | 'letters';
const TABS: readonly Tab[] = ['all', 'reports', 'templates', 'letters'];

interface Card {
  kind: 'report' | 'template';
  id: string;
  name: string;
  description: string | null;
  data: string;
  last: string | null;
  lang: string;
  report?: SavedReport;
  template?: TemplateListItem;
}

interface NewTemplate {
  name: string;
  category: LetterCategory;
  languages: LetterLanguages;
  starter: StarterKey;
}

@Component({
  selector: 'app-report-builder',
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './report-builder.html',
  styleUrls: ['./rb-shared.css', './report-builder.css']
})
export class ReportBuilderComponent {
  private readonly api = inject(ReportBuilderService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly tabs = TABS;
  readonly categories = CATEGORIES;
  readonly languageModes = LANGUAGE_MODES;
  readonly starters = STARTERS;
  readonly categoryIcon = CATEGORY_ICON;
  readonly templateChip = TEMPLATE_CHIP;

  readonly home = signal<Home | null>(null);
  readonly payrollSources = signal<ReportSource[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('all');
  readonly search = signal('');

  readonly letters = signal<IssuedLetterItem[] | null>(null);
  readonly lettersLoading = signal(false);
  lettersSearch = '';
  private readonly lettersSearch$ = new Subject<void>();

  /** Kaun sa card ka "…" menu khula hai */
  readonly menu = signal<string | null>(null);
  confirm: string | null = null;
  busy = false;

  newTemplate: NewTemplate | null = null;

  readonly canBuild = computed(() => this.home()?.canBuild ?? false);
  readonly canIssue = computed(() => this.home()?.canIssue ?? false);
  readonly canLetters = computed(() => this.canBuild() || this.canIssue());

  private readonly allSources = computed(() => [...(this.home()?.sources ?? []), ...this.payrollSources()]);

  readonly cards = computed<Card[]>(() => {
    const h = this.home();
    if (!h) return [];
    this.lang();
    const tr = (k: string) => this.translate.instant(k);
    const reports: Card[] = h.reports.map(r => ({
      kind: 'report', id: r.id, name: r.name, description: r.description, report: r,
      data: sourceLabel(tr, this.lang(), this.allSources().find(s => s.key === r.source), this.sourceFallback(r.source)),
      last: r.lastRunAt, lang: ''
    }));
    const templates: Card[] = h.templates.map(t => ({
      kind: 'template', id: t.id, name: t.name, description: t.description, template: t,
      data: tr('rb.cat.' + t.category), last: t.lastIssuedAt,
      lang: t.languages === 'Both' ? 'EN · AR' : t.languages === 'Arabic' ? 'AR' : 'EN'
    }));
    const q = this.search().trim().toLowerCase();
    const list = this.tab() === 'reports' ? reports : this.tab() === 'templates' ? templates : [...reports, ...templates];
    return q ? list.filter(c => `${c.name} ${c.description ?? ''} ${c.data}`.toLowerCase().includes(q)) : list;
  });

  readonly counts = computed(() => {
    const h = this.home();
    return { reports: h?.reports.length ?? 0, templates: h?.templates.length ?? 0 };
  });

  constructor() {
    const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (t && TABS.includes(t)) this.tab.set(t);
    this.lettersSearch$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadLetters());
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.home().subscribe({
      next: h => {
        this.home.set(h);
        this.loading.set(false);
        if (h.canSeePayroll) this.api.payrollSources().subscribe({ next: s => this.payrollSources.set(s), error: () => {} });
        if (this.tab() === 'letters') this.loadLetters();
      },
      error: e => {
        this.loading.set(false);
        this.error.set(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
      }
    });
  }

  show(tab: Tab): void {
    this.tab.set(tab);
    this.menu.set(null);
    this.router.navigate([], { queryParams: { tab: tab === 'all' ? null : tab }, replaceUrl: true });
    if (tab === 'letters' && !this.letters()) this.loadLetters();
  }

  loadLetters(): void {
    this.lettersLoading.set(true);
    this.api.letters({ search: this.lettersSearch }).subscribe({
      next: l => {
        this.letters.set(l);
        this.lettersLoading.set(false);
      },
      error: e => {
        this.lettersLoading.set(false);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
      }
    });
  }

  onLettersSearch(): void {
    this.lettersSearch$.next();
  }

  private sourceFallback(source: string): string {
    return source.replace(/^(employee|payroll):/, '');
  }

  toggleMenu(id: string, ev: Event): void {
    ev.stopPropagation();
    this.confirm = null;
    this.menu.set(this.menu() === id ? null : id);
  }

  closeMenu(): void {
    this.menu.set(null);
    this.confirm = null;
  }

  // ───── Reports ─────
  openReport(c: Card): void {
    this.router.navigate(['/app/reports/builder/report', c.id]);
  }

  deleteReport(c: Card): void {
    if (this.confirm !== 'del:' + c.id) {
      this.confirm = 'del:' + c.id;
      return;
    }
    this.busy = true;
    this.api.deleteReport(c.id).subscribe({
      next: () => this.done('rb.deleted'),
      error: e => this.fail(e)
    });
  }

  // ───── Templates ─────
  startTemplate(): void {
    this.newTemplate = { name: '', category: 'Experience', languages: 'Both', starter: 'experience' };
  }

  pickStarter(s: StarterKey): void {
    if (!this.newTemplate) return;
    this.newTemplate.starter = s;
    this.newTemplate.category = STARTER_CATEGORY[s];
    if (!this.newTemplate.name.trim() || this.isStarterName(this.newTemplate.name)) {
      this.newTemplate.name = s === 'blank' ? '' : this.translate.instant('rb.starter.' + s);
    }
  }

  private isStarterName(name: string): boolean {
    return STARTERS.some(s => this.translate.instant('rb.starter.' + s) === name);
  }

  createTemplate(): void {
    const n = this.newTemplate;
    if (!n || !n.name.trim()) return;
    const tr = (k: string) => this.translate.instant(k);
    const htmlEn = n.languages !== 'Arabic' ? starterHtml(n.starter, 'en', tr) || null : null;
    const htmlAr = n.languages !== 'English' ? starterHtml(n.starter, 'ar', tr) || null : null;
    this.busy = true;
    this.api.createTemplate({
      name: n.name.trim(), description: null, category: n.category, languages: n.languages, paper: 'A4',
      showLetterhead: true, showPageNumbers: false, refPrefix: null, signatoryName: null, signatoryTitle: null
    }, htmlEn, htmlAr).subscribe({
      next: r => {
        this.busy = false;
        this.newTemplate = null;
        this.router.navigate(['/app/reports/builder/template', r.id]);
      },
      error: e => this.fail(e)
    });
  }

  duplicate(c: Card): void {
    this.busy = true;
    this.api.duplicate(c.id).subscribe({
      next: r => {
        this.busy = false;
        this.router.navigate(['/app/reports/builder/template', r.id]);
      },
      error: e => this.fail(e)
    });
  }

  archive(c: Card, archive: boolean): void {
    this.busy = true;
    this.api.archive(c.id, archive).subscribe({
      next: () => this.done(archive ? 'rb.archived' : 'rb.restored'),
      error: e => this.fail(e)
    });
  }

  deleteTemplate(c: Card): void {
    if (this.confirm !== 'del:' + c.id) {
      this.confirm = 'del:' + c.id;
      return;
    }
    this.busy = true;
    this.api.deleteTemplate(c.id).subscribe({
      next: () => this.done('rb.deleted'),
      error: e => this.fail(e)
    });
  }

  private done(key: string): void {
    this.busy = false;
    this.closeMenu();
    this.alert.success(this.translate.instant(key));
    this.load();
  }

  private fail(e: unknown): void {
    this.busy = false;
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.failed')));
  }
}
