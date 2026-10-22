import { Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy, inject } from '@angular/core';

/**
 * Animates a number from its previous value to the new one.
 * Pass the same locale the rest of the page uses so digits stay consistent
 * (e.g. `${lang()}-u-nu-latn`).
 *
 * Put it on an element that has NO interpolation inside; it owns the text:
 *   <span [appCountUp]="s.headcount" [locale]="numLocale()"></span>
 *   <span [appCountUp]="s.averageTenureYears" [decimals]="1" [locale]="numLocale()"></span>
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('appCountUp') value: number | null | undefined = 0;
  @Input() decimals = 0;
  @Input() duration = 900; // ms
  @Input() locale = 'en-US';

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  private current = 0;
  private rafId = 0;

  ngOnChanges(): void {
    const target = Number(this.value) || 0;
    cancelAnimationFrame(this.rafId);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || this.duration <= 0) {
      this.current = target;
      this.render(target);
      return;
    }

    const from = this.current;
    this.render(from);
    const start = performance.now();

    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => {
        const p = Math.min((now - start) / this.duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        this.current = p === 1 ? target : from + (target - from) * eased;
        this.render(this.current);
        if (p < 1) this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }

  private render(n: number): void {
    this.el.textContent = new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: this.decimals,
      maximumFractionDigits: this.decimals,
    }).format(n);
  }
}
