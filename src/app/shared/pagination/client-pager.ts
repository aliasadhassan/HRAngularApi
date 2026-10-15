import { Signal, computed, signal } from '@angular/core';
import { DEFAULT_PAGE_SIZE } from './pagination';

/**
 * Jo list poori aa chuki ho (API sab bhejti hai, ya filter client pe hai) usko page mein katna.
 * Field initializer mein banao: `readonly rowsPager = clientPager(this.filteredRows);`
 * Template:
 *   @for (r of rowsPager.rows(); track r.id) { ... }
 *   @if (rowsPager.total() > 0) {
 *     <app-pagination [page]="rowsPager.page()" [pageSize]="rowsPager.pageSize()" [total]="rowsPager.total()"
 *                     (pageChange)="rowsPager.setPage($event)" (pageSizeChange)="rowsPager.setPageSize($event)" />
 *   }
 * Filter/search badle to `reset()` (page 1). Record kam ho jayen to page khud aakhri page pe aa jata hai.
 */
export interface ClientPager<T> {
  /** Dikhaya ja raha page (list se bahar ho to aakhri page) */
  readonly page: Signal<number>;
  readonly pageSize: Signal<number>;
  readonly total: Signal<number>;
  readonly rows: Signal<T[]>;
  setPage(page: number): void;
  setPageSize(size: number): void;
  reset(): void;
}

export function clientPager<T>(source: () => readonly T[], initialSize = DEFAULT_PAGE_SIZE): ClientPager<T> {
  const requested = signal(1);
  const pageSize = signal(initialSize);
  const total = computed(() => source().length);
  const page = computed(() => Math.min(requested(), Math.max(1, Math.ceil(total() / pageSize()))));
  const rows = computed(() => {
    const size = pageSize();
    const start = (page() - 1) * size;
    return source().slice(start, start + size);
  });
  return {
    page,
    pageSize: pageSize.asReadonly(),
    total,
    rows,
    setPage: p => requested.set(p),
    setPageSize: s => {
      pageSize.set(s);
      requested.set(1);
    },
    reset: () => requested.set(1)
  };
}
