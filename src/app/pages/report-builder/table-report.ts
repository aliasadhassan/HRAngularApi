import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, forkJoin, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { ChartComponent } from '../../shared/widgets/chart/chart';
import { PaginationComponent } from '../../shared/pagination/pagination';
import { clientPager } from '../../shared/pagination/client-pager';
import { PayrollService } from '../payroll/payroll.service';
import { downloadCsv } from '../reports/reports.models';
import { ReportBuilderService } from './rb.service';
import {
  CHARTS, NO_VALUE_OPS, OPS, PERIODS, ReportAggregate, ReportChart, ReportColumn, ReportField, ReportFilter, ReportPeriod, ReportResult,
  ReportSource, ReportSpec, aggKey, emptySpec, fieldLabel, groupLabel, resolvePeriod, sourceDescription, sourceLabel
} from './rb.models';

type Fn = ReportAggregate['fn'];
const FNS: readonly Fn[] = ['count', 'sum', 'avg', 'min', 'max'];
const CHART_COLORS = ['#3f5e48', '#b08d3e', '#8e3b2e', '#13211a', '#a46a17', '#6f8f78', '#d4bb7a', '#c47a6c', '#4f6b8a', '#8d938b'];
const CHART_MAX = 30;

interface FilterDraft extends ReportFilter {
  index: number | null;
}

@Component({
  selector: 'app-table-report',
  imports: [DecimalPipe, FormsModule, RouterLink, TranslatePipe, ChartComponent, PaginationComponent],
  templateUrl: './table-report.html',
  styleUrls: ['./rb-shared.css', './table-report.css']
})
export class TableReportComponent {
  private readonly api = inject(ReportBuilderService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly lang = inject(LanguageService).language;
  readonly charts = CHARTS;
  readonly periods = PERIODS;
  readonly fns = FNS;
  readonly noValueOps = NO_VALUE_OPS;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly canBuild = signal(false);
  readonly sources = signal<ReportSource[]>([]);

  id: string | null = null;
  readonly name = signal('');
  description = '';
  readonly source = signal('');
  readonly spec = signal<ReportSpec>(emptySpec());
  readonly chart = signal<ReportChart>('Bar');
  readonly period = signal<ReportPeriod>('ThisMonth');
  readonly fromDate = signal<string | null>(null);
  readonly toDate = signal<string | null>(null);
  readonly ownerName = signal<string | null>(null);
  readonly dirty = signal(false);

  readonly result = signal<ReportResult | null>(null);
  /** Result table ka page; chart, totals aur CSV poori result se bante hain */
  readonly resultPager = clientPager(() => this.result()?.rows ?? []);
  /** Print pe poori result chhapni hai, sirf dikhaya hua page nahi */
  readonly printing = signal(false);
  readonly ranFrom = signal<string | null>(null);
  readonly ranTo = signal<string | null>(null);
  readonly running = signal(false);
  readonly runError = signal<string | null>(null);
  private readonly run$ = new Subject<void>();
  private markedRun = false;

  readonly fieldSearch = signal('');
  filterDraft: FilterDraft | null = null;
  aggDraft: { fn: Fn; field: string } | null = null;
  saving = false;
  saveOpen = false;

  readonly current = computed(() => this.sources().find(s => s.key === this.source()));
  readonly fields = computed(() => this.current()?.fields ?? []);
  readonly fieldGroups = computed(() => {
    const q = this.fieldSearch().trim().toLowerCase();
    this.lang();
    const groups = new Map<string, ReportField[]>();
    for (const f of this.fields()) {
      if (q && !this.fLabel(f).toLowerCase().includes(q)) continue;
      groups.set(f.group, [...(groups.get(f.group) ?? []), f]);
    }
    return [...groups.entries()].map(([group, fields]) => ({ group, fields }));
  });
  readonly numericFields = computed(() => this.fields().filter(f => f.type === 'Number' || f.type === 'Money'));
  readonly rangeFields = computed(() => this.fields().filter(f => f.type !== 'Text' && f.type !== 'Bool'));
  readonly grouped = computed(() => !!this.spec().groupBy);

  /** Jo columns result mein aayenge (sort ke liye). */
  readonly outputKeys = computed(() => {
    const s = this.spec();
    return s.groupBy ? [s.groupBy, ...s.aggregates.map(aggKey)] : s.columns;
  });

  readonly canRun = computed(() => {
    const s = this.spec();
    if (!this.current()) return false;
    if (this.current()!.needsRange && !this.range()) return false;
    return s.groupBy ? s.aggregates.length > 0 : s.columns.length > 0;
  });

  readonly range = computed(() => (this.current()?.needsRange ? resolvePeriod(this.period(), this.fromDate(), this.toDate()) : null));

  /** Chart: pehla group column labels, pehla number column values. */
  readonly chartData = computed(() => {
    const r = this.result();
    if (!r || !this.grouped() || this.chart() === 'None' || r.rows.length < 1) return null;
    const idx = r.columns.findIndex((c, i) => i > 0 && (c.type === 'Number' || c.type === 'Money'));
    if (idx < 0) return null;
    const rows = r.rows.slice(0, CHART_MAX);
    const labels = rows.map(row => this.cellText(row[0], r.columns[0]) || '—');
    const data = rows.map(row => Number(row[idx] ?? 0));
    const type = this.chart() === 'Pie' ? 'doughnut' : this.chart() === 'Line' ? 'line' : 'bar';
    const color = type === 'doughnut' ? labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) : '#3f5e48';
    return {
      type: type as 'bar' | 'line' | 'doughnut',
      labels,
      measure: this.colLabel(r.columns[idx]),
      datasets: [{
        label: this.colLabel(r.columns[idx]), data, backgroundColor: color, borderColor: type === 'line' ? '#3f5e48' : color,
        borderRadius: type === 'bar' ? 4 : 0, maxBarThickness: 36, tension: 0.3, pointRadius: 3
      }],
      legend: type === 'doughnut' ? labels.map((l, i) => ({ label: l, value: data[i], color: CHART_COLORS[i % CHART_COLORS.length] })) : []
    };
  });

