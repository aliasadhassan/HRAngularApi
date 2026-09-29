import { Pipe, PipeTransform } from '@angular/core';

export type AmountStyle = 'full' | 'compact' | 'plain';

/**
 * Paise dikhane ka ek hi tareeqa. Digits hamesha Latin (1,234) — Arabic UI mein bhi,
 * jaise Gulf/PK business software mein hota hai.
 *   {{ 18436210 | amount: lang() }}             → 18,436,210
 *   {{ 19820000 | amount: lang() : 'compact' }} → 19.8M
 */
@Pipe({ name: 'amount' })
export class AmountPipe implements PipeTransform {
  transform(value: number | null | undefined, lang = 'en', style: AmountStyle = 'full', decimals = 0): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';

    const locale = `${lang}-u-nu-latn`;
    const options: Intl.NumberFormatOptions =
      style === 'compact'
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: style !== 'plain' };

    return new Intl.NumberFormat(locale, options).format(value);
  }
}
