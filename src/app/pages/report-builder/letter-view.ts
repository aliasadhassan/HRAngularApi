import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/i18n/language.service';
import { P, PermissionService } from '../../core/auth/permissions';
import { AlertService } from '../../services/alert/alert';
import { PayrollService } from '../payroll/payroll.service';
import { utc } from '../admin/admin.models';
import { ReportBuilderService } from './rb.service';
import { IssuedLetter } from './rb.models';
import { setPrintPage } from './letter-render';

/** Jari shuda letter: bilkul wohi snapshot dobara print, ya void. */
@Component({
  selector: 'app-letter-view',
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './letter-view.html',
  styleUrls: ['./rb-shared.css', './letter-view.css']
})
export class LetterViewComponent {
  private readonly api = inject(ReportBuilderService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly lang = inject(LanguageService).language;
  readonly utc = utc;
  readonly canVoid = inject(PermissionService).hasAny(P.lettersIssue);
  readonly id = this.route.snapshot.paramMap.get('id')!;

  readonly letter = signal<IssuedLetter | null>(null);
  readonly html = signal<SafeHtml | null>(null);
  readonly error = signal<string | null>(null);
  voiding = false;
  voidReason = '';
  busy = false;

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.letter(this.id).subscribe({
      next: l => {
        this.letter.set(l);
        // Snapshot issue ke waqt server par HtmlSanitizer se guzra; text-align (style) rakhne ke liye bypass.
        this.html.set(this.sanitizer.bypassSecurityTrustHtml(l.html));
      },
      error: e => this.error.set(PayrollService.errorMessage(e, this.translate.instant('rb.loadFailed')))
    });
  }

  print(): void {
    const l = this.letter();
    if (l) setPrintPage(l.paper, false);
    window.print();
  }

  doVoid(): void {
    if (!this.voidReason.trim()) return;
    this.busy = true;
    this.api.voidLetter(this.id, this.voidReason.trim()).subscribe({
      next: () => {
        this.busy = false;
        this.voiding = false;
        this.alert.success(this.translate.instant('rb.voided'));
        this.load();
      },
      error: e => {
        this.busy = false;
        this.alert.error(PayrollService.errorMessage(e, this.translate.instant('rb.failed')));
      }
    });
  }
}
