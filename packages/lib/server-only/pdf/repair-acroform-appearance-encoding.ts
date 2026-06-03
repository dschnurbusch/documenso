import { PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';

const HEX_STRING_REGEX = /<([0-9A-Fa-f\s]+)>/g;
const UTF16_BE_ASCII_BYTE_LENGTH = 4;

const isPdfDocEncodingCompatibleByte = (byte: number) => {
  return byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 255);
};

const convertUtf16BeAsciiHexToSingleByteHex = (rawHex: string) => {
  const compactHex = rawHex.replace(/\s+/g, '');

  if (compactHex.length < UTF16_BE_ASCII_BYTE_LENGTH || compactHex.length % UTF16_BE_ASCII_BYTE_LENGTH !== 0) {
    return null;
  }

  const bytes: number[] = [];

  for (let index = 0; index < compactHex.length; index += UTF16_BE_ASCII_BYTE_LENGTH) {
    const highByte = Number.parseInt(compactHex.slice(index, index + 2), 16);
    const lowByte = Number.parseInt(compactHex.slice(index + 2, index + 4), 16);

    if (highByte !== 0 || !isPdfDocEncodingCompatibleByte(lowByte)) {
      return null;
    }

    bytes.push(lowByte);
  }

  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const repairUtf16BeHexStringsInAppearanceContent = (content: string) => {
  let didRepair = false;

  const repairedContent = content.replace(HEX_STRING_REGEX, (match, rawHex: string) => {
    const replacementHex = convertUtf16BeAsciiHexToSingleByteHex(rawHex);

    if (!replacementHex) {
      return match;
    }

    didRepair = true;
    return `<${replacementHex}>`;
  });

  return {
    content: repairedContent,
    didRepair,
  };
};

/**
 * Repair AcroForm widget appearance streams that encode simple-font text as
 * UTF-16BE hex strings, e.g. `<005400720065...>` with `/Helv Tf`.
 *
 * Some PDF viewers tolerate this while rendering annotations. Once Documenso
 * flattens the widgets into page content, PDF engines interpret the NUL bytes
 * literally, producing spaced-out/clipped text. Rewriting those appearance
 * strings to single-byte PDFDoc/WinAnsi-compatible hex preserves the existing
 * appearance geometry while making flattening deterministic.
 */
export const repairAcroFormAppearanceEncoding = async (pdf: Buffer) => {
  const pdfDoc = await PDFDocument.load(pdf);
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  let didRepair = false;

  for (const field of fields) {
    const acroField = (field as unknown as { acroField?: { getWidgets?: () => Array<{ dict: unknown }> } }).acroField;
    const widgets = acroField?.getWidgets?.() ?? [];

    for (const widget of widgets) {
      const dict = widget.dict as {
        lookup: (name: PDFName) => unknown;
      };
      const appearance = dict.lookup(PDFName.of('AP')) as
        | {
            lookup: (name: PDFName) => unknown;
          }
        | undefined;
      const normalAppearance = appearance?.lookup(PDFName.of('N'));

      if (!(normalAppearance instanceof PDFRawStream)) {
        continue;
      }

      const content = normalAppearance.getContentsString();
      const repaired = repairUtf16BeHexStringsInAppearanceContent(content);

      if (!repaired.didRepair) {
        continue;
      }

      normalAppearance.updateContents(Buffer.from(repaired.content, 'latin1'));
      didRepair = true;
    }
  }

  if (!didRepair) {
    return pdf;
  }

  return Buffer.from(await pdfDoc.save({ useObjectStreams: true }));
};

export const __testing__ = {
  convertUtf16BeAsciiHexToSingleByteHex,
  repairUtf16BeHexStringsInAppearanceContent,
};
