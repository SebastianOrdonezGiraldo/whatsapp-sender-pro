import * as XLSX from 'xlsx';
import { normalizePhoneE164 } from './phone-utils';

export interface ParsedRow {
  guideNumber: string;
  recipient: string;
  phoneRaw: string;
  phoneE164: string;
  phoneValid: boolean;
  phoneReason?: string;
  status?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

const REQUIRED_COLUMNS = {
  guideNumber: ['numero de guia', 'número de guía', 'numero de guía', 'nro guia', 'guia'],
  recipient: ['destinatario', 'nombre destinatario', 'dest'],
  phone: ['numero de celular', 'número de celular', 'celular', 'telefono', 'teléfono', 'cel'],
  status: ['estado'],
};

const MISSING_COLUMNS_ERROR = 'No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular';
const NO_ROWS_ERROR = 'El archivo tiene encabezados válidos pero no contiene filas de datos';

function normalizeHeader(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map(header => normalizeHeader(header || ''));
  const normalizedCandidates = candidates.map(candidate => normalizeHeader(candidate));

  for (const candidate of normalizedCandidates) {
    const exactIdx = normalizedHeaders.findIndex(header => header === candidate);
    if (exactIdx !== -1) return exactIdx;
  }

  for (const candidate of normalizedCandidates) {
    const includesIdx = normalizedHeaders.findIndex(header => header.includes(candidate));
    if (includesIdx !== -1) return includesIdx;
  }

  return -1;
}

function isRepeatedHeaderRow(
  guideNumber: string,
  recipient: string,
  phoneRaw: string,
  headers: string[],
  colGuide: number,
  colRecipient: number,
  colPhone: number,
): boolean {
  return (
    normalizeHeader(guideNumber) === normalizeHeader(String(headers[colGuide] || '')) &&
    normalizeHeader(recipient) === normalizeHeader(String(headers[colRecipient] || '')) &&
    normalizeHeader(phoneRaw) === normalizeHeader(String(headers[colPhone] || ''))
  );
}

function parseRowsFromCandidate(
  jsonData: string[][],
  startIndex: number,
  headers: string[],
  colGuide: number,
  colRecipient: number,
  colPhone: number,
  colStatus: number,
): { rows: ParsedRow[]; validPhones: number } {
  const dataRows = jsonData.slice(startIndex + 1);
  const rows: ParsedRow[] = [];
  let validPhones = 0;

  for (const row of dataRows) {
    const guideNumber = String(row[colGuide] || '').trim();
    const recipient = String(row[colRecipient] || '').trim();
    const phoneRaw = String(row[colPhone] || '').trim();
    const status = colStatus !== -1 ? String(row[colStatus] || '').trim() : '';

    if (!guideNumber && !recipient && !phoneRaw) continue;

    if (isRepeatedHeaderRow(guideNumber, recipient, phoneRaw, headers, colGuide, colRecipient, colPhone)) {
      continue;
    }

    const { valid, phone, reason } = normalizePhoneE164(phoneRaw);
    if (valid) validPhones++;

    rows.push({
      guideNumber,
      recipient,
      phoneRaw,
      phoneE164: phone,
      phoneValid: valid,
      phoneReason: reason,
      status,
    });
  }

  return { rows, validPhones };
}

function parseSheet(sheet: XLSX.WorkSheet): ParseResult {
  const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

  if (jsonData.length < 2) {
    return { rows: [], errors: ['El archivo no contiene datos suficientes'] };
  }

  const maxHeaderScanRows = Math.min(300, jsonData.length);
  const candidates: Array<{ rows: ParsedRow[]; validPhones: number }> = [];
  let foundHeaderWithoutRows = false;

  for (let i = 0; i < maxHeaderScanRows; i++) {
    const currentRow = jsonData[i] as string[];
    if (!currentRow || currentRow.every(cell => !String(cell || '').trim())) continue;

    const headers = currentRow.map(String);
    const colGuide = findColumn(headers, REQUIRED_COLUMNS.guideNumber);
    const colRecipient = findColumn(headers, REQUIRED_COLUMNS.recipient);
    const colPhone = findColumn(headers, REQUIRED_COLUMNS.phone);

    if (colGuide === -1 || colRecipient === -1 || colPhone === -1) continue;

    const colStatus = findColumn(headers, REQUIRED_COLUMNS.status);
    const candidate = parseRowsFromCandidate(jsonData as string[][], i, headers, colGuide, colRecipient, colPhone, colStatus);

    if (candidate.rows.length > 0) {
      candidates.push(candidate);
    } else {
      foundHeaderWithoutRows = true;
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (b.validPhones !== a.validPhones) return b.validPhones - a.validPhones;
      return b.rows.length - a.rows.length;
    });
    return { rows: candidates[0].rows, errors: [] };
  }

  if (foundHeaderWithoutRows) {
    return { rows: [], errors: [NO_ROWS_ERROR] };
  }

  return { rows: [], errors: [MISSING_COLUMNS_ERROR] };
}

export function parseXlsFile(data: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return { rows: [], errors: ['El archivo no contiene hojas de cálculo'] };
    }

    let foundHeaderButNoRows = false;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const result = parseSheet(sheet);

      if (result.errors.length === 0) {
        return result;
      }

      if (result.errors.includes(NO_ROWS_ERROR)) {
        foundHeaderButNoRows = true;
      }
    }

    if (foundHeaderButNoRows) {
      return { rows: [], errors: [NO_ROWS_ERROR] };
    }

    return { rows: [], errors: [MISSING_COLUMNS_ERROR] };
  } catch (error) {
    return { rows: [], errors: [`Error al parsear el archivo: ${(error as Error).message}`] };
  }
}
