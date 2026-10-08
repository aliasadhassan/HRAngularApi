import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, Subject, catchError, debounceTime, forkJoin, map, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { AuditService } from './audit.service';
import {
  ACTION_CHIP, ACTION_ICON, AUDIT_ACTIONS, AUDIT_SOURCES, AuditAction, AuditCount, AuditDay, AuditOperation, AuditPage, AuditSource,
  AuditSummary, AuditUserCount, SOURCE_ICON, SourcedEntry, ValueKind, humanize, valueKind, watermark
} from './audit.models';

type Tab = 'activity' | 'changes';
const TABS: readonly Tab[] = ['activity', 'changes'];
const PAGE = 50;

interface TypeOption {
  value: string; // "people:Department"
  source: AuditSource;
  type: string;
  count: number;
}

interface RecordFilter {
  source: AuditSource;
  type: string;
  id: string;
  label: string;
}

interface MergedSummary {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  operations: number;
  activeUsers: number;
  byDay: AuditDay[];
  topUsers: AuditUserCount[];
  topEntities: (AuditCount & { source: AuditSource })[];
}

@Component({
  selector: 'app-audit',
  imports: [DatePipe, FormsModule, NgTemplateOutlet, TranslatePipe],
  templateUrl: './audit.html',
  styleUrl: './audit.css'
})
export class AuditComponent {
  private readonly api = inject(AuditService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly perms = inject(PermissionService);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly actions = AUDIT_ACTIONS;
  readonly actionChip = ACTION_CHIP;
  readonly actionIcon = ACTION_ICON;
  readonly sourceIcon = SOURCE_ICON;
  readonly ranges = [7, 30, 90];

  /** Payroll ka audit tankhwah dikhata hai — sirf payroll dekhne walon ko */
  readonly sources: readonly AuditSource[] = AUDIT_SOURCES.filter(
    s => s !== 'payroll' || this.perms.hasAny([P.payrollViewAll, P.payrollApprove])
  );

  readonly tab = signal<Tab>('activity');
  readonly days = signal(30);

  // Filters (Data changes tab)
  readonly sourceFilter = signal<AuditSource | 'all'>('all');
  action: AuditAction | '' = '';
  typeFilter = '';
  search = '';
  readonly userFilter = signal<{ id: string; name: string } | null>(null);
  readonly record = signal<RecordFilter | null>(null);

  readonly summaries = signal<Partial<Record<AuditSource, AuditSummary>>>({});
  readonly typeOptions = signal<TypeOption[]>([]);
  readonly entries = signal<SourcedEntry[]>([]);
  readonly next = signal<Partial<Record<AuditSource, string | null>>>({});
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly failed = signal<AuditSource[]>([]);

  readonly selected = signal<SourcedEntry | null>(null);
  readonly openOps = signal<Set<string>>(new Set());

  private readonly searchChanged = new Subject<void>();
  private loadToken = 0;

  /** Sirf woh rows jo har source ke hisaab se pakki hain (koi purani row beech mein nahi aa sakti) */
  readonly visible = computed(() => {
    const mark = watermark(this.next());
    return this.entries().filter(e => new Date(e.at).getTime() >= mark);
  });

  readonly hasMore = computed(() => Object.values(this.next()).some(v => !!v));

  readonly operations = computed<AuditOperation[]>(() => {
    const ops = new Map<string, AuditOperation>();
    for (const e of this.visible()) {
      const key = `${e.source}:${e.correlationId}`;
      let op = ops.get(key);
      if (!op) {
        op = { key, at: e.at, source: e.source, userId: e.userId, userName: e.userName, operation: e.operation, entries: [] };
        ops.set(key, op);
      }
      op.entries.push(e);
      if (e.at > op.at) op.at = e.at;
    }
    return [...ops.values()].sort((a, b) => b.at.localeCompare(a.at));
  });

  readonly summary = computed<MergedSummary | null>(() => {
    const parts = this.sources.map(s => [s, this.summaries()[s]] as const).filter(([, v]) => !!v) as [AuditSource, AuditSummary][];
    if (parts.length === 0) return null;

    const days = new Map<string, AuditDay>();
    const users = new Map<string, AuditUserCount>();
    const entities: (AuditCount & { source: AuditSource })[] = [];
    for (const [source, s] of parts) {
      for (const d of s.byDay) {
        const cur = days.get(d.date) ?? { date: d.date, created: 0, updated: 0, deleted: 0 };
        days.set(d.date, { date: d.date, created: cur.created + d.created, updated: cur.updated + d.updated, deleted: cur.deleted + d.deleted });
      }
      for (const u of s.topUsers) {
        const k = u.userId ?? '';
        const cur = users.get(k);
        users.set(k, { userId: u.userId, userName: cur?.userName ?? u.userName, count: (cur?.count ?? 0) + u.count });
      }
      entities.push(...s.topEntities.map(e => ({ ...e, source })));
    }
    const sum = (f: (s: AuditSummary) => number) => parts.reduce((t, [, s]) => t + f(s), 0);
    return {
      total: sum(s => s.total),
      created: sum(s => s.created),
      updated: sum(s => s.updated),
      deleted: sum(s => s.deleted),
      operations: sum(s => s.operations),
      // Ek insaan teeno services mein ho sakta hai — userId se ginti
      activeUsers: users.size,
      byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      topUsers: [...users.values()].sort((a, b) => b.count - a.count).slice(0, 6),
      topEntities: entities.sort((a, b) => b.count - a.count).slice(0, 6)
    };
  });

  readonly dayMax = computed(() => Math.max(1, ...(this.summary()?.byDay ?? []).map(d => d.created + d.updated + d.deleted)));

  readonly filtersActive = computed(
    () => this.sourceFilter() !== 'all' || !!this.userFilter() || !!this.record() || this.filterTick() > 0
  );
  /** ngModel wale filters (action / type / search) badlein to computed ko pata chale */
  private readonly filterTick = signal(0);

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const tab = q.get('tab') as Tab | null;
    if (tab && TABS.includes(tab)) this.tab.set(tab);

    this.searchChanged.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload());
    this.loadSummaries();
    this.loadTypes();
    this.reload();
  }

  // ───────── Loading ─────────

  private activeSources(): AuditSource[] {
    const rec = this.record();
    if (rec) return [rec.source];
    let list = this.sources.filter(s => this.sourceFilter() === 'all' || this.sourceFilter() === s);
    if (this.typeFilter) list = list.filter(s => this.typeFilter.startsWith(s + ':'));
    return list;
  }

  private fromIso(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (this.days() - 1));
    return d.toISOString();
  }

  private fetch(source: AuditSource, before: string | null): Observable<{ source: AuditSource; page: AuditPage | null }> {
    const rec = this.record();
    return this.api
      .entries(source, {
        before,
        from: rec ? null : this.fromIso(),
        userId: this.userFilter()?.id ?? null,
        entityType: rec?.type ?? (this.typeFilter ? this.typeFilter.split(':')[1] : null),
        entityId: rec?.id ?? null,
        action: this.action,
        search: this.search,
        limit: PAGE
      })
      .pipe(
        map(page => ({ source, page })),
        catchError(() => of({ source, page: null }))
      );
  }

  reload(): void {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.entries.set([]);
    this.next.set({});
    this.openOps.set(new Set());
    const list = this.activeSources();
    if (list.length === 0) {
      this.loading.set(false);
      return;
    }
    forkJoin(list.map(s => this.fetch(s, null))).subscribe(results => {
      if (token !== this.loadToken) return;
      this.absorb(results);
      this.loading.set(false);
    });
  }

  loadMore(): void {
    const next = this.next();
    const list = (Object.keys(next) as AuditSource[]).filter(s => next[s]);
    if (list.length === 0 || this.loadingMore()) return;
    const token = this.loadToken;
    this.loadingMore.set(true);
    forkJoin(list.map(s => this.fetch(s, next[s]!))).subscribe(results => {
      this.loadingMore.set(false);
      if (token !== this.loadToken) return;
      this.absorb(results);
    });
  }

  private absorb(results: { source: AuditSource; page: AuditPage | null }[]): void {
    const failed = results.filter(r => !r.page).map(r => r.source);
    this.failed.set(failed);
    if (failed.length === results.length && results.length > 0) {
      this.alert.error(this.translate.instant('audit.errorLoad'));
    }
    const added: SourcedEntry[] = [];
    const next = { ...this.next() };
    for (const r of results) {
      if (!r.page) {
        next[r.source] = null;
        continue;
      }
      added.push(...r.page.items.map(i => ({ ...i, source: r.source })));
      next[r.source] = r.page.next;
    }
    this.entries.set([...this.entries(), ...added].sort((a, b) => b.at.localeCompare(a.at) || a.entityType.localeCompare(b.entityType)));
    this.next.set(next);
  }

  loadSummaries(): void {
    this.summaries.set({});
    for (const s of this.sources) {
      this.api.summary(s, this.days()).subscribe({
        next: v => this.summaries.update(m => ({ ...m, [s]: v })),
        error: err => {
          if (s === 'people') this.alert.error(PayrollService.errorMessage(err, this.translate.instant('audit.errorLoad')));
        }
      });
    }
  }

  private loadTypes(): void {
    forkJoin(this.sources.map(s => this.api.entityTypes(s).pipe(map(list => list.map(t => ({ ...t, source: s }))), catchError(() => of([])))))
      .subscribe(all => {
        const opts = all.flat().map(t => ({ value: `${t.source}:${t.key}`, source: t.source, type: t.key, count: t.count }));
        opts.sort((a, b) => this.typeName(a.type).localeCompare(this.typeName(b.type)));
        this.typeOptions.set(opts);
      });
  }

  // ───────── Filters ─────────

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.router.navigate([], { queryParams: { tab: tab === 'activity' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
    // Activity hamesha poori company ka — filters sirf Data changes pe
    if (tab === 'activity' && this.filtersActive()) this.clearFilters();
  }

  setDays(days: number): void {
    this.days.set(days);
    this.loadSummaries();
    this.reload();
  }

  setSource(source: AuditSource | 'all'): void {
    this.sourceFilter.set(source);
    if (this.typeFilter && source !== 'all' && !this.typeFilter.startsWith(source + ':')) this.typeFilter = '';
    this.touched();
  }

  touched(): void {
    this.filterTick.set(this.action || this.typeFilter || this.search ? 1 : 0);
    this.reload();
  }

  onSearch(): void {
    this.filterTick.set(this.action || this.typeFilter || this.search ? 1 : 0);
    this.searchChanged.next();
  }

  filterUser(userId: string | null, name: string | null): void {
    if (!userId) return;
    this.userFilter.set({ id: userId, name: name ?? '—' });
    this.record.set(null);
    this.tab.set('changes');
    this.reload();
  }

  filterType(source: AuditSource, type: string): void {
    this.typeFilter = `${source}:${type}`;
    this.sourceFilter.set('all');
    this.record.set(null);
    this.tab.set('changes');
    this.touched();
  }

  showHistory(e: SourcedEntry): void {
    this.record.set({ source: e.source, type: e.entityType, id: e.entityId, label: e.entityLabel ?? this.typeName(e.entityType) });
    this.selected.set(null);
    this.tab.set('changes');
    this.reload();
  }

  clearUser(): void {
    this.userFilter.set(null);
    this.reload();
  }

  clearRecord(): void {
    this.record.set(null);
    this.reload();
  }

  clearFilters(): void {
    this.sourceFilter.set('all');
    this.action = '';
    this.typeFilter = '';
    this.search = '';
    this.userFilter.set(null);
    this.record.set(null);
    this.filterTick.set(0);
    this.reload();
  }

  // ───────── Activity ─────────

  toggleOp(key: string): void {
    const s = new Set(this.openOps());
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.openOps.set(s);
  }

  isOpen(key: string): boolean {
    return this.openOps().has(key);
  }

  /** Activity line ka matn: "created Department · Engineering" / "made 6 changes" */
  opHeadline(op: AuditOperation): { key: string; params: Record<string, string | number> } {
    const first = op.entries[0];
    if (op.entries.length === 1) {
      return { key: `audit.op.${first.action}`, params: { type: this.typeName(first.entityType), label: first.entityLabel ? `“${first.entityLabel}”` : '' } };
    }
    const types = new Set(op.entries.map(e => e.entityType));
    if (types.size === 1 && op.entries.every(e => e.action === first.action)) {
      return { key: `audit.op.many${first.action}`, params: { n: op.entries.length, type: this.typeName(first.entityType) } };
    }
    return { key: 'audit.op.mixed', params: { n: op.entries.length } };
  }

  opRecords(op: AuditOperation): string {
    const labels = [...new Set(op.entries.map(e => e.subjectName ?? e.entityLabel).filter((x): x is string => !!x))];
    return labels.slice(0, 3).join(' · ') + (labels.length > 3 ? ` +${labels.length - 3}` : '');
  }

  dayTotal(d: AuditDay): number {
    return d.created + d.updated + d.deleted;
  }

  barHeight(n: number): string {
    return `${(n / this.dayMax()) * 100}%`;
  }

  dayLabel(at: string): string | null {
    const d = utc(at);
    if (!d) return null;
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
    return diff === 0 ? 'audit.today' : diff === 1 ? 'audit.yesterday' : null;
  }

  // ───────── Display ─────────

  typeName(type: string): string {
    const key = `audit.types.${type.replace(/\./g, '_')}`;
    const t = this.translate.instant(key);
    return t !== key ? t : humanize(type);
  }

  fieldName(field: string): string {
    const key = `audit.fields.${field}`;
    const t = this.translate.instant(key);
    return t !== key ? t : humanize(field);
  }

  kind(v: string | null): ValueKind {
    return valueKind(v);
  }

  shortId(v: string): string {
    return '…' + v.slice(-6);
  }

  changedFields(e: SourcedEntry): string {
    const all = [...new Set(e.changes.map(c => this.fieldName(c.field)))];
    return all.slice(0, 3).join(', ') + (all.length > 3 ? ` +${all.length - 3}` : '');
  }

  /** "PUT api/employees/{id}" → "PUT /employees/{id}" */
  operationText(op: string | null): string {
    return op ? op.replace(' api/', ' /') : '—';
  }

  open(e: SourcedEntry): void {
    this.selected.set(e);
  }

  close(): void {
    this.selected.set(null);
  }
}
