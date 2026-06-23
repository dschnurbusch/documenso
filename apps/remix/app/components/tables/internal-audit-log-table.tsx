import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';
import { DOCUMENT_AUDIT_LOG_TYPE, type TDocumentAuditLog } from '@documenso/lib/types/document-audit-logs';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { cn } from '@documenso/ui/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { DateTimeFormatOptions } from 'luxon';
import { DateTime } from 'luxon';
import { match, P } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';

export type AuditLogDataTableProps = {
  logs: TDocumentAuditLog[];
};

const dateFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_SHORT,
  hourCycle: 'h12',
};

/**
 * Get the color indicator for the audit log type
 */

const getAuditLogIndicatorColor = (type: string) =>
  match(type)
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED, () => 'bg-green-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED, () => 'bg-red-500')
    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT, () => 'bg-orange-500')
    .with(
      P.union(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED, DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED),
      () => 'bg-blue-500',
    )
    .otherwise(() => 'bg-muted');

/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 */

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

export const InternalAuditLogTable = ({ logs }: AuditLogDataTableProps) => {
  const { _, i18n } = useLingui();

  const parser = new UAParser();

  return (
    <Table overflowHidden className="text-xs print:text-[6pt]">
      <TableHeader>
        <TableRow className="print:break-inside-avoid">
          <TableHead className="h-8 w-[15%] px-2 py-1 print:h-auto print:px-1">{_(msg`Time`)}</TableHead>
          <TableHead className="h-8 w-[34%] px-2 py-1 print:h-auto print:px-1">{_(msg`Event`)}</TableHead>
          <TableHead className="h-8 w-[18%] px-2 py-1 print:h-auto print:px-1">{_(msg`User`)}</TableHead>
          <TableHead className="h-8 w-[13%] px-2 py-1 print:h-auto print:px-1">{_(msg`IP Address`)}</TableHead>
          <TableHead className="h-8 w-[20%] px-2 py-1 print:h-auto print:px-1">{_(msg`Device`)}</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {logs.map((log, index) => {
          parser.setUA(log.userAgent || '');
          const formattedAction = formatDocumentAuditLogAction(i18n, log);
          const userAgentInfo = parser.getResult();

          return (
            <TableRow
              key={index}
              className="align-top print:break-inside-avoid"
              style={{
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
              }}
            >
              <TableCell
                truncate={false}
                className="px-2 py-1.5 align-top text-muted-foreground print:px-1 print:py-0.5"
              >
                {DateTime.fromJSDate(log.createdAt)
                  .setLocale(APP_I18N_OPTIONS.defaultLocale)
                  .toLocaleString(dateFormat)}
              </TableCell>

              <TableCell truncate={false} className="px-2 py-1.5 align-top print:px-1 print:py-0.5">
                <div className="flex items-start gap-2 print:gap-1">
                  <div
                    className={cn(
                      'mt-1.5 h-2 w-2 flex-none rounded-full print:mt-1 print:h-1.5 print:w-1.5',
                      getAuditLogIndicatorColor(log.type),
                    )}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-muted-foreground uppercase tracking-wide print:tracking-normal">
                      {log.type.replace(/_/g, ' ')}
                    </div>
                    <div className="font-medium text-foreground">{formattedAction.description}</div>
                  </div>
                </div>
              </TableCell>

              <TableCell truncate={false} className="break-all px-2 py-1.5 align-top font-mono print:px-1 print:py-0.5">
                {log.email || 'N/A'}
              </TableCell>

              <TableCell truncate={false} className="break-all px-2 py-1.5 align-top font-mono print:px-1 print:py-0.5">
                {log.ipAddress || 'N/A'}
              </TableCell>

              <TableCell truncate={false} className="px-2 py-1.5 align-top print:px-1 print:py-0.5">
                {_(formatUserAgent(log.userAgent, userAgentInfo))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
