import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { P, PermissionService } from '../../../core/auth/permissions';
import { AlertService } from '../../../services/alert/alert';
import { PayrollService } from '../../payroll/payroll.service';
import { PeopleService } from '../../people/people.service';
import { Location } from '../../people/people.models';
import { AttendanceService } from '../attendance.service';
import { ApproverType, AttendanceDevice, AttendancePolicy, ClockInMethod, SaveDevice, SavePolicy, SaveShift, Shift, hm } from '../attendance.models';

type Tab = 'shifts' | 'policies' | 'devices';
type Drawer = 'shift' | 'policy' | 'device' | null;

const COLORS = ['#4F6F52', '#B08D3E', '#8C3B2E', '#3E5C76', '#7A5C99', '#B8712E', '#5B6B5E'];
const METHODS: ClockInMethod[] = ['Web', 'Mobile', 'Biometric'];

/** "09:00:00" → "09:00" (input type=time) aur wapis. */
const toInput = (t: string) => t.slice(0, 5);
const toApi = (t: string) => (t.length === 5 ? `${t}:00` : t);

@Component({
  selector: 'app-attendance-setup',
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './attendance-setup.html',
  styleUrl: './attendance-setup.css'
})
export class AttendanceSetupComponent {
  private readonly api = inject(AttendanceService);
  private readonly people = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly lang = inject(LanguageService).language;
  readonly canSeeDevices = inject(PermissionService).hasAny([P.settingsView, P.settingsManage]);
  readonly tabs: Tab[] = ['shifts', 'policies', 'devices'];
  readonly tab = signal<Tab>('shifts');
  readonly colors = COLORS;
  readonly methods = METHODS;
  readonly approvers: ApproverType[] = ['LineManager', 'DepartmentHead', 'HR'];
  readonly hm = hm;
  readonly time = toInput;

  readonly shifts = signal<Shift[]>([]);
  readonly policies = signal<AttendancePolicy[]>([]);
  readonly devices = signal<AttendanceDevice[]>([]);
  readonly locations = signal<Location[]>([]);

  readonly drawer = signal<Drawer>(null);
  readonly saving = signal(false);
  editingId: string | null = null;
  shiftForm = this.emptyShift();
  policyForm = this.emptyPolicy();
  policyMethods = new Set<ClockInMethod>(['Web', 'Mobile']);
  deviceForm: SaveDevice = this.emptyDevice();

  constructor() {
    this.loadAll();
    this.people.getLocations().subscribe({ next: l => this.locations.set(l.filter(x => x.isActive)) });
  }

  loadAll(): void {
    this.api.shifts(true).subscribe({ next: s => this.shifts.set(s), error: e => this.fail(e, 'attendance.errors.load') });
    this.api.policies().subscribe({ next: p => this.policies.set(p) });
    if (this.canSeeDevices) this.api.devices().subscribe({ next: d => this.devices.set(d) });
  }

  methodList(flags: string): string[] {
    return flags.split(',').map(m => m.trim()).filter(Boolean);
  }

  // ── Shifts ──
  openShift(s?: Shift): void {
    this.editingId = s?.id ?? null;
    this.shiftForm = s
      ? {
          name: s.name, code: s.code, color: s.color, startTime: toInput(s.startTime), endTime: toInput(s.endTime),
          breakMinutes: s.breakMinutes, graceInMinutes: s.graceInMinutes, graceOutMinutes: s.graceOutMinutes,
          isFlexible: s.isFlexible, isActive: s.isActive
        }
      : this.emptyShift();
    this.drawer.set('shift');
  }

  /** Drawer mein live: raat ki shift? net kitne ghante? */
  shiftPreview(): { overnight: boolean; net: number } {
    const f = this.shiftForm;
    if (!f.startTime || !f.endTime) return { overnight: false, net: 0 };
    const mins = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
    let span = mins(f.endTime) - mins(f.startTime);
    const overnight = span <= 0;
    if (overnight) span += 24 * 60;
    return { overnight, net: Math.max(0, span - (+f.breakMinutes || 0)) };
  }

  // ── Policies ──
  openPolicy(p?: AttendancePolicy): void {
    this.editingId = p?.id ?? null;
    if (p) {
      const { id: _, locationName: __, ...rest } = p;
      this.policyForm = { ...rest };
    } else {
      this.policyForm = this.emptyPolicy();
    }
    this.policyMethods = new Set(this.methodList(this.policyForm.allowedMethods) as ClockInMethod[]);
    this.drawer.set('policy');
  }

  toggleMethod(m: ClockInMethod): void {
    if (this.policyMethods.has(m)) this.policyMethods.delete(m);
    else this.policyMethods.add(m);
  }

  // ── Devices ──
  openDevice(d?: AttendanceDevice): void {
    this.editingId = d?.id ?? null;
    this.deviceForm = d
      ? { name: d.name, serialNumber: d.serialNumber, vendor: d.vendor, locationId: d.locationId, isActive: d.isActive }
      : this.emptyDevice();
    this.drawer.set('device');
  }

