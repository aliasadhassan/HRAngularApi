import { Component, ElementRef, Input, AfterViewInit, OnDestroy, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  standalone: true,
  templateUrl: './chart.html',
  styleUrls: ['./chart.css']
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() type: 'line' | 'bar' | 'doughnut' = 'line';
  @Input() labels: string[] = [];
  @Input() datasets: any[] = [];
  @Input() options: any = {};

  private chart?: Chart;

  private defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'IBM Plex Mono', monospace", size: 11 }, color: '#6B6A5F' }
      },
      y: {
        grid: { color: '#DCD3BE' },
        ticks: { font: { family: "'IBM Plex Mono', monospace", size: 11 }, color: '#6B6A5F' }
      }
    }
  };

  ngAfterViewInit() {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['labels'] || changes['datasets'])) {
      this.chart.data.labels = this.labels;
      this.chart.data.datasets = this.datasets;
      this.chart.update();
    }
  }

  private render() {
    const isDonut = this.type === 'doughnut';
    const baseOptions = isDonut
      ? { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
      : this.defaultOptions;

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: this.type,
      data: { labels: this.labels, datasets: this.datasets },
      options: { ...baseOptions, ...this.options }
    });
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}