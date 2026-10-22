import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Subtle 3D tilt that follows the mouse.
 *
 * <article class="note" appTilt [tiltMax]="2.5" [tiltLift]="0"> ... </article>
 *
 * - mouse only (touch scrolling is left alone)
 * - skipped when the user prefers reduced motion
 * - never touches box-shadow unless you pass [tiltShadow]
 */
@Directive({
  selector: '[appTilt]',
})
export class TiltDirective implements OnInit, OnDestroy {
  /** Max rotation in degrees */
  @Input() tiltMax = 6;
  /** Lift on hover in px */
  @Input() tiltLift = 3;
  /** Optional hover shadow; empty = leave the element's own shadow alone */
  @Input() tiltShadow = '';

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  ngOnInit(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      this.el.style.willChange = 'transform';
      this.el.addEventListener('pointermove', this.onMove);
      this.el.addEventListener('pointerleave', this.onLeave);
    });
  }

  ngOnDestroy(): void {
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = this.el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    this.el.style.transition = 'transform 0.08s ease-out';
    this.el.style.transform =
      `perspective(900px) rotateY(${x * this.tiltMax}deg) rotateX(${-y * this.tiltMax}deg) translateY(${-this.tiltLift}px)`;
    if (this.tiltShadow) this.el.style.boxShadow = this.tiltShadow;
  };

  private onLeave = () => {
    this.el.style.transition = 'transform 0.4s ease, box-shadow 0.4s ease';
    this.el.style.transform = '';
    if (this.tiltShadow) this.el.style.boxShadow = '';
  };
}
