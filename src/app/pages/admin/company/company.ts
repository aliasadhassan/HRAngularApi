import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { P, PermissionService } from '../../../core/auth/permissions';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { AdminService } from '../admin.service';
import { Company, CompanyProfile, CompanySettings } from '../admin.models';

type Section = 'profile' | 'regional' | 'security';

/** Mon=1, Tue=2 … Sun=64 — backend ka bitmask */
const DAYS = [
  { bit: 1, key: 'mon' },
  { bit: 2, key: 'tue' },
  { bit: 4, key: 'wed' },
  { bit: 8, key: 'thu' },
  { bit: 16, key: 'fri' },
  { bit: 32, key: 'sat' },
  { bit: 64, key: 'sun' }
];

const CURRENCIES = ['PKR', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'USD', 'GBP', 'EUR'];
const DATE_FORMATS = ['dd-MMM-yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];

@Component({
  selector: 'app-company',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './company.html',
  styleUrl: './company.css'
})
export class CompanyComponent {
  private readonly api = inject(AdminService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly canEdit = inject(PermissionService).hasAny(P.settingsManage);

  readonly days = DAYS;
  readonly currencies = CURRENCIES;
  readonly dateFormats = DATE_FORMATS;
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  /** Browser ki IANA list; purane browsers pe chhoti list */
  readonly timeZones: string[] =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat', 'Europe/London', 'UTC'];

  readonly company = signal<Company | null>(null);
  readonly saving = signal<Section | null>(null);
  readonly logoBroken = signal(false);

  profile: Pick<CompanyProfile, 'name' | 'legalName' | 'logoUrl' | 'primaryEmail' | 'phone'> = {
    name: '', legalName: null, logoUrl: null, primaryEmail: null, phone: null
  };
  settings: CompanySettings = {
    timeZone: 'Asia/Karachi', currency: 'PKR', dateFormat: 'dd-MMM-yyyy',
    fiscalYearStartMonth: 7, workWeekDays: 31, passwordMinLength: 8, maxFailedLoginAttempts: 5
  };

  readonly initials = computed(() => {
    const name = this.company()?.profile.name ?? '';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'HR';
  });

  constructor() {
    this.api.getCompany().subscribe({
      next: c => this.apply(c),
      error: err => this.alert.error(this.msg(err, 'admin.company.errorLoad'))
    });
  }

  // ───── Dirty checks ─────
  profileDirty(): boolean {
    const p = this.company()?.profile;
    if (!p) return false;
    return (
      this.profile.name.trim() !== p.name ||
      this.norm(this.profile.legalName) !== p.legalName ||
      this.norm(this.profile.logoUrl) !== p.logoUrl ||
      this.norm(this.profile.primaryEmail) !== p.primaryEmail ||
      this.norm(this.profile.phone) !== p.phone
    );
  }

  regionalDirty(): boolean {
    const s = this.company()?.settings;
    if (!s) return false;
    return (
      this.settings.timeZone !== s.timeZone ||
      this.settings.currency !== s.currency ||
      this.settings.dateFormat !== s.dateFormat ||
      +this.settings.fiscalYearStartMonth !== s.fiscalYearStartMonth ||
      this.settings.workWeekDays !== s.workWeekDays
    );
  }

  securityDirty(): boolean {
    const s = this.company()?.settings;
    if (!s) return false;
    return +this.settings.passwordMinLength !== s.passwordMinLength || +this.settings.maxFailedLoginAttempts !== s.maxFailedLoginAttempts;
  }

  // ───── Work week ─────
  isWorkDay(bit: number): boolean {
    return (this.settings.workWeekDays & bit) !== 0;
  }

  toggleDay(bit: number): void {
    if (!this.canEdit) return;
    const next = this.settings.workWeekDays ^ bit;
    if (next === 0) return; // kam az kam ek din
    this.settings = { ...this.settings, workWeekDays: next };
  }

  workDayCount(): number {
    return DAYS.filter(d => this.isWorkDay(d.bit)).length;
  }

  // ───── Previews ─────
  datePreview(format: string): string {
    const d = new Date(2026, 9, 1);
    const dd = '01', MM = '10', yyyy = '2026';
    const MMM = new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { month: 'short' }).format(d);
    return format.replace('dd', dd).replace('MMM', MMM).replace('MM', MM).replace('yyyy', yyyy);
  }

  monthName(m: number): string {
    return new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { month: 'long' }).format(new Date(2026, m - 1, 1));
  }

  timeNow(zone: string): string {
    try {
      return new Intl.DateTimeFormat(`${this.lang()}-u-nu-latn`, { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date());
    } catch {
      return '';
    }
  }

  // ───── Save ─────
  saveProfile(): void {
    if (!this.profile.name.trim()) return;
    this.run('profile', this.api.updateCompanyProfile({
      name: this.profile.name.trim(),
      legalName: this.norm(this.profile.legalName),
      logoUrl: this.norm(this.profile.logoUrl),
      primaryEmail: this.norm(this.profile.primaryEmail),
      phone: this.norm(this.profile.phone)
    }));
  }

  saveSettings(section: 'regional' | 'security'): void {
    const saved = this.company()!.settings;
    // Sirf apna section bhejo — doosre section ki unsaved edits chupke se save na hon
    const payload: CompanySettings = { ...saved, ...this.pick(section, this.settings) };
    this.run(section, this.api.updateCompanySettings(payload));
  }

  reset(section: Section): void {
    const c = this.company();
    if (!c) return;
    if (section === 'profile') this.profile = this.copyProfile(c);
    else this.settings = { ...this.settings, ...this.pick(section, c.settings) };
  }

  private run(section: Section, request: Observable<Company>): void {
    this.saving.set(section);
    request.subscribe({
      next: c => {
        this.saving.set(null);
        this.company.set(c);
        // Sirf saved section form mein refresh — baqi sections ki unsaved edits wahi rahein
        if (section === 'profile') {
          this.profile = this.copyProfile(c);
          this.logoBroken.set(false);
        } else {
          this.settings = { ...this.settings, ...this.pick(section, c.settings) };
        }
        this.alert.success(this.translate.instant('admin.company.saved'));
      },
      error: err => {
        this.saving.set(null);
        this.alert.error(this.msg(err, 'admin.errors.save'));
      }
    });
  }

  private pick(section: 'regional' | 'security', from: CompanySettings): Partial<CompanySettings> {
    return section === 'regional'
      ? {
          timeZone: from.timeZone,
          currency: from.currency,
          dateFormat: from.dateFormat,
          fiscalYearStartMonth: +from.fiscalYearStartMonth,
          workWeekDays: from.workWeekDays
        }
      : { passwordMinLength: +from.passwordMinLength, maxFailedLoginAttempts: +from.maxFailedLoginAttempts };
  }

  private apply(c: Company): void {
    this.company.set(c);
    this.profile = this.copyProfile(c);
    this.settings = { ...c.settings };
    this.logoBroken.set(false);
  }

  private copyProfile(c: Company) {
    const p = c.profile;
    return { name: p.name, legalName: p.legalName, logoUrl: p.logoUrl, primaryEmail: p.primaryEmail, phone: p.phone };
  }

  private norm(v: string | null): string | null {
    return v && v.trim() ? v.trim() : null;
  }

  private msg(err: unknown, key: string): string {
    return PayrollService.errorMessage(err, this.translate.instant(key));
  }
}
