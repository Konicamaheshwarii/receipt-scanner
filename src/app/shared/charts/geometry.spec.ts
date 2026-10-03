import { fitWithin } from '../../core/image';
import { arcPath, columnPath, niceTicks } from './geometry';

describe('chart geometry', () => {
  it('picks round axis ticks that cover the maximum', () => {
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(400)).toEqual([0, 100, 200, 300, 400]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(3.2)).toEqual([0, 1, 2, 3, 4]);
  });

  it('draws columns with a rounded top and nothing for zero values', () => {
    expect(columnPath(10, 20, 12, 50)).toBe('M10 70V24Q10 20 14 20H18Q22 20 22 24V70Z');
    expect(columnPath(0, 0, 10, 0)).toBe('');
  });

  it('draws donut arcs with the large-arc flag past 180 degrees', () => {
    expect(arcPath(100, 100, 90, 60, 0, Math.PI / 2)).toContain('A90 90 0 0 1');
    expect(arcPath(100, 100, 90, 60, 0, Math.PI * 1.5)).toContain('A90 90 0 1 1');
  });

  it('scales images down to the long edge but never up', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 2400, 1600)).toEqual({ width: 720, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
