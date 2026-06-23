import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta, Envelope, RecipientRole } from '@prisma/client';
import Konva from 'konva';
import 'konva/skia-backend';
import fs from 'node:fs';
import path from 'node:path';
import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
import type { Canvas } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';
import { UAParser } from 'ua-parser-js';

import { DOCUMENT_STATUS } from '../../constants/document';
import { APP_I18N_OPTIONS } from '../../constants/i18n';
import { RECIPIENT_ROLES_DESCRIPTION } from '../../constants/recipient-roles';
import type { TDocumentAuditLog } from '../../types/document-audit-logs';
import { formatDocumentAuditLogAction } from '../../utils/document-audit-logs';
import { ensureFontLibrary } from './helpers';

export type AuditLogRecipient = {
  id: number;
  name: string;
  email: string;
  role: RecipientRole;
};

type GenerateAuditLogsOptions = {
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  envelopeItems: string[];
  recipients: AuditLogRecipient[];
  auditLogs: TDocumentAuditLog[];
  hidePoweredBy: boolean;
  pageWidth: number;
  pageHeight: number;
  i18n: I18n;
  envelopeOwner: {
    email: string;
    name: string;
  };
};

const parser = new UAParser();

const textMutedForegroundLight = '#929DAE';
const textForeground = '#000';
const textMutedForeground = '#64748B';
const textSm = 9;
const textXs = 8;
const fontMedium = '500';

const pageTopMargin = 60;
const pageBottomMargin = 27;
const contentMaxWidth = 768;
const rowPadding = 2;
const titleFontSize = 16;

type RenderOverviewCardLabelAndTextOptions = {
  label: string;
  text: string | string[];
  width: number;
  groupX?: number;
};

const renderOverviewCardLabels = (options: RenderOverviewCardLabelAndTextOptions) => {
  const { width, text } = options;

  const labelYSpacing = 4;

  const group = new Konva.Group({
    x: options.groupX ?? 0,
  });

  const label = new Konva.Text({
    x: 0,
    y: 0,
    text: options.label,
    fontStyle: fontMedium,
    fontFamily: 'Inter',
    fill: textForeground,
    fontSize: textSm,
  });

  group.add(label);

  if (typeof text === 'string') {
    const value = new Konva.Text({
      x: 0,
      y: label.height() + labelYSpacing,
      width: width - label.width(),
      fontFamily: 'Inter',
      text,
      fill: textForeground,
      wrap: 'char',
      fontSize: textSm,
    });

    group.add(value);
  } else {
    for (const textValue of text) {
      const value = new Konva.Text({
        x: 0,
        y: group.getClientRect().height + 4,
        width: width - label.width(),
        fontFamily: 'Inter',
        text: `• ${textValue}`,
        fill: textForeground,
        wrap: 'char',
        fontSize: textSm,
      });

      group.add(value);
    }
  }

  return group;
};

type RenderOverviewCardOptions = {
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  envelopeItems: string[];
  envelopeOwner: {
    email: string;
    name: string;
  };
  recipients: AuditLogRecipient[];
  width: number;
  i18n: I18n;
};

