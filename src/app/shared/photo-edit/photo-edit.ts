import { Component, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MyPhotoService } from '../../core/auth/my-photo';
import { PayrollService } from '../../pages/payroll/payroll.service';
import { PeopleService } from '../../pages/people/people.service';
import { AlertService } from '../../services/alert/alert';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Avatar circle (ng-content) ke kone pe camera button: upload / change / remove.
 * Asal resize + WebP server karta hai; yahan sirf type/size ki jaldi wali check.
 */
@Component({
  selector: 'app-photo-edit',
  imports: [TranslatePipe],
  templateUrl: './photo-edit.html',
  styleUrl: './photo-edit.css'
})
export class PhotoEditComponent {
  private readonly api = inject(PeopleService);
  private readonly alert = inject(AlertService);
  private readonly translate = inject(TranslateService);
  private readonly myPhoto = inject(MyPhotoService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly employeeId = input.required<string>();
  readonly hasPhoto = input(false);
  readonly canChange = input(false);
  readonly photoChange = output<string | null>();

  readonly busy = signal(false);
  readonly menuOpen = signal(false);
  private readonly file = viewChild.required<ElementRef<HTMLInputElement>>('file');

  @HostListener('document:click', ['$event'])
  closeOnOutside(e: MouseEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(e.target as Node)) this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.menuOpen.set(false);
  }

  open(): void {
    if (this.busy()) return;
    if (this.hasPhoto()) this.menuOpen.update(v => !v);
    else this.choose();
  }

  choose(): void {
    this.menuOpen.set(false);
    this.file().nativeElement.click();
  }

  onFile(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';   // same file dobara chunne pe bhi change fire ho
    if (!file) return;
    if (!TYPES.includes(file.type)) return this.alert.error(this.translate.instant('people.photo.badType'));
    if (file.size > MAX_BYTES) return this.alert.error(this.translate.instant('people.photo.tooLarge'));

    this.busy.set(true);
    this.api.uploadPhoto(this.employeeId(), file).subscribe({
      next: r => this.done(r.photoUrl, 'people.photo.saved'),
      error: err => this.fail(err)
    });
  }

  remove(): void {
    this.menuOpen.set(false);
    this.busy.set(true);
    this.api.removePhoto(this.employeeId()).subscribe({
      next: () => this.done(null, 'people.photo.removed'),
      error: err => this.fail(err)
    });
  }

  private done(url: string | null, key: string): void {
    this.busy.set(false);
    this.myPhoto.changed(this.employeeId(), url);
    this.photoChange.emit(url);
    this.alert.success(this.translate.instant(key));
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const off = err instanceof HttpErrorResponse && err.status === 503;
    this.alert.error(off
      ? this.translate.instant('people.photo.off')
      : PayrollService.errorMessage(err, this.translate.instant('people.photo.error')));
  }
}
