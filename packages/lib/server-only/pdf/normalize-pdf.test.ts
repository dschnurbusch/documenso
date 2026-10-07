import {
  decodePDFRawStream,
  PDFArray,
  type PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { normalizePdf } from './normalize-pdf';

const bodyContent = 'q\n0 0 1 rg\n20 20 100 30 re f\nQ\n';
const secondBodyContent = 'q\n1 0 0 rg\n140 20 50 30 re f\nQ\n';
const contentKinds = ['stream', 'direct-array', 'indirect-array'] as const;
type ContentKind = (typeof contentKinds)[number];

const createFixture = async (kind: ContentKind) => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 300]);
  const field = pdf.getForm().createTextField('synthetic-field');
  field.setText('Synthetic populated value');
  field.addToPage(page, { x: 20, y: 100, width: 250, height: 30 });
  pdf.getForm().updateFieldAppearances();

  const bodyRef = pdf.context.register(pdf.context.flateStream(bodyContent));
  const secondBodyRef = pdf.context.register(pdf.context.flateStream(secondBodyContent));
  const contents = pdf.context.obj([bodyRef, secondBodyRef]);
  page.node.set(
    PDFName.of('Contents'),
    kind === 'stream' ? bodyRef : kind === 'direct-array' ? contents : pdf.context.register(contents),
  );

  return Buffer.from(await pdf.save({ useObjectStreams: false, updateFieldAppearances: false }));
};

const getContentStreams = (pdf: PDFDocument) => {
  const contents = pdf.getPages()[0].node.lookup(PDFName.of('Contents'));
  const items = contents instanceof PDFArray ? contents.asArray() : [contents];

  return items.map((item) => {
    const stream = item instanceof PDFRef ? pdf.context.lookup(item) : item;
    // An indirect reference to an array must never become an array member.
    expect(stream).toBeInstanceOf(PDFRawStream);
    return decodePDFRawStream(stream as PDFRawStream).decode();
  });
};

const expectBodyPreserved = (pdf: PDFDocument, kind: ContentKind) => {
  const streams = getContentStreams(pdf).map((bytes) => Buffer.from(bytes).toString('latin1'));
  expect(streams).toContain(bodyContent);
  if (kind !== 'stream') {
    expect(streams).toContain(secondBodyContent);
    expect(streams.indexOf(bodyContent)).toBeLessThan(streams.indexOf(secondBodyContent));
  }
  return streams;
};

// All fixtures are generated here; no uploaded/client PDF bytes are checked in.
describe('normalizePdf page content preservation', () => {
  it.each(contentKinds)('flattens populated widgets and preserves %s body streams', async (kind) => {
    const normalized = await normalizePdf(await createFixture(kind));
    const pdf = await PDFDocument.load(normalized);
    const streams = expectBodyPreserved(pdf, kind);
    expect(pdf.getForm().getFields()).toHaveLength(0);
    expect(pdf.getPages()[0].node.Annots()?.size() ?? 0).toBe(0);
    expect(streams[0]).toBe('q\n');
    expect(streams.at(-1)).toMatch(/^Q\n/);
    expect(streams.join('\n')).toMatch(/\/\S+ Do/);

    const resources = pdf.getPages()[0].node.Resources();
    const xObjects = resources?.lookup(PDFName.of('XObject'));
    expect(xObjects).toBeDefined();
    const appearanceContent = (xObjects as PDFDict)
      .entries()
      .map(([, ref]) => pdf.context.lookup(ref))
      .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
      .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'))
      .join('\n');
    expect(appearanceContent).toContain(Buffer.from('Synthetic populated value').toString('hex').toUpperCase());
  });

  it.each(
    contentKinds,
  )('keeps populated template widgets and %s body streams when flattenForm is false', async (kind) => {
    const normalized = await normalizePdf(await createFixture(kind), { flattenForm: false });
    const pdf = await PDFDocument.load(normalized);
    expectBodyPreserved(pdf, kind);
    expect(pdf.getForm().getFields()).toHaveLength(1);
    expect(pdf.getForm().getTextField('synthetic-field').getText()).toBe('Synthetic populated value');
    expect(pdf.getPages()[0].node.Annots()?.size()).toBe(1);
  });
});