const renderOverviewCard = (options: RenderOverviewCardOptions) => {
  const { envelope, envelopeItems, envelopeOwner, recipients, width, i18n } = options;
  const cardPadding = 16;

  const overviewCard = new Konva.Group();

  const columnSpacing = 10;
  const columnWidth = (width - columnSpacing) / 2;
  const rowVerticalSpacing = 32;

  const rowOne = new Konva.Group({
    x: cardPadding,
    y: cardPadding,
  });

  const envelopeIdLabel = renderOverviewCardLabels({
    label: i18n._(msg`Envelope ID`),
    text: envelope.id,
    width: columnWidth,
  });
  const ownerLabel = renderOverviewCardLabels({
    label: i18n._(msg`Owner`),
    text: `${envelopeOwner.name} (${envelopeOwner.email})`,
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowOne.add(envelopeIdLabel);
  rowOne.add(ownerLabel);
  overviewCard.add(rowOne);

  const rowTwo = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const statusLabel = renderOverviewCardLabels({
    label: i18n._(msg`Status`),
    text: i18n._(envelope.deletedAt ? msg`Deleted` : DOCUMENT_STATUS[envelope.status].description).toUpperCase(),
    width: columnWidth,
  });
  const timeZoneLabel = renderOverviewCardLabels({
    label: i18n._(msg`Time Zone`),
    text: envelope.documentMeta?.timezone || 'N/A',
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowTwo.add(statusLabel);
  rowTwo.add(timeZoneLabel);
  overviewCard.add(rowTwo);

  const rowThree = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const createdAtLabel = renderOverviewCardLabels({
    label: i18n._(msg`Created At`),
    text: DateTime.fromJSDate(envelope.createdAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
    width: columnWidth,
  });
  const lastUpdatedLabel = renderOverviewCardLabels({
    label: i18n._(msg`Last Updated`),
    text: DateTime.fromJSDate(envelope.updatedAt)
      .setLocale(APP_I18N_OPTIONS.defaultLocale)
      .toFormat('yyyy-MM-dd hh:mm:ss a (ZZZZ)'),
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowThree.add(createdAtLabel);
  rowThree.add(lastUpdatedLabel);
  overviewCard.add(rowThree);

  const rowFour = new Konva.Group({
    x: cardPadding,
    y: overviewCard.getClientRect().height + rowVerticalSpacing,
  });

  const enclosedDocumentsLabel = renderOverviewCardLabels({
    label: i18n._(msg`Enclosed Documents`),
    text: envelopeItems,
    width: columnWidth,
  });

  const recipientsLabel = renderOverviewCardLabels({
    label: i18n._(msg`Recipients`),
    text: recipients.map(
      (recipient) =>
        `[${i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}] ${recipient.name} (${recipient.email})`,
    ),
    width: columnWidth,
    groupX: columnWidth + columnSpacing,
  });

  rowFour.add(enclosedDocumentsLabel);
  rowFour.add(recipientsLabel);
  overviewCard.add(rowFour);

  // Create rect border around the overview card
  const cardRect = new Konva.Rect({
    x: 0,
    y: 0,
    width,
    height: overviewCard.getClientRect().height + cardPadding * 2,
    stroke: '#e5e7eb',
    strokeWidth: 1.5,
    cornerRadius: 8,
  });

  overviewCard.add(cardRect);

  return overviewCard;
};

const renderAuditLogTableHeader = ({ width, i18n }: { width: number; i18n: I18n }) => {
  const columnWidths = getAuditLogColumnWidths(width);
  const labels = [
    i18n._(msg`Time`),
    i18n._(msg`Event`),
    i18n._(msg`User`),
    i18n._(msg`IP Address`),
    i18n._(msg`Device`),
  ];
  const header = new Konva.Group();
  let x = 0;

  for (const [index, label] of labels.entries()) {
    header.add(
      new Konva.Text({
        x: x + 4,
        y: 3,
        width: columnWidths[index] - 8,
        text: label,
        fontFamily: 'Inter',
        fontSize: textXs,
        fontStyle: fontMedium,
        fill: textMutedForeground,
        wrap: 'char',
      }),
    );
    x += columnWidths[index];
  }

  header.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height: 18,
      stroke: '#e5e7eb',
      strokeWidth: 1,
      fill: '#f8fafc',
    }),
  );

  return header;
};

const getAuditLogColumnWidths = (width: number) => [
  width * 0.15,
  width * 0.34,
  width * 0.18,
  width * 0.13,
  width * 0.2,
];

type RenderRowOptions = {
  auditLog: TDocumentAuditLog;
  width: number;
  i18n: I18n;
};

const renderRow = (options: RenderRowOptions) => {
  const { auditLog, width, i18n } = options;

  parser.setUA(auditLog.userAgent || '');
  const userAgentInfo = parser.getResult();

  const columnWidths = getAuditLogColumnWidths(width);
  const rowGroup = new Konva.Group();
  const cellPaddingX = 4;
  const cellPaddingY = 3;
  const fontSize = textXs;
  const lineHeight = 1.15;

  const timeText = DateTime.fromJSDate(auditLog.createdAt)
    .setLocale(APP_I18N_OPTIONS.defaultLocale)
    .toLocaleString(dateFormat);
  const eventText = `${auditLog.type.replace(/_/g, ' ')}\n${formatDocumentAuditLogAction(i18n, auditLog).description}`;
  const userText = auditLog.email || 'N/A';
  const ipText = auditLog.ipAddress || 'N/A';
  const deviceText = i18n._(formatUserAgent(auditLog.userAgent, userAgentInfo));
  const values = [timeText, eventText, userText, ipText, deviceText];

  let x = 0;
  let rowHeight = 0;

  for (const [index, value] of values.entries()) {
    const cellText = new Konva.Text({
      x: x + cellPaddingX,
      y: cellPaddingY,
      width: columnWidths[index] - cellPaddingX * 2,
      text: value,
      fontFamily: index === 2 || index === 3 ? 'monospace' : 'Inter',
      fontSize,
      fill: index === 0 ? textMutedForeground : textForeground,
      lineHeight,
      wrap: 'char',
      fontStyle: index === 1 ? fontMedium : undefined,
    });

    rowGroup.add(cellText);
    rowHeight = Math.max(rowHeight, cellText.getClientRect().height + cellPaddingY * 2);
    x += columnWidths[index];
  }

  const minRowHeight = 18;
  rowHeight = Math.max(rowHeight, minRowHeight);

  rowGroup.add(
    new Konva.Line({
      points: [0, rowHeight, width, rowHeight],
      stroke: '#e5e7eb',
      strokeWidth: 1,
    }),
  );

  return rowGroup;
};

const renderBranding = () => {
  const branding = new Konva.Group();

  const brandingHeight = 16;

  const logoPath = path.join(process.cwd(), 'public/static/logo.png');
  const logo = fs.readFileSync(logoPath);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const img = new SkiaImage(logo) as unknown as HTMLImageElement;

  const brandingImage = new Konva.Image({
    image: img,
    height: brandingHeight,
    width: brandingHeight * (img.width / img.height),
  });

  branding.add(brandingImage);
  return branding;
};

type GroupRowsIntoPagesOptions = {
  auditLogs: TDocumentAuditLog[];
  maxHeight: number;
  contentWidth: number;
  i18n: I18n;
  overviewCard: Konva.Group;
};

const groupRowsIntoPages = (options: GroupRowsIntoPagesOptions) => {
  const { auditLogs, maxHeight, contentWidth, i18n, overviewCard } = options;

  const groupedRows: Konva.Group[][] = [[]];

  const overviewCardHeight = overviewCard.getClientRect().height;

  // First page has title + overview card + table header
  let availableHeight = maxHeight - pageTopMargin - overviewCardHeight - 18;
  let currentGroupedRowIndex = 0;

  // Group rows into pages.
  for (const auditLog of auditLogs) {
    const row = renderRow({ auditLog, width: contentWidth, i18n });

    const rowHeight = row.getClientRect().height;
    const requiredHeight = rowHeight + rowPadding;

    if (requiredHeight > availableHeight) {
      currentGroupedRowIndex++;
      groupedRows[currentGroupedRowIndex] = [row];

      // Subsequent pages only have title + table header
      availableHeight = maxHeight - pageTopMargin - 18;
    } else {
      groupedRows[currentGroupedRowIndex].push(row);
    }

    // Reduce available height by the row height.
    availableHeight -= requiredHeight;
  }

  return groupedRows;
};

type RenderPagesOptions = {
  groupedRows: Konva.Group[][];
  margin: number;
  pageTopMargin: number;
  i18n: I18n;
  overviewCard: Konva.Group;
};

const renderPages = (options: RenderPagesOptions) => {
  const { groupedRows, margin, pageTopMargin, i18n, overviewCard } = options;

  const rowPadding = 10;
  const pages: Konva.Group[] = [];

  // Render the rows for each page.
  for (const [pageIndex, rows] of groupedRows.entries()) {
    const pageGroup = new Konva.Group();

    // Add title to each page
    const pageTitle = new Konva.Text({
      x: margin,
      y: 0,
      height: pageTopMargin,
      verticalAlign: 'middle',
      text: i18n._(msg`Audit Log`),
      fill: textForeground,
      fontFamily: 'Inter',
      fontSize: titleFontSize,
      fontStyle: '700',
    });
    pageGroup.add(pageTitle);

    // Add overview card only on first page
    if (pageIndex === 0) {
      overviewCard.setAttrs({
        x: margin,
        y: pageGroup.getClientRect().height,
      });
      pageGroup.add(overviewCard);
    }

    // Add table header to each page
    const tableHeader = renderAuditLogTableHeader({ width: overviewCard.getClientRect().width, i18n });
    tableHeader.setAttrs({
      x: margin,
      y: pageGroup.getClientRect().height + rowPadding,
    });
    pageGroup.add(tableHeader);

    // Add rows to the page
    for (const row of rows) {
      const yPosition = pageGroup.getClientRect().height + rowPadding;

      row.setAttrs({
        x: margin,
        y: yPosition,
      });

      pageGroup.add(row);
    }

    pages.push(pageGroup);
  }

  return pages;
};

export async function renderAuditLogs({
  envelope,
  envelopeOwner,
  envelopeItems,
  recipients,
  auditLogs,
  pageWidth,
  pageHeight,
  i18n,
  hidePoweredBy,
}: GenerateAuditLogsOptions) {
  ensureFontLibrary();

  const minimumMargin = 10;

  const contentWidth = Math.min(pageWidth - minimumMargin * 2, contentMaxWidth);
  const margin = (pageWidth - contentWidth) / 2;

  let stage: Konva.Stage | null = new Konva.Stage({ width: pageWidth, height: pageHeight });

  const overviewCard = renderOverviewCard({
    envelope,
    envelopeOwner,
    envelopeItems,
    recipients,
    width: contentWidth,
    i18n,
  });

  const groupedRows = groupRowsIntoPages({
    auditLogs,
    maxHeight: pageHeight - pageBottomMargin,
    contentWidth,
    i18n,
    overviewCard,
  });

  const pageGroups = renderPages({
    groupedRows,
    margin,
    pageTopMargin,
    i18n,
    overviewCard,
  });

  const brandingGroup = renderBranding();
  const brandingRect = brandingGroup.getClientRect();
  const brandingTopPadding = 24;

  const pages: Uint8Array[] = [];

  let isBrandingPlaced = false;

  // Render each page group to PDF
  for (const [index, pageGroup] of pageGroups.entries()) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    const footerText = new Konva.Text({
      x: margin,
      y: pageHeight - textXs - 10,
      text: `${i18n._(msg`Envelope ID`)}: ${envelope.id}`,
      fontFamily: 'Inter',
      fontSize: textXs,
      fill: textMutedForegroundLight,
    });
    page.add(footerText);

    page.add(pageGroup);

    // Add branding on the last page if there is space.
    if (index === pageGroups.length - 1 && !hidePoweredBy) {
      const remainingHeight = pageHeight - pageGroup.getClientRect().height - pageBottomMargin;

      if (brandingRect.height + brandingTopPadding <= remainingHeight) {
        brandingGroup.setAttrs({
          x: pageWidth - brandingRect.width - margin,
          y: pageGroup.getClientRect().height + brandingTopPadding,
        } satisfies Partial<Konva.GroupConfig>);

        page.add(brandingGroup);
        isBrandingPlaced = true;
      }
    }

    stage.add(page);

    // Export the page and save it.
    const canvas = page.canvas._canvas as unknown as Canvas; // eslint-disable-line @typescript-eslint/consistent-type-assertions
    const buffer = await canvas.toBuffer('pdf');
    pages.push(new Uint8Array(buffer));
  }

  // Need to create an empty page for the branding if it hasn't been placed yet.
  if (!hidePoweredBy && !isBrandingPlaced) {
    stage.destroyChildren();
    const page = new Konva.Layer();

    brandingGroup.setAttrs({
      x: pageWidth - brandingRect.width - margin,
      y: pageTopMargin,
    } satisfies Partial<Konva.GroupConfig>);

    const overflowFooterText = new Konva.Text({
      x: margin,
      y: pageHeight - textXs - 10,
      text: `${i18n._(msg`Envelope ID`)}: ${envelope.id}`,
      fontFamily: 'Inter',
      fontSize: textXs,
      fill: textMutedForegroundLight,
    });
    page.add(overflowFooterText);

    page.add(brandingGroup);
    stage.add(page);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const canvas = page.canvas._canvas as unknown as Canvas;
    const buffer = await canvas.toBuffer('pdf');

    pages.push(new Uint8Array(buffer));
  }

  stage.destroy();
  stage = null;

  return pages;
}

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

const formatUserAgent = (userAgent: string | null | undefined, userAgentInfo: UAParser.IResult) => {
  if (!userAgent) {
    return msg`N/A`;
  }

  const browser = userAgentInfo.browser.name;
  const version = userAgentInfo.browser.version;
  const os = userAgentInfo.os.name;

  // If we can parse meaningful browser info, format it nicely
  if (browser && os) {
    const browserInfo = version ? `${browser} ${version}` : browser;

    return msg`${browserInfo} on ${os}`;
  }

  return msg`${userAgent}`;
};
