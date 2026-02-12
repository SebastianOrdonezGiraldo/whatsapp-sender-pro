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

const ERR_MISSING_COLUMNS = 'No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular';
const ERR_NO_ROWS = 'El archivo tiene encabezados válidos pero no contiene filas de datos';

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  const normalizedCandidates = candidates.map(normalizeHeader);

  for (const candidate of normalizedCandidates) {
    const exactIndex = normalizedHeaders.findIndex(header => header === candidate);
    if (exactIndex !== -1) return exactIndex;
  }

  for (const candidate of normalizedCandidates) {
    const partialIndex = normalizedHeaders.findIndex(header => header.includes(candidate));
    if (partialIndex !== -1) return partialIndex;
  }

  return -1;
}

function isRepeatedHeaderRow(row: ParsedRow, headers: string[], colGuide: number, colRecipient: number, colPhone: number): boolean {
  return (
    normalizeHeader(row.guideNumber) === normalizeHeader(headers[colGuide]) &&
    normalizeHeader(row.recipient) === normalizeHeader(headers[colRecipient]) &&
    normalizeHeader(row.phoneRaw) === normalizeHeader(headers[colPhone])
  );
}

function parseCandidateRows(
  dataRows: string[][],
  headers: string[],
  colGuide: number,
  colRecipient: number,
  colPhone: number,
  colStatus: number,
): { rows: ParsedRow[]; validPhones: number } {
  const rows: ParsedRow[] = [];
  let validPhones = 0;

  for (const cells of dataRows) {
    const parsed: ParsedRow = {
      guideNumber: String(cells[colGuide] || '').trim(),
      recipient: String(cells[colRecipient] || '').trim(),
      phoneRaw: String(cells[colPhone] || '').trim(),
      phoneE164: '',
      phoneValid: false,
      status: colStatus !== -1 ? String(cells[colStatus] || '').trim() : '',
    };

    if (!parsed.guideNumber && !parsed.recipient && !parsed.phoneRaw) continue;
    if (isRepeatedHeaderRow(parsed, headers, colGuide, colRecipient, colPhone)) continue;

    const normalized = normalizePhoneE164(parsed.phoneRaw);
    parsed.phoneE164 = normalized.phone;
    parsed.phoneValid = normalized.valid;
    parsed.phoneReason = normalized.reason;

    if (parsed.phoneValid) validPhones += 1;
    rows.push(parsed);
  }

  return { rows, validPhones };
}

function parseSheet(sheet: XLSX.WorkSheet): ParseResult {
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][];

  if (grid.length < 2) {
    return { rows: [], errors: ['El archivo no contiene datos suficientes'] };
  }

  const scanLimit = Math.min(300, grid.length);
  const candidates: Array<{ rows: ParsedRow[]; validPhones: number }> = [];
  let sawHeaderWithoutRows = false;

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex += 1) {
    const headerRow = grid[rowIndex] || [];
    if (headerRow.every(value => !String(value || '').trim())) continue;

    const headers = headerRow.map(String);
    const colGuide = findColumn(headers, REQUIRED_COLUMNS.guideNumber);
    const colRecipient = findColumn(headers, REQUIRED_COLUMNS.recipient);
    const colPhone = findColumn(headers, REQUIRED_COLUMNS.phone);

    if (colGuide === -1 || colRecipient === -1 || colPhone === -1) continue;

    const colStatus = findColumn(headers, REQUIRED_COLUMNS.status);
    const candidate = parseCandidateRows(grid.slice(rowIndex + 1), headers, colGuide, colRecipient, colPhone, colStatus);

    if (candidate.rows.length === 0) {
      sawHeaderWithoutRows = true;
    } else {
      candidates.push(candidate);
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.validPhones !== b.validPhones) return b.validPhones - a.validPhones;
      return b.rows.length - a.rows.length;
    });
    return { rows: candidates[0].rows, errors: [] };
  }

  if (sawHeaderWithoutRows) {
    return { rows: [], errors: [ERR_NO_ROWS] };
  }

  return { rows: [], errors: [ERR_MISSING_COLUMNS] };
}

export function parseXlsFile(data: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return { rows: [], errors: ['El archivo no contiene hojas de cálculo'] };
    }

    let sawHeaderWithoutRows = false;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const parsed = parseSheet(sheet);

      if (parsed.errors.length === 0) {
        return parsed;
      }

      if (parsed.errors.includes(ERR_NO_ROWS)) {
        sawHeaderWithoutRows = true;
      }
    }

    if (sawHeaderWithoutRows) {
      return { rows: [], errors: [ERR_NO_ROWS] };
    }

    return { rows: [], errors: [ERR_MISSING_COLUMNS] };
  } catch (error) {
    return { rows: [], errors: [`Error al parsear el archivo: ${(error as Error).message}`] };
  }
}