  constructor() {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id === 'new') this.id = null;
    this.run$.pipe(debounceTime(450), takeUntilDestroyed()).subscribe(() => this.run());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.home().subscribe({
      next: h => {
        this.canBuild.set(h.canBuild);
        forkJoin({
          payroll: h.canSeePayroll ? this.api.payrollSources().pipe(catchError(() => of([]))) : of([]),
          report: this.id ? this.api.report(this.id) : of(null)
        }).subscribe({
          next: ({ payroll, report }) => {
            this.sources.set([...h.sources, ...payroll]);
            if (report) {
              this.name.set(report.name);
              this.description = report.description ?? '';
              this.source.set(report.source);
              this.spec.set({ ...emptySpec(), ...report.spec });
              this.chart.set(report.chart);
              this.period.set(report.period === 'None' ? 'ThisMonth' : report.period);
              this.fromDate.set(report.fromDate);
              this.toDate.set(report.toDate);
              this.ownerName.set(report.ownerName);
            } else {
              const want = this.route.snapshot.queryParamMap.get('source');
              const first = this.sources().find(s => s.key === want) ?? this.sources()[0];
              if (first) this.pickSource(first.key, true);
              this.name.set(this.translate.instant('rb.untitled'));
            }
            this.loading.set(false);
            this.dirty.set(false);
            this.queueRun();
          },
          error: e => this.loadFailed(e)
        });
      },
      error: e => this.loadFailed(e)
    });
  }

  private loadFailed(e: unknown): void {
    this.loading.set(false);
    this.error.set(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
  }

  // ───── Labels ─────
  private tr = (k: string) => this.translate.instant(k);

  srcLabel(s: ReportSource): string {
    return sourceLabel(this.tr, this.lang(), s);
  }

  srcDesc(s: ReportSource): string {
    return sourceDescription(this.tr, this.lang(), s);
  }

  fLabel(f: ReportField): string {
    return fieldLabel(this.tr, this.lang(), f);
  }

  gLabel(g: string): string {
    return groupLabel(this.tr, this.lang(), g);
  }

  labelOf(key: string | null): string {
    if (!key) return '';
    const f = this.fields().find(x => x.key === key);
    if (f) return this.fLabel(f);
    if (key === 'count') return this.tr('rb.fn.count');
    const [fn, field] = key.split(':');
    const ff = this.fields().find(x => x.key === field);
    return `${this.tr('rb.fn.' + fn)} · ${ff ? this.fLabel(ff) : field}`;
  }

  colLabel(c: ReportColumn): string {
    return this.labelOf(c.key) || c.label;
  }

  typeOf(key: string): ReportField['type'] {
    return this.fields().find(f => f.key === key)?.type ?? 'Text';
  }

  // ───── Source + period ─────
  pickSource(key: string, initial = false): void {
    if (key === this.source() && !initial) return;
    this.source.set(key);
    const src = this.sources().find(s => s.key === key);
    const defaults = src?.fields.slice(0, 4).map(f => f.key) ?? [];
    this.spec.set({ ...emptySpec(), columns: defaults });
    this.filterDraft = null;
    this.aggDraft = null;
    this.result.set(null);
    this.changed();
  }

  setPeriod(p: ReportPeriod): void {
    this.period.set(p);
    if (p === 'Custom' && !this.fromDate()) {
      const r = resolvePeriod('ThisMonth', null, null)!;
      this.fromDate.set(r.from);
      this.toDate.set(r.to);
    }
    this.changed();
  }

  setDate(which: 'from' | 'to', v: string): void {
    (which === 'from' ? this.fromDate : this.toDate).set(v || null);
    this.changed();
  }

  // ───── Columns ─────
  hasColumn(key: string): boolean {
    return this.spec().columns.includes(key);
  }

  toggleColumn(key: string): void {
    const s = this.spec();
    const columns = s.columns.includes(key) ? s.columns.filter(c => c !== key) : [...s.columns, key];
    const sort = s.sort && !s.groupBy && !columns.includes(s.sort.key) ? null : s.sort;
    this.update({ columns, sort });
  }

  moveColumn(key: string, dir: -1 | 1): void {
    const cols = [...this.spec().columns];
    const i = cols.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cols.length) return;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    this.update({ columns: cols });
  }

  // ───── Filters ─────
  opsFor(field: string): readonly string[] {
    return OPS[this.typeOf(field)];
  }

  addFilter(): void {
    const f = this.fields()[0];
    if (!f) return;
    this.aggDraft = null;
    this.filterDraft = { index: null, field: f.key, op: OPS[f.type][0], value: f.type === 'Bool' ? 'true' : '', value2: '' };
  }

  editFilter(i: number): void {
    const f = this.spec().filters[i];
    this.aggDraft = null;
    this.filterDraft = { ...f, value: f.value ?? '', value2: f.value2 ?? '', index: i };
  }

  draftField(key: string): void {
    const d = this.filterDraft;
    if (!d) return;
    d.field = key;
    const ops = this.opsFor(key);
    if (!ops.includes(d.op)) d.op = ops[0];
    d.value = this.typeOf(key) === 'Bool' ? 'true' : '';
    d.value2 = '';
  }

  draftValid(): boolean {
    const d = this.filterDraft;
    if (!d) return false;
    if (NO_VALUE_OPS.includes(d.op)) return true;
    if (!d.value?.toString().trim()) return false;
    return d.op !== 'between' || !!d.value2?.toString().trim();
  }

  saveFilter(): void {
    const d = this.filterDraft;
    if (!d || !this.draftValid()) return;
    const f: ReportFilter = {
      field: d.field, op: d.op,
      value: NO_VALUE_OPS.includes(d.op) ? null : String(d.value).trim(),
      value2: d.op === 'between' ? String(d.value2).trim() : null
    };
    const filters = [...this.spec().filters];
    if (d.index === null) filters.push(f);
    else filters[d.index] = f;
    this.filterDraft = null;
    this.update({ filters });
  }

  removeFilter(i: number): void {
    this.filterDraft = null;
    this.update({ filters: this.spec().filters.filter((_, x) => x !== i) });
  }

  filterText(f: ReportFilter): string {
    const t = this.typeOf(f.field);
    const v = (x: string | null | undefined) => (t === 'Bool' ? this.tr(x === 'true' ? 'common.yes' : 'common.no') : x ?? '');
    if (NO_VALUE_OPS.includes(f.op)) return '';
    if (f.op === 'between') return `${v(f.value)} – ${v(f.value2)}`;
    return v(f.value);
  }

  inputType(field: string): string {
    const t = this.typeOf(field);
    return t === 'Date' ? 'date' : t === 'Number' || t === 'Money' ? 'number' : 'text';
  }

  // ───── Group + totals ─────
  setGroup(key: string): void {
    const s = this.spec();
    if (!key) {
      this.update({ groupBy: null, aggregates: [], sort: null });
      return;
    }
    const aggregates = s.aggregates.length ? s.aggregates : [{ fn: 'count' as Fn, field: null }];
    this.update({ groupBy: key, aggregates, sort: { key: 'count', desc: true } });
  }

  addAgg(): void {
    this.filterDraft = null;
    const n = this.numericFields()[0];
    this.aggDraft = { fn: n ? 'sum' : 'count', field: n?.key ?? '' };
  }

  aggFields(fn: Fn): ReportField[] {
    if (fn === 'sum' || fn === 'avg') return this.numericFields();
    if (fn === 'min' || fn === 'max') return this.rangeFields();
    return [];
  }

  draftFn(fn: Fn): void {
    if (!this.aggDraft) return;
    this.aggDraft.fn = fn;
    const list = this.aggFields(fn);
    if (!list.some(f => f.key === this.aggDraft!.field)) this.aggDraft.field = list[0]?.key ?? '';
  }

  saveAgg(): void {
    const d = this.aggDraft;
    if (!d) return;
    const a: ReportAggregate = { fn: d.fn, field: d.fn === 'count' ? null : d.field || null };
    if (a.fn !== 'count' && !a.field) return;
    if (this.spec().aggregates.some(x => aggKey(x) === aggKey(a))) {
      this.aggDraft = null;
      return;
    }
    this.aggDraft = null;
    this.update({ aggregates: [...this.spec().aggregates, a] });
  }

  removeAgg(i: number): void {
    const s = this.spec();
    const removed = aggKey(s.aggregates[i]);
    const aggregates = s.aggregates.filter((_, x) => x !== i);
    this.update({ aggregates, sort: s.sort?.key === removed ? null : s.sort });
  }

  setSort(key: string): void {
    this.update({ sort: key ? { key, desc: this.spec().sort?.desc ?? false } : null });
  }

  toggleSortDir(): void {
    const s = this.spec().sort;
    if (s) this.update({ sort: { ...s, desc: !s.desc } });
  }

  sortBy(c: ReportColumn): void {
    const s = this.spec().sort;
    this.update({ sort: { key: c.key, desc: s?.key === c.key ? !s.desc : c.type !== 'Text' } });
  }

  setLimit(v: number | null): void {
    this.update({ limit: v && v > 0 ? Math.min(Math.round(v), 5000) : null });
  }

  setChart(c: ReportChart): void {
    this.chart.set(c);
    this.dirty.set(true);
  }

  private update(patch: Partial<ReportSpec>): void {
    this.spec.set({ ...this.spec(), ...patch });
    this.changed();
  }

  private changed(): void {
    this.dirty.set(true);
    this.queueRun();
  }

  // ───── Run ─────
  queueRun(): void {
    if (this.canRun()) this.run$.next();
    else {
      this.result.set(null);
      this.runError.set(null);
    }
  }

  run(): void {
    if (!this.canRun()) return;
    const r = this.range();
    this.running.set(true);
    this.runError.set(null);
    this.api.run(this.source(), this.spec(), r?.from ?? null, r?.to ?? null).subscribe({
      next: res => {
        this.running.set(false);
        this.result.set(res.result);
        this.resultPager.reset();
        this.ranFrom.set(res.from);
        this.ranTo.set(res.to);
        if (this.id && !this.markedRun) {
          this.markedRun = true;
          this.api.markRun(this.id).subscribe({ error: () => {} });
        }
      },
      error: e => {
        this.running.set(false);
        this.runError.set(PayrollService.errorMessage(e, this.tr('rb.runFailed')));
      }
    });
  }

  cellText(v: unknown, c: ReportColumn): string {
    if (v === null || v === undefined || v === '') return '';
    if (c.type === 'Bool') return this.tr(v ? 'common.yes' : 'common.no');
    if (c.type === 'Date' && typeof v === 'string') {
      const [y, m, d] = v.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(this.lang() === 'ar' ? 'ar-u-nu-latn' : this.lang() === 'en' ? 'en-GB' : this.lang(), { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (c.type === 'Money') return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (c.type === 'Number') return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
    return String(v);
  }

  isNum(c: ReportColumn): boolean {
    return c.type === 'Number' || c.type === 'Money';
  }

  // ───── Save / export ─────
  save(): void {
    if (!this.canBuild() || !this.name().trim()) {
      this.saveOpen = true;
      return;
    }
    const needs = this.current()?.needsRange;
    const body = {
      name: this.name().trim(),
      description: this.description.trim() || null,
      source: this.source(),
      spec: this.spec(),
      chart: this.chart(),
      period: needs ? this.period() : 'None' as ReportPeriod,
      fromDate: needs && this.period() === 'Custom' ? this.fromDate() : null,
      toDate: needs && this.period() === 'Custom' ? this.toDate() : null
    };
    this.saving = true;
    const done = () => {
      this.saving = false;
      this.saveOpen = false;
      this.dirty.set(false);
      this.alert.success(this.tr('rb.reportSaved'));
    };
    const fail = (e: unknown) => {
      this.saving = false;
      this.alert.error(PayrollService.errorMessage(e, this.tr('rb.failed')));
    };
    if (this.id) {
      this.api.updateReport(this.id, body).subscribe({ next: done, error: fail });
    } else {
      this.api.createReport(body).subscribe({
        next: r => {
          this.id = r.id;
          done();
          this.router.navigate(['/app/reports/builder/report', r.id], { replaceUrl: true });
        },
        error: fail
      });
    }
  }

  exportCsv(): void {
    const r = this.result();
    if (!r) return;
    const rows = r.rows.map(row => row.map((v, i) => (r.columns[i].type === 'Bool' ? this.cellText(v, r.columns[i]) : (v as string | number | null))));
    if (r.totals) rows.push(r.totals.map((v, i) => (i === 0 && v === null ? this.tr('rb.total') : (v as string | number | null))));
    const file = (this.name().trim() || 'report').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
    downloadCsv(`${file}.csv`, r.columns.map(c => this.colLabel(c)), rows);
  }

  print(): void {
    this.printing.set(true);
    setTimeout(() => {
      window.print();
      this.printing.set(false);
    });
  }
}
