import { describe, it, expect } from 'vitest';
import { getContrastRatio, checkContrastCompliant } from '../server/services/contrast.js';

describe('WCAG 2.1 Contrast Ratio Service', () => {
  it('calculates contrast between pure black and white as 21:1', () => {
    const ratio = getContrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21.0, 1);
  });
  it('calculates contrast between identical colors as 1:1', () => {
    const ratio = getContrastRatio('#002B49', '#002B49');
    expect(ratio).toBeCloseTo(1.0, 1);
  });

  it('validates compliance >= 4.5:1 for normal text', () => {
    // White text on dark navy #002B49
    expect(checkContrastCompliant('#ffffff', '#002B49')).toBe(true);

    // Dark navy text on white background
    expect(checkContrastCompliant('#002B49', '#ffffff')).toBe(true);

    // Low contrast combination: light gray on white
    expect(checkContrastCompliant('#e0e0e0', '#ffffff')).toBe(false);
  });

  it('correctly handles 3-digit shorthand hex codes', () => {
    const ratio = getContrastRatio('#000', '#fff');
    expect(ratio).toBeCloseTo(21.0, 1);
  });
});
