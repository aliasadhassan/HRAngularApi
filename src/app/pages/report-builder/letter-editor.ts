import { ActivatedRoute, RouterLink } from '@angular/router';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable, Subject, catchError, debounceTime, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { LanguageService } from '../../core/i18n/language.service';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { ReportBuilderService } from './rb.service';
import {
  CATEGORIES, LANGUAGE_MODES, LetterLang, LetterPerson, Letterhead, SaveResult, TEMPLATE_CHIP, TemplateDetail, TemplateSettings
} from './rb.models';
import { ALL_FIELDS, FIELD_GROUPS, FORMATS, FieldDef, LIST_FIELDS, buildContext, fieldKind, renderLetter, usesPay, wrapPage } from './letter-render';
import { FieldNode, IfBlock, PageBreak, RepeatRow } from './tiptap-ext';

type Pop = 'if' | 'repeat' | 'image' | null;
const IF_OPS = ['notempty', 'empty', 'eq', 'ne'] as const;
const ITEM_FIELDS: FieldDef[] = LIST_FIELDS[0].item ?? [];

interface Preview {
  search: string;
  people: LetterPerson[];
  person: LetterPerson | null;
  lang: LetterLang;
  html: SafeHtml | null;
  missing: string[];
  loading: boolean;
}

