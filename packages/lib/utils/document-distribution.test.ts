import { DocumentDistributionMethod } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { resolveDistributionMethodForSend } from './document';

describe('resolveDistributionMethodForSend', () => {
  it('defaults to EMAIL when the caller does not pass a method', () => {
    expect(resolveDistributionMethodForSend()).toBe(DocumentDistributionMethod.EMAIL);
    expect(resolveDistributionMethodForSend(null)).toBe(DocumentDistributionMethod.EMAIL);
    expect(resolveDistributionMethodForSend(undefined)).toBe(DocumentDistributionMethod.EMAIL);
  });

  it('keeps an explicit NONE or EMAIL override', () => {
    expect(resolveDistributionMethodForSend(DocumentDistributionMethod.NONE)).toBe(
      DocumentDistributionMethod.NONE,
    );
    expect(resolveDistributionMethodForSend(DocumentDistributionMethod.EMAIL)).toBe(
      DocumentDistributionMethod.EMAIL,
    );
  });
});
