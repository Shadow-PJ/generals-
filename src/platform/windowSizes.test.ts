import { describe, expect, it } from 'vitest';
import { windowScales } from './windowSizes';

const BASE = { width: 960, height: 704 };

describe('window sizes', () => {
  it('offers only sizes that fit the screen with room for the title bar', () => {
    // A 1080p screen with a taskbar: 1920×1040 free.
    expect(windowScales({ width: 1920, height: 1040 }, BASE)).toEqual([1, 1.25]);
    // 1440p: 2560×1400 free.
    expect(windowScales({ width: 2560, height: 1400 }, BASE)).toEqual([1, 1.25, 1.5, 1.75]);
    // 4K.
    expect(windowScales({ width: 3840, height: 2120 }, BASE)).toEqual([1, 1.25, 1.5, 1.75, 2, 2.5]);
  });

  it('on a small screen, offers the largest size that still fits', () => {
    // A 1080p laptop at 150% Windows scaling has about 1280×672 free in layout units.
    expect(windowScales({ width: 1280, height: 672 }, BASE)).toEqual([0.85]);
    expect(windowScales({ width: 300, height: 200 }, BASE)).toEqual([0.5]);
  });
});
