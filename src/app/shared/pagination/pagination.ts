import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Page size options sab list pages pe same. API bhi 200 tak allow karti hai. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 10;

type PageItem = number | 'gap-start' | 'gap-end';

/**
 * Standard list footer: "Rows per page" dropdown, range ("11–20 of 57") aur page numbers.
 * Parent page/pageSize rakhta hai aur (pageChange)/(pageSizeChange) pe data reload karta hai.
 * Size badalne pe parent page 1 pe wapis jaye.
 */
@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe],
  templateUrl: './pagination.html',
  styleUrl: './pagination.css'
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSizeOptions = input<readonly number[]>(PAGE_SIZE_OPTIONS);
  readonly disabled = input(false);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  /** 1 … 4 5 6 … 12 — pehla, aakhri, current ke aas paas 1-1; chhoti list me sab numbers. */
  readonly items = computed<PageItem[]>(() => {
    const last = this.pages();
    const cur = Math.min(this.page(), last);
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    let start = Math.max(2, cur - 1);
    let end = Math.min(last - 1, cur + 1);
    if (cur <= 4) { start = 2; end = 5; }
    if (cur >= last - 3) { start = last - 4; end = last - 1; }
    const out: PageItem[] = [1];
    if (start > 2) out.push('gap-start');
    for (let p = start; p <= end; p++) out.push(p);
    if (end < last - 1) out.push('gap-end');
    out.push(last);
    return out;
  });

  go(p: number): void {
    if (this.disabled() || p < 1 || p > this.pages() || p === this.page()) return;
    this.pageChange.emit(p);
  }

  setSize(value: string): void {
    const size = Number(value);
    if (!size || size === this.pageSize()) return;
    this.pageSizeChange.emit(size);
  }

  isPage(item: PageItem): item is number {
    return typeof item === 'number';
  }
}
