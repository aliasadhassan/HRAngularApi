import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';

/**
 * Animated brass particle wave for the payroll banknote.
 * Replaces the static guilloche SVG. Colours come from the app's own
 * --brass token, RTL mirrors automatically, and if WebGL is unavailable
 * the component hides itself (the note's gradient background remains).
 *
 * Parent needs: position: relative; overflow: hidden  (.note already has both)
 */
@Component({
  selector: 'app-payroll-bg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas></canvas>`,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
        overflow: hidden;
        border-radius: inherit;
        /* keep the left side calmer so the amount stays readable */
        -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.45) 35%, #000 65%);
        mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.45) 35%, #000 65%);
      }
      :host-context([dir='rtl']) {
        -webkit-mask-image: linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.45) 35%, #000 65%);
        mask-image: linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.45) 35%, #000 65%);
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class PayrollBgComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private points!: THREE.Points;
  private lines!: THREE.LineSegments;
  private basePositions!: Float32Array;
  private readonly group = new THREE.Group();

  private ready = false;
  private running = false;
  private rafId = 0;
  private lastT = 2;
  private dir = 1; // 1 = LTR, -1 = RTL
  private readonly clock = new THREE.Clock();
  private readonly mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  private reduceMotion = false;

  private resizeObs?: ResizeObserver;
  private intersectObs?: IntersectionObserver;
  private dirObs?: MutationObserver;
  private parent?: HTMLElement | null;

  private readonly COLS = 80;
  private readonly ROWS = 36;

  ngAfterViewInit(): void {
    // Three.js stays outside Angular change detection
    this.zone.runOutsideAngular(() => {
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try {
        this.initScene();
      } catch {
        this.host.nativeElement.style.display = 'none'; // no WebGL: fall back to the plain note
        return;
      }
      this.ready = true;
      this.bindEvents();
      this.start();
    });
  }

  ngOnDestroy(): void {
    this.stop();
    this.resizeObs?.disconnect();
    this.intersectObs?.disconnect();
    this.dirObs?.disconnect();
    this.parent?.removeEventListener('pointermove', this.onPointerMove);
    this.parent?.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (!this.ready) return;
    this.points.geometry.dispose();
    this.lines.geometry.dispose();
    const pm = this.points.material as THREE.PointsMaterial;
    pm.map?.dispose();
    pm.dispose();
    (this.lines.material as THREE.LineBasicMaterial).dispose();
    this.renderer.dispose();
  }

  /* ---------------- Scene ---------------- */

  private initScene(): void {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvasRef().nativeElement, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 7);

    // Use the app's own palette
    const css = getComputedStyle(this.host.nativeElement);
    const brass = new THREE.Color(css.getPropertyValue('--brass').trim() || '#b08d3e');
    const pale = new THREE.Color('#f0d68f');

    const width = 13;
    const height = 6;
    const count = this.COLS * this.ROWS;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    let i = 0;
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        positions[i * 3] = (c / (this.COLS - 1) - 0.5) * width;
        positions[i * 3 + 1] = (r / (this.ROWS - 1) - 0.5) * height;
        positions[i * 3 + 2] = 0;
        // brighter mix so the dots stand out on the dark card
        const col = brass.clone().lerp(pale, 0.35 + Math.random() * 0.65);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
        i++;
      }
    }
    this.basePositions = positions.slice();

    const posAttr = new THREE.BufferAttribute(positions, 3);

    // dots
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', posAttr);
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.13,
      map: this.makeDot(),
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(pGeo, pMat);

    // faint engraved lines along each row (share the same position attribute, so they animate together)
    const indices: number[] = [];
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS - 1; c++) {
        const a = r * this.COLS + c;
        indices.push(a, a + 1);
      }
    }
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', posAttr);
    lGeo.setIndex(indices);
    const lMat = new THREE.LineBasicMaterial({
      color: brass,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(lGeo, lMat);

    this.group.add(this.lines, this.points);
    this.group.rotation.x = -1.0;
    this.group.position.y = -0.5;
    this.scene.add(this.group);

    this.applyDirection();
    this.resize();
  }

  private makeDot(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  private applyDirection(): void {
    this.dir = getComputedStyle(this.host.nativeElement).direction === 'rtl' ? -1 : 1;
    this.group.position.x = 1.8 * this.dir;
    this.group.rotation.z = 0.15 * this.dir;
    if (!this.running && this.ready) this.renderFrame(this.lastT);
  }

  /* ---------------- Events ---------------- */

  private bindEvents(): void {
    this.parent = this.host.nativeElement.parentElement;
    this.parent?.addEventListener('pointermove', this.onPointerMove);
    this.parent?.addEventListener('pointerleave', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.host.nativeElement);

    // language switch can flip dir without recreating the component
    this.dirObs = new MutationObserver(() => this.applyDirection());
    this.dirObs.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });

    // pause when the note is scrolled out of view
    this.intersectObs = new IntersectionObserver(([entry]) => (entry.isIntersecting ? this.start() : this.stop()));
    this.intersectObs.observe(this.host.nativeElement);
  }

  private onPointerMove = (e: PointerEvent) => {
    const r = this.host.nativeElement.getBoundingClientRect();
    this.mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    this.mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };

  private onPointerLeave = () => {
    this.mouse.tx = 0;
    this.mouse.ty = 0;
  };

  private onVisibility = () => (document.hidden ? this.stop() : this.start());

  private resize(): void {
    const el = this.host.nativeElement;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.renderFrame(this.lastT);
  }

  /* ---------------- Loop ---------------- */

  private start(): void {
    if (!this.ready || this.running) return;
    if (this.reduceMotion) {
      this.renderFrame(this.lastT); // single static frame
      return;
    }
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      this.renderFrame(this.clock.getElapsedTime());
    };
    loop();
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private renderFrame(t: number): void {
    this.lastT = t;
    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const base = this.basePositions;

    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      arr[i + 2] =
        Math.sin(x * 0.7 + t * 0.9) * 0.5 +
        Math.cos(y * 1.2 + t * 0.7) * 0.4 +
        Math.sin((x + y) * 0.5 + t * 0.5) * 0.3;
    }
    attr.needsUpdate = true;

    this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.05;
    this.group.rotation.y = this.mouse.x * 0.3;
    this.group.rotation.x = -1.0 + this.mouse.y * 0.15;

    this.renderer.render(this.scene, this.camera);
  }
}