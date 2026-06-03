import { describe, expect, it } from 'vitest';

import { __testing__ } from './repair-acroform-appearance-encoding';

const { convertUtf16BeAsciiHexToSingleByteHex, repairUtf16BeHexStringsInAppearanceContent } = __testing__;

describe('repairAcroFormAppearanceEncoding', () => {
  it('converts UTF-16BE-looking AcroForm appearance hex strings to single-byte hex', () => {
    expect(convertUtf16BeAsciiHexToSingleByteHex('0054007200650076006f0072')).toBe('547265766f72');
  });

  it('repairs PDF text drawing content while preserving geometry', () => {
    const content = ['BT', '/Helv 15.2 Tf 0 g', '2 4.3 Td', '<0054007200650076006f0072> Tj', 'ET'].join('\n');

    const repaired = repairUtf16BeHexStringsInAppearanceContent(content);

    expect(repaired.didRepair).toBe(true);
    expect(repaired.content).toContain('<547265766f72> Tj');
    expect(repaired.content).toContain('/Helv 15.2 Tf 0 g');
  });

  it('leaves ordinary single-byte hex strings alone', () => {
    const repaired = repairUtf16BeHexStringsInAppearanceContent('<547265766f72> Tj');

    expect(repaired.didRepair).toBe(false);
    expect(repaired.content).toBe('<547265766f72> Tj');
  });

  it('leaves non-ASCII UTF-16BE strings alone when they cannot be represented safely', () => {
    expect(convertUtf16BeAsciiHexToSingleByteHex('0100')).toBe(null);
  });
});