@Component({
  selector: 'app-letter-editor',
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './letter-editor.html',
  styleUrls: ['./rb-shared.css', './letter-editor.css']
})
export class LetterEditorComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(ReportBuilderService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('host') host?: ElementRef<HTMLDivElement>;

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly categories = CATEGORIES;
  readonly languageModes = LANGUAGE_MODES;
  readonly templateChip = TEMPLATE_CHIP;
  readonly fieldGroups = FIELD_GROUPS;
  readonly itemFields = ITEM_FIELDS;
  readonly listFields = LIST_FIELDS;
  readonly ifOps = IF_OPS;
  readonly ifFields = ALL_FIELDS;

  readonly year = new Date().getFullYear();
  readonly id = this.route.snapshot.paramMap.get('id')!;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<TemplateDetail | null>(null);
  readonly letterhead = signal<Letterhead | null>(null);
  settings!: TemplateSettings;

  /** Editor mein kaun si zubaan khuli hai */
  readonly active = signal<LetterLang>('en');
  private html: Record<LetterLang, string> = { en: '', ar: '' };
  readonly source = signal(false);
  sourceText = '';

  private editor?: Editor;
  /** Har transaction par +1 — toolbar ki halat dobara parhne ke liye */
  private readonly tick = signal(0);

  private rowVersion = 0;
  private draftDirty = false;
  private settingsDirty = false;
  private saving = false;
  private saveAgain = false;
  private afterSave: (() => void)[] = [];
  private readonly save$ = new Subject<void>();
  readonly saveState = signal<'saved' | 'saving' | 'dirty' | 'conflict' | 'error'>('saved');
  readonly savedAt = signal<Date | null>(null);
  readonly publishing = signal(false);

  readonly pop = signal<Pop>(null);
  ifDraft = { field: 'employee.exitReason', op: 'notempty', value: '' };
  repeatField = LIST_FIELDS[0].key;
  imageUrl = '';
  readonly fieldSearch = signal('');

  preview: Preview | null = null;
  private readonly people$ = new Subject<string>();

  readonly languages = computed(() => {
    const d = this.detail();
    if (!d) return [] as LetterLang[];
    this.tick();
    const l = this.settings?.languages ?? d.languages;
    return l === 'Both' ? (['en', 'ar'] as LetterLang[]) : l === 'Arabic' ? (['ar'] as LetterLang[]) : (['en'] as LetterLang[]);
  });

  /** Toolbar ki halat */
  readonly state = computed(() => {
    this.tick();
    const e = this.editor;
    if (!e) return null;
    const sel = e.state.selection;
    const field = sel instanceof NodeSelection && sel.node.type.name === 'field' ? sel.node : null;
    return {
      block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      table: e.isActive('table'),
      repeat: (e.getAttributes('tableRow')['repeat'] as string | null) ?? null,
      inIf: e.isActive('ifBlock'),
      field: field ? { key: field.attrs['field'] as string, format: (field.attrs['format'] as string | null) ?? '' } : null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo()
    };
  });

  readonly filteredGroups = computed(() => {
    const q = this.fieldSearch().trim().toLowerCase();
    this.lang();
    const match = (f: FieldDef) => !q || this.fieldName(f.key).toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
    return [
      ...FIELD_GROUPS.map(g => ({ key: g.key, fields: g.fields.filter(f => f.kind !== 'list' && match(f)) })),
      { key: 'item', fields: ITEM_FIELDS.filter(match) }
    ].filter(g => g.fields.length);
  });

  constructor() {
    this.save$.pipe(debounceTime(1200), takeUntilDestroyed()).subscribe(() => this.flush());
    this.people$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(q => this.searchPeople(q));
  }

  ngAfterViewInit(): void {
    forkJoin({
      t: this.api.template(this.id),
      lh: this.api.letterhead().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ t, lh }) => {
        this.detail.set(t);
        this.letterhead.set(lh);
        this.rowVersion = t.rowVersion;
        this.settings = {
          name: t.name, description: t.description, category: t.category, languages: t.languages, paper: t.paper,
          showLetterhead: t.showLetterhead, showPageNumbers: t.showPageNumbers, refPrefix: t.refPrefix,
          signatoryName: t.signatoryName, signatoryTitle: t.signatoryTitle
        };
        this.html = { en: t.draftHtmlEn ?? '', ar: t.draftHtmlAr ?? '' };
        const first: LetterLang = t.languages === 'Arabic' ? 'ar' : this.lang() === 'ar' && t.languages === 'Both' ? 'ar' : 'en';
        this.active.set(first);
        this.loading.set(false);
        setTimeout(() => this.createEditor());
      },
      error: e => {
        this.loading.set(false);
        this.error.set(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
      }
    });
  }

  ngOnDestroy(): void {
    if (this.draftDirty || this.settingsDirty) this.flush();
    this.editor?.destroy();
  }

  private createEditor(): void {
    if (!this.host) return;
    this.editor = new Editor({
      element: this.host.nativeElement,
      extensions: [
        StarterKit.configure({ link: { openOnClick: false }, codeBlock: false, code: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Table.configure({ resizable: false }),
        RepeatRow,
        TableHeader,
        TableCell,
        Image.configure({ inline: false }),
        Placeholder.configure({ placeholder: this.translate.instant('rb.editorPlaceholder') }),
        FieldNode,
        IfBlock,
        PageBreak
      ],
      content: this.html[this.active()],
      editorProps: { attributes: { spellcheck: 'true' } },
      onTransaction: () => this.tick.update(n => n + 1),
      onUpdate: () => this.markDraft()
    });
    this.tick.update(n => n + 1);
  }

  // ───── Language ─────
  switchLang(l: LetterLang): void {
    if (l === this.active()) return;
    this.stash();
    this.active.set(l);
    if (this.source()) this.sourceText = this.html[l];
    this.editor?.commands.setContent(this.html[l], { emitUpdate: false });
  }

  private stash(): void {
    if (this.source()) this.html[this.active()] = this.sourceText;
    else if (this.editor) this.html[this.active()] = this.editor.isEmpty ? '' : this.editor.getHTML();
  }

  // ───── Toolbar ─────
  get chain() {
    return this.editor!.chain().focus();
  }

  setBlock(b: string): void {
    if (b === 'p') this.chain.setParagraph().run();
    else this.chain.setHeading({ level: Number(b.slice(1)) as 1 | 2 | 3 }).run();
  }

  bold(): void { this.chain.toggleBold().run(); }
  italic(): void { this.chain.toggleItalic().run(); }
  underline(): void { this.chain.toggleUnderline().run(); }
  align(a: 'left' | 'center' | 'right' | 'justify'): void { this.chain.setTextAlign(a).run(); }
  bullet(): void { this.chain.toggleBulletList().run(); }
  ordered(): void { this.chain.toggleOrderedList().run(); }
  undo(): void { this.chain.undo().run(); }
  redo(): void { this.chain.redo().run(); }
  pageBreak(): void { this.chain.insertPageBreak().run(); }
  hr(): void { this.chain.setHorizontalRule().run(); }

  insertTable(): void {
    this.chain.insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
  }

  tableOp(op: 'rowAfter' | 'colAfter' | 'delRow' | 'delCol' | 'delTable'): void {
    const c = this.chain;
    ({
      rowAfter: () => c.addRowAfter(),
      colAfter: () => c.addColumnAfter(),
      delRow: () => c.deleteRow(),
      delCol: () => c.deleteColumn(),
      delTable: () => c.deleteTable()
    })[op]().run();
  }

  togglePop(p: Pop): void {
    if (p === 'if' && this.state()?.inIf) {
      const a = this.editor!.getAttributes('ifBlock');
      this.ifDraft = { field: a['field'] || 'employee.exitReason', op: a['op'] || 'notempty', value: a['value'] ?? '' };
    }
    if (p === 'repeat') this.repeatField = this.state()?.repeat ?? LIST_FIELDS[0].key;
    this.pop.set(this.pop() === p ? null : p);
  }

  applyIf(): void {
    const d = this.ifDraft;
    const needsValue = d.op === 'eq' || d.op === 'ne';
    if (needsValue && !d.value.trim()) return;
    const label = `${this.fieldName(d.field)} · ${this.translate.instant('rb.ifOp.' + d.op)}${needsValue ? ' “' + d.value.trim() + '”' : ''}`;
    const attrs = { field: d.field, op: d.op, value: needsValue ? d.value.trim() : null, label };
    if (this.state()?.inIf) this.chain.updateAttributes('ifBlock', attrs).run();
    else this.chain.wrapInIf(attrs).run();
    this.pop.set(null);
  }

  removeIf(): void {
    this.chain.unwrapIf().run();
    this.pop.set(null);
  }

  applyRepeat(stop = false): void {
    this.chain.updateAttributes('tableRow', stop
      ? { repeat: null, repeatLabel: null }
      : { repeat: this.repeatField, repeatLabel: this.fieldName(this.repeatField) }).run();
    this.pop.set(null);
  }

  insertImage(): void {
    const url = this.imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) return;
    this.chain.setImage({ src: url }).run();
    this.imageUrl = '';
    this.pop.set(null);
  }

  setFormat(format: string): void {
    this.chain.updateAttributes('field', { format: format || null }).run();
  }

  formatsFor(key: string): readonly string[] {
    return FORMATS[fieldKind(key)];
  }

  insertField(f: FieldDef): void {
    if (!this.editor) return;
    if (f.key.startsWith('item.') && !this.state()?.repeat) this.alert.warning(this.translate.instant('rb.itemHint'));
    this.chain.insertField({ field: f.key, label: this.fieldName(f.key), format: null }).run();
  }

  fieldName(key: string): string {
    const k = 'rb.f.' + key;
    const v = this.translate.instant(k);
    return v === k ? key : v;
  }

  missingText(list: string[]): string {
    return list.map(k => this.fieldName(k)).join(', ');
  }

  toggleSource(): void {
    if (this.source()) {
      this.html[this.active()] = this.sourceText;
      this.source.set(false);
      this.editor?.commands.setContent(this.sourceText, { emitUpdate: true });
    } else {
      this.stash();
      this.sourceText = this.prettyHtml(this.html[this.active()]);
      this.source.set(true);
    }
  }

  onSourceChange(): void {
    this.markDraft();
  }

  private prettyHtml(h: string): string {
    return h.replace(/(<\/(p|h1|h2|h3|table|tr|ul|ol|li|section|blockquote)>)/g, '$1\n').replace(/(<(table|tbody|tr|section|ul|ol)( [^>]*)?>)/g, '$1\n');
  }

  // ───── Settings ─────
  settingsChanged(): void {
    this.settingsDirty = true;
    this.saveState.set('dirty');
    this.tick.update(n => n + 1);
    const langs = this.languages();
    if (!langs.includes(this.active())) this.switchLang(langs[0]);
    this.save$.next();
  }

  // ───── Save ─────
  private markDraft(): void {
    this.draftDirty = true;
    if (this.saveState() !== 'conflict') this.saveState.set('dirty');
    this.save$.next();
  }

  saveNow(): void {
    this.flush();
  }

  /** Settings aur draft ek ek kar ke (dono ek hi rowVersion use karte hain). */
  private flush(done?: () => void): void {
    if (done) this.afterSave.push(done);
    if (this.saveState() === 'conflict') {
      this.afterSave = [];
      return;
    }
    if (this.saving) {
      this.saveAgain = true;
      return;
    }
    let call: Observable<SaveResult> | null = null;
    if (this.settingsDirty) {
      if (!this.settings.name.trim()) {
        this.afterSave = [];
        return;
      }
      this.settingsDirty = false;
      call = this.api.saveSettings(this.id, { ...this.settings, name: this.settings.name.trim() }, this.rowVersion);
    } else if (this.draftDirty) {
      this.stash();
      this.draftDirty = false;
      const langs = this.languages();
      call = this.api.saveDraft(this.id, langs.includes('en') ? this.html.en || null : null, langs.includes('ar') ? this.html.ar || null : null, this.rowVersion);
    }
    if (!call) {
      this.saveState.set('saved');
      this.runAfterSave();
      return;
    }
    this.saving = true;
    this.saveState.set('saving');
    call.subscribe({
      next: r => {
        this.saving = false;
        this.rowVersion = r.rowVersion;
        this.savedAt.set(new Date());
        const d = this.detail();
        if (d) this.detail.set({ ...d, ...this.settings, refPrefix: this.settings.refPrefix || d.refPrefix, hasUnpublishedChanges: d.status === 'Published' || d.hasUnpublishedChanges });
        if (this.saveAgain || this.settingsDirty || this.draftDirty) {
          this.saveAgain = false;
          this.flush();
        } else {
          this.saveState.set('saved');
          this.runAfterSave();
        }
      },
      error: e => {
        this.saving = false;
        this.afterSave = [];
        this.publishing.set(false);
        const status = (e as { status?: number })?.status;
        this.saveState.set(status === 409 ? 'conflict' : 'error');
        if (status !== 409) {
          this.draftDirty = true;
          this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.saveFailed')));
        }
      }
    });
  }

  private runAfterSave(): void {
    const list = this.afterSave;
    this.afterSave = [];
    list.forEach(f => f());
  }

  reload(): void {
    location.reload();
  }

  publish(): void {
    if (this.publishing()) return;
    this.publishing.set(true);
    this.flush(() => {
      this.api.publish(this.id, this.rowVersion).subscribe({
        next: r => {
          this.publishing.set(false);
          this.rowVersion = r.rowVersion;
          const d = this.detail()!;
          const version = d.publishedVersion + 1;
          this.detail.set({
            ...d, status: 'Published', publishedVersion: version, hasUnpublishedChanges: false,
            versions: [{ version, publishedAt: new Date().toISOString(), publishedByName: null }, ...d.versions]
          });
          this.alert.success(this.translate.instant('rb.published', { v: version }));
        },
        error: e => {
          this.publishing.set(false);
          this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.publishFailed')));
        }
      });
    });
    if (this.saveState() === 'conflict') this.publishing.set(false);
  }

  // ───── Preview ─────
  openPreview(): void {
    this.stash();
    this.preview = { search: '', people: [], person: null, lang: this.active(), html: null, missing: [], loading: false };
    this.searchPeople('');
  }

  onPeopleSearch(q: string): void {
    this.people$.next(q);
  }

  private searchPeople(q: string): void {
    this.api.people(q, null, true).subscribe({
      next: p => { if (this.preview) this.preview.people = p.slice(0, 30); },
      error: () => {}
    });
  }

  previewWith(p: LetterPerson): void {
    const pv = this.preview;
    if (!pv) return;
    pv.person = p;
    pv.loading = true;
    const html = this.html[pv.lang];
    forkJoin({
      data: this.api.letterData([p.id]),
      pay: usesPay(html) ? this.api.letterPay([p.id]).pipe(catchError(() => of([]))) : of([])
    }).subscribe({
      next: ({ data, pay }) => {
        if (!this.preview || !data[0]) return;
        this.preview.loading = false;
        const ctx = buildContext({
          data: data[0], pay: pay[0] ?? null, company: this.letterhead(), lang: pv.lang, purpose: this.translate.instant('rb.samplePurpose'),
          signatoryName: this.settings.signatoryName, signatoryTitle: this.settings.signatoryTitle, ref: `${this.settings.refPrefix || 'LTR'}-${new Date().getFullYear()}-00001`
        });
        const r = renderLetter(html, ctx, pv.lang);
        const page = wrapPage(r.html, { lang: pv.lang, paper: this.settings.paper, letterhead: this.settings.showLetterhead ? this.letterhead() : null });
        // Template HTML server par HtmlSanitizer se saaf hota hai aur renderLetter bhi script / on* nikalta hai; style (text-align) rakhna hai.
        this.preview.html = this.sanitizer.bypassSecurityTrustHtml(page);
        this.preview.missing = r.missing;
      },
      error: e => {
        if (this.preview) this.preview.loading = false;
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')));
      }
    });
  }

  previewLang(l: LetterLang): void {
    if (!this.preview) return;
    this.preview.lang = l;
    if (this.preview.person) this.previewWith(this.preview.person);
  }
}
