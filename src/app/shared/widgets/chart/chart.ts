import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import Chart from 'chart.js/auto';

type Dict = Record<string, any>;

function isPlainObject(v: unknown): v is Dict {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Nested options sahi se merge hon (e.g. sirf scales.y dene se scales.x ki styling na mite). */
function deepMerge(base: Dict, extra: Dict): Dict {
  const out: Dict = { ...base };
  for (const [key, value] of Object.entries(extra ?? {})) {
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out;
}

const FONT = { family: "'Inter', 'Segoe UI', sans-serif", size: 11 };
const MUTED = '#8d938b';
const RULE = '#e3e6dd';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.html',
  styleUrl: './chart.css'
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() type: 'line' | 'bar' | 'doughnut' = 'line';
  @Input() labels: string[] = [];
  @Input() datasets: any[] = [];
  @Input() options: Dict = {};

  private chart?: Chart;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(): void {
    // Language/direction badalne pe options bhi badalte hain — dobara bana dena sab se saaf hai
    if (this.chart) this.render();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    this.chart?.destroy();
    const rtl = document.documentElement.dir === 'rtl';

    const tooltip = {
      rtl,
      backgroundColor: '#13211a',
      titleColor: '#eceee6',
      bodyColor: '#eceee6',
      titleFont: { ...FONT, size: 12, weight: 600 },
      bodyFont: { ...FONT, size: 12 },
      padding: 10,
      cornerRadius: 6,
      displayColors: false
    };

    const base: Dict =
      this.type === 'doughnut'
        ? {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: { legend: { display: false }, tooltip }
          }
        : {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip },
            scales: {
              x: {
                reverse: rtl,
                grid: { display: false },
                border: { color: RULE },
                ticks: { font: FONT, color: MUTED, maxRotation: 0, autoSkipPadding: 12 }
              },
              y: {
                position: rtl ? 'right' : 'left',
                grid: { color: RULE },
                border: { display: false },
                ticks: { font: FONT, color: MUTED, padding: 8 }
              }
            }
          };

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: { labels: this.labels, datasets: this.datasets },
      options: deepMerge(base, this.options) as any
    });
  }
}
