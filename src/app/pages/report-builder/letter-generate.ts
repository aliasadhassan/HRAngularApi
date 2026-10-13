import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject, catchError, concat, debounceTime, forkJoin, map, of, toArray } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { PeopleService } from '../people/people.service';
import { Department } from '../people/people.models';
import { ReportBuilderService } from './rb.service';
import {
  IssuedLetterItem, IssuedResult, LetterData, LetterLang, LetterPay, LetterPerson, Letterhead, MAX_BATCH, PublishedTemplate, REF_MARKER,
  TemplateDetail
} from './rb.models';
import { buildContext, renderLetter, setPrintPage, usesPay, wrapPage } from './letter-render';

type Mode = 'one' | 'many';
type LangChoice = LetterLang | 'both';

interface Filled {
  data: LetterData;
  pay: LetterPay | null;
}

@Component({
  selector: 'app-letter-generate',
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './letter-generate.html',
  styleUrls: ['./rb-shared.css', './letter-generate.css']
})
export class LetterGenerateComponent {
  private readonly api = inject(ReportBuilderService);
  private readonly peopleApi = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly lang = inject(LanguageService).language;
  readonly maxBatch = MAX_BATCH;
  readonly id = this.route.snapshot.paramMap.get('id')!;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<TemplateDetail | null>(null);
  readonly letterhead = signal<Letterhead | null>(null);
  readonly departments = signal<Department[]>([]);
  readonly recent = signal<IssuedLetterItem[]>([]);

  readonly mode = signal<Mode>('one');
  readonly people = signal<LetterPerson[]>([]);
  readonly peopleLoading = signal(false);
  search = '';
  departmentId: string | null = null;
  includeExited = false;
  private readonly search$ = new Subject<void>();

  /** Chune hue log (order mehfooz) */
  readonly selected = signal<LetterPerson[]>([]);
  readonly language = signal<LangChoice>('en');
  purpose = '';

  /** Preview: kaun sa chuna hua shakhs */
  readonly index = signal(0);
  readonly previewHtml = signal<SafeHtml | null>(null);
  readonly missing = signal<string[]>([]);
  readonly previewLoading = signal(false);
  private readonly cache = new Map<string, Filled>();

  readonly issuing = signal(false);
  readonly issued = signal<{ results: IssuedResult[]; html: SafeHtml } | null>(null);

  readonly published = computed<PublishedTemplate | null>(() => this.detail()?.published ?? null);
  readonly langs = computed<LangChoice[]>(() => {
    const p = this.published();
    if (!p) return [];
    const list: LangChoice[] = [];
    if (p.htmlEn) list.push('en');
    if (p.htmlAr) list.push('ar');
    if (p.htmlEn && p.htmlAr) list.push('both');
    return list;
  });
  readonly previewLang = computed<LetterLang>(() => (this.language() === 'both' ? (this.lang() === 'ar' ? 'ar' : 'en') : this.language() as LetterLang));
  readonly current = computed(() => this.selected()[this.index()] ?? null);
  readonly letterCount = computed(() => this.selected().length * (this.language() === 'both' ? 2 : 1));

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.loadPeople());
    forkJoin({
      t: this.api.template(this.id),
      lh: this.api.letterhead().pipe(catchError(() => of(null))),
      deps: this.peopleApi.getDepartments().pipe(catchError(() => of([] as Department[])))
    }).subscribe({
      next: ({ t, lh, deps }) => {
        this.detail.set(t);
        this.letterhead.set(lh);
        this.departments.set(deps);
        const ls = this.langs();
        this.language.set(ls.includes(this.lang() === 'ar' ? 'ar' : 'en') ? (this.lang() === 'ar' ? 'ar' : 'en') : ls[0] ?? 'en');
        this.loading.set(false);
        this.loadPeople();
        this.loadRecent();
      },
      error: e => {
        this.loading.set(false);
        this.error.set(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
      }
    });
  }

  loadPeople(): void {
    this.peopleLoading.set(true);
    this.api.people(this.search, this.departmentId, this.includeExited).subscribe({
      next: p => {
        this.people.set(p);
        this.peopleLoading.set(false);
      },
      error: () => this.peopleLoading.set(false)
    });
  }

  onSearch(): void {
    this.search$.next();
  }

  private loadRecent(): void {
    this.api.letters({ templateId: this.id }).subscribe({ next: l => this.recent.set(l.slice(0, 6)), error: () => {} });
  }

  setMode(m: Mode): void {
    this.mode.set(m);
    if (m === 'one' && this.selected().length > 1) this.selected.set(this.selected().slice(0, 1));
    this.index.set(0);
    this.issued.set(null);
    this.refreshPreview();
  }

  isSelected(p: LetterPerson): boolean {
    return this.selected().some(x => x.id === p.id);
  }

  toggle(p: LetterPerson): void {
    this.issued.set(null);
    if (this.mode() === 'one') {
      this.selected.set([p]);
      this.index.set(0);
    } else if (this.isSelected(p)) {
      this.selected.set(this.selected().filter(x => x.id !== p.id));
      this.index.set(Math.min(this.index(), Math.max(0, this.selected().length - 1)));
    } else if (this.selected().length < MAX_BATCH) {
      this.selected.set([...this.selected(), p]);
    } else {
      this.alert.warning(this.translate.instant('rb.batchLimit', { n: MAX_BATCH }));
    }
    this.refreshPreview();
  }

  selectAll(): void {
    const have = new Set(this.selected().map(x => x.id));
    const add = this.people().filter(p => !have.has(p.id));
    const room = MAX_BATCH - this.selected().length;
    if (add.length > room) this.alert.warning(this.translate.instant('rb.batchLimit', { n: MAX_BATCH }));
    this.selected.set([...this.selected(), ...add.slice(0, Math.max(0, room))]);
    this.issued.set(null);
    this.refreshPreview();
  }

  clearAll(): void {
    this.selected.set([]);
    this.index.set(0);
    this.issued.set(null);
    this.refreshPreview();
  }

  setLanguage(l: LangChoice): void {
    this.language.set(l);
    this.issued.set(null);
    this.refreshPreview();
  }

  step(d: -1 | 1): void {
    const n = this.index() + d;
    if (n < 0 || n >= this.selected().length) return;
    this.index.set(n);
    this.refreshPreview();
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // ───── Fill ─────
  private needsPay(): boolean {
    const p = this.published();
    return !!p && (usesPay(p.htmlEn) || usesPay(p.htmlAr));
  }

  /** Jo log cache mein nahi un ka data (employee + pay) ek saath. */
  private fetch(ids: string[]): Observable<void> {
    const missing = ids.filter(id => !this.cache.has(id));
    if (!missing.length) return of(undefined);
    return forkJoin({
      data: this.api.letterData(missing),
      pay: this.needsPay() ? this.api.letterPay(missing).pipe(catchError(() => of([] as LetterPay[]))) : of([] as LetterPay[])
    }).pipe(map(({ data, pay }) => {
      for (const d of data) this.cache.set(d.employee.id, { data: d, pay: pay.find(p => p.employeeId === d.employee.id) ?? null });
    }));
  }

  private render(personId: string, lang: LetterLang, ref: string): { html: string; missing: string[] } | null {
    const p = this.published();
    const filled = this.cache.get(personId);
    const template = lang === 'ar' ? p?.htmlAr : p?.htmlEn;
    if (!p || !filled || !template) return null;
    const ctx = buildContext({
      data: filled.data, pay: filled.pay, company: this.letterhead(), lang, purpose: this.purpose.trim() || null,
      signatoryName: p.signatoryName, signatoryTitle: p.signatoryTitle, ref
    });
    const r = renderLetter(template, ctx, lang);
    return { html: wrapPage(r.html, { lang, paper: p.paper, letterhead: p.showLetterhead ? this.letterhead() : null }), missing: r.missing };
  }

  refreshPreview(): void {
    const person = this.current();
    if (!person) {
      this.previewHtml.set(null);
      this.missing.set([]);
      return;
    }
    this.previewLoading.set(true);
    this.fetch([person.id]).subscribe({
      next: () => {
        this.previewLoading.set(false);
        const prefix = this.detail()?.refPrefix ?? 'LTR';
        const r = this.render(person.id, this.previewLang(), `${prefix}-${new Date().getFullYear()}-·····`);
        // Template server par HtmlSanitizer se saaf hai, renderLetter bhi script / on* hatata hai; text-align (style) rehna chahiye.
        this.previewHtml.set(r ? this.sanitizer.bypassSecurityTrustHtml(r.html) : null);
        this.missing.set(r?.missing ?? []);
      },
      error: e => {
        this.previewLoading.set(false);
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
      }
    });
  }

  fieldName(key: string): string {
    const k = 'rb.f.' + key;
    const v = this.translate.instant(k);
    return v === k ? key : v;
  }

  missingText(): string {
    return this.missing().map(k => this.fieldName(k)).join(', ');
  }

  // ───── Issue ─────
  issue(): void {
    const p = this.published();
    const people = this.selected();
    if (!p || !people.length || this.issuing()) return;
    this.issuing.set(true);
    const langs: LetterLang[] = this.language() === 'both' ? ['en', 'ar'] : [this.language() as LetterLang];
    this.fetch(people.map(x => x.id)).subscribe({
      next: () => {
        const calls = langs.map(l => this.api.issue(this.id, p.version, l, this.purpose.trim() || null,
          people.map(x => ({ employeeId: x.id, html: this.render(x.id, l, REF_MARKER)?.html ?? '' })).filter(i => i.html)));
        concat(...calls).pipe(toArray()).subscribe({
          next: lists => {
            this.issuing.set(false);
            // Har shakhs ke EN aur AR saath saath
            const results = langs.length > 1
              ? lists[0].flatMap(a => [a, ...lists[1].filter(b => b.employeeId === a.employeeId)])
              : lists[0];
            this.issued.set({ results, html: this.sanitizer.bypassSecurityTrustHtml(results.map(r => r.html).join('')) });
            this.alert.success(this.translate.instant('rb.issuedN', { n: results.length }));
            this.loadRecent();
            setTimeout(() => this.print(), 300);
          },
          error: e => this.issueFailed(e)
        });
      },
      error: e => this.issueFailed(e)
    });
  }

  private issueFailed(e: unknown): void {
    this.issuing.set(false);
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.issueFailed')));
  }

  print(): void {
    const p = this.published();
    if (p) setPrintPage(p.paper, p.showPageNumbers);
    window.print();
  }
}
