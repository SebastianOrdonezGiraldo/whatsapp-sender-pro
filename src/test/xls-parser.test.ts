import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseXlsFile } from '@/lib/xls-parser';

function toArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return output as ArrayBuffer;
}

describe('parseXlsFile', () => {
  it('extrae solo columnas requeridas aunque existan muchas columnas', () => {
    const headers = [
      'Estado',
      'Causal Anulación Masiva',
      'Número de Guia',
      'Fecha de Envio',
      'Destinatario',
      'Teléfono',
      'Número de Celular',
      'Ciudad',
      'Departamento Destino',
    ];

    const data = [
      ['Impreso', '', 'G-001', '2026-02-10', 'Juan Perez', '1111111', '3201234567', 'Bogotá', 'Cundinamarca'],
      ['Impreso', '', 'G-002', '2026-02-10', 'Ana Ruiz', '2222222', '3009876543', 'Medellín', 'Antioquia'],
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Reporte');

    const result = parseXlsFile(toArrayBuffer(workbook));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      guideNumber: 'G-001',
      recipient: 'Juan Perez',
      phoneRaw: '3201234567',
    });
    expect(result.rows[1]).toMatchObject({
      guideNumber: 'G-002',
      recipient: 'Ana Ruiz',
      phoneRaw: '3009876543',
    });
  });

  it('encuentra encabezados aunque aparezcan después de muchas filas introductorias', () => {
    const preRows = Array.from({ length: 45 }, (_, i) => [`Texto previo ${i + 1}`]);
    const headers = ['Número de Guía', 'Destinatario', 'Número de Celular', 'Estado'];
    const data = [['G-999', 'Cliente Largo', '3101234567', 'Impreso']];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([...preRows, headers, ...data]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Hoja Larga');

    const result = parseXlsFile(toArrayBuffer(workbook));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      guideNumber: 'G-999',
      recipient: 'Cliente Largo',
      phoneRaw: '3101234567',
    });
  });

  it('si la primera hoja no sirve, usa otra hoja válida', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['sin datos']]), 'Hoja1');

    const headers = ['Número de Guía', 'Destinatario', 'Número de Celular', 'Estado'];
    const data = [['G-777', 'Cliente Uno', '3207654321', 'Impreso']];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...data]), 'Hoja2');

    const result = parseXlsFile(toArrayBuffer(workbook));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].guideNumber).toBe('G-777');
    expect(result.rows[0].recipient).toBe('Cliente Uno');
    expect(result.rows[0].phoneRaw).toBe('3207654321');
  });

  it('si encuentra un encabezado sin datos, sigue buscando otro encabezado válido en la misma hoja', () => {
    const workbook = XLSX.utils.book_new();

    const headerOnlySection = [
      ['Número de Guía', 'Destinatario', 'Número de Celular', 'Estado'],
      ['', '', '', ''],
      ['', '', '', ''],
    ];

    const realSection = [
      ['Estado', 'Número de Guía', 'Destinatario', 'Número de Celular'],
      ['Impreso', 'G-ABC', 'Cliente Real', '3201112233'],
    ];

    const sheet = XLSX.utils.aoa_to_sheet([...headerOnlySection, [''], ...realSection]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Reporte');

    const result = parseXlsFile(toArrayBuffer(workbook));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      guideNumber: 'G-ABC',
      recipient: 'Cliente Real',
      phoneRaw: '3201112233',
    });
  });

});
