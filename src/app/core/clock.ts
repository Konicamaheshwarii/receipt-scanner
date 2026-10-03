import { Injectable } from '@angular/core';
import { isoDate } from './parse';

/** Wraps "now" so tests can pin the date. */
@Injectable({ providedIn: 'root' })
export class Clock {
  now(): Date {
    return new Date();
  }

  today(): string {
    return isoDate(this.now());
  }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
