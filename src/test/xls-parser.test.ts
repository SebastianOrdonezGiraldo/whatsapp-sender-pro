import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseXlsFile } from '@/lib/xls-parser';

function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return output as ArrayBuffer;
}

describe('parseXlsFile', () => {
  it('parses rows from a valid sheet', () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Número de Guía', 'Destinatario', 'Número de Celular', 'Estado'],
      ['G-100', 'María', '3001234567', 'Impreso'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Reporte');

    const result = parseXlsFile(workbookToArrayBuffer(wb));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      guideNumber: 'G-100',
      recipient: 'María',
      phoneE164: '+573001234567',
      phoneValid: true,
      status: 'Impreso',
    });
  });

  it('falls back to another sheet when first sheet is empty', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Empty');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Número de Guía', 'Destinatario', 'Número de Celular'],
        ['G-200', 'Carlos', '573001112233'],
      ]),
      'Datos',
    );

    const result = parseXlsFile(workbookToArrayBuffer(wb));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].guideNumber).toBe('G-200');
  });
});
