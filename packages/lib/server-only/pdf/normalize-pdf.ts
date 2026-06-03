import { PDF } from '@libpdf/core';

import { AppError } from '../../errors/app-error';
import { repairAcroFormAppearanceEncoding } from './repair-acroform-appearance-encoding';

export const normalizePdf = async (pdf: Buffer, options: { flattenForm?: boolean } = {}) => {
  const shouldFlattenForm = options.flattenForm ?? true;
  const pdfToNormalize = shouldFlattenForm ? await repairAcroFormAppearanceEncoding(pdf) : pdf;

  const pdfDoc = await PDF.load(pdfToNormalize).catch((e) => {
    console.error(`PDF normalization error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is not a valid PDF',
    });
  });

  if (pdfDoc.isEncrypted) {
    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is encrypted',
    });
  }

  pdfDoc.flattenLayers();

  const form = pdfDoc.getForm();

  if (shouldFlattenForm && form) {
    form.flatten();
    pdfDoc.flattenAnnotations();
  }

  const normalizedPdfBytes = await pdfDoc.save();

  return Buffer.from(normalizedPdfBytes);
};