  // ── Save ──
  save(): void {
    const d = this.drawer();
    const id = this.editingId ?? undefined;
    const num = (v: unknown) => (v === null || v === '' || v === undefined ? null : +v);
    let req: Observable<unknown>;
    if (d === 'shift') {
      const f = this.shiftForm;
      req = this.api.saveShift({
        ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), startTime: toApi(f.startTime), endTime: toApi(f.endTime),
        breakMinutes: +f.breakMinutes, graceInMinutes: +f.graceInMinutes, graceOutMinutes: +f.graceOutMinutes
      }, id);
    } else if (d === 'policy') {
      const f = this.policyForm;
      req = this.api.savePolicy({
        ...f, name: f.name.trim(), locationId: f.locationId || null,
        allowedMethods: METHODS.filter(m => this.policyMethods.has(m)).join(', '),
        fullDayMinutes: +f.fullDayMinutes, halfDayMinutes: +f.halfDayMinutes, latesPerHalfDay: num(f.latesPerHalfDay),
        geoLatitude: f.requireGeofence ? num(f.geoLatitude) : null,
        geoLongitude: f.requireGeofence ? num(f.geoLongitude) : null,
        geoRadiusMeters: f.requireGeofence ? num(f.geoRadiusMeters) : null,
        correctionWindowDays: +f.correctionWindowDays, maxCorrectionsPerMonth: num(f.maxCorrectionsPerMonth),
        overtimeMinMinutes: +f.overtimeMinMinutes, overtimeMaxMinutesPerDay: num(f.overtimeMaxMinutesPerDay),
        overtimeRateWorkday: +f.overtimeRateWorkday, overtimeRateWeeklyOff: +f.overtimeRateWeeklyOff, overtimeRateHoliday: +f.overtimeRateHoliday
      }, id);
    } else {
      const f = this.deviceForm;
      req = this.api.saveDevice({ ...f, name: f.name.trim(), serialNumber: f.serialNumber.trim(), vendor: f.vendor?.trim() || null }, id);
    }
    this.run(req, () => {
      this.drawer.set(null);
      this.loadAll();
    });
  }

  /** Browser se current location (geofence ka center set karne ke liye). */
  useMyLocation(): void {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        this.policyForm.geoLatitude = +pos.coords.latitude.toFixed(6);
        this.policyForm.geoLongitude = +pos.coords.longitude.toFixed(6);
      },
      () => this.alert.error(this.translate.instant('attendance.errors.location'))
    );
  }

  valid(): boolean {
    const d = this.drawer();
    if (d === 'shift') {
      const f = this.shiftForm;
      return !!(f.name.trim() && f.code.trim() && f.startTime && f.endTime && f.startTime !== f.endTime);
    }
    if (d === 'policy') {
      const f = this.policyForm;
      const geoOk = !f.requireGeofence || (f.geoLatitude !== null && f.geoLongitude !== null && !!f.geoRadiusMeters);
      return !!(f.name.trim() && this.policyMethods.size && +f.halfDayMinutes < +f.fullDayMinutes && geoOk);
    }
    return !!(this.deviceForm.name.trim() && this.deviceForm.serialNumber.trim() && this.deviceForm.locationId);
  }

  private run(req: Observable<unknown>, after: () => void): void {
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.success(this.translate.instant('payrollSetup.saved'));
        after();
      },
      error: e => {
        this.saving.set(false);
        this.fail(e, 'payrollSetup.errors.save');
      }
    });
  }

  private fail(e: unknown, key: string): void {
    this.alert.error(PayrollService.errorMessage(e, this.translate.instant(key)));
  }

  private emptyShift(): SaveShift {
    return {
      name: '', code: '', color: COLORS[0], startTime: '09:00', endTime: '18:00', breakMinutes: 60,
      graceInMinutes: 15, graceOutMinutes: 0, isFlexible: false, isActive: true
    };
  }

  private emptyPolicy(): SavePolicy {
    return {
      name: '', locationId: null, isActive: true, fullDayMinutes: 360, halfDayMinutes: 240, latesPerHalfDay: null,
      allowedMethods: 'Web, Mobile', requireGeofence: false, geoLatitude: null, geoLongitude: null, geoRadiusMeters: 200,
      requestApprover: 'LineManager', correctionWindowDays: 7, maxCorrectionsPerMonth: null,
      overtimeEnabled: false, overtimeMinMinutes: 30, overtimeMaxMinutesPerDay: 240, overtimeRequiresApproval: true,
      overtimeRateWorkday: 1.5, overtimeRateWeeklyOff: 2, overtimeRateHoliday: 2
    };
  }

  private emptyDevice(): SaveDevice {
    return { name: '', serialNumber: '', vendor: null, locationId: this.locations()[0]?.id ?? '', isActive: true };
  }
}
