import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../core/parse';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency: string, compact = false): string {
    return value === null || value === undefined ? '' : formatMoney(value, currency, compact);
  }
}
