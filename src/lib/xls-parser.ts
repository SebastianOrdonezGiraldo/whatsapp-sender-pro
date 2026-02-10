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
  const normalizedHeaders = headers.map(h => normalizeHeader(h || ''));
  const normalizedCandidates = candidates.map(c => normalizeHeader(c));

  for (const candidate of normalizedCandidates) {
    const exactIdx = normalizedHeaders.findIndex(h => h === candidate);
    if (exactIdx !== -1) return exactIdx;
  }

  for (const candidate of normalizedCandidates) {
    const includesIdx = normalizedHeaders.findIndex(h => h.includes(candidate));
    if (includesIdx !== -1) return includesIdx;
  }

  return -1;
}

function parseSheet(sheet: XLSX.WorkSheet): ParseResult {
  const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });

  if (jsonData.length < 2) {
    return { rows: [], errors: ['El archivo no contiene datos suficientes'] };
  }

  let headerRowIdx = -1;
  let colGuide = -1;
  let colRecipient = -1;
  let colPhone = -1;
  let colStatus = -1;

  // Some SISCLINET exports include extra heading rows before actual headers.
  for (let i = 0; i < Math.min(100, jsonData.length); i++) {
    const row = jsonData[i] as string[];
    if (!row || row.every(cell => !String(cell || '').trim())) continue;
    const headers = row.map(String);
    const gIdx = findColumn(headers, REQUIRED_COLUMNS.guideNumber);
    const rIdx = findColumn(headers, REQUIRED_COLUMNS.recipient);
    const pIdx = findColumn(headers, REQUIRED_COLUMNS.phone);

    if (gIdx !== -1 && rIdx !== -1 && pIdx !== -1) {
      headerRowIdx = i;
      colGuide = gIdx;
      colRecipient = rIdx;
      colPhone = pIdx;
      colStatus = findColumn(headers, REQUIRED_COLUMNS.status);
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { rows: [], errors: ['No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular'] };
  }

  const dataRows = jsonData.slice(headerRowIdx + 1);
  const rows: ParsedRow[] = [];

  for (const row of dataRows) {
    const r = row as string[];
    const guideNumber = String(r[colGuide] || '').trim();
    const recipient = String(r[colRecipient] || '').trim();
    const phoneRaw = String(r[colPhone] || '').trim();
    const status = colStatus !== -1 ? String(r[colStatus] || '').trim() : '';

    if (!guideNumber && !recipient && !phoneRaw) continue;

    const { valid, phone, reason } = normalizePhoneE164(phoneRaw);

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

  if (rows.length === 0) {
    return { rows: [], errors: ['El archivo tiene encabezados válidos pero no contiene filas de datos'] };
  }

  return { rows, errors: [] };
}

export function parseXlsFile(data: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return { rows: [], errors: ['El archivo no contiene hojas de cálculo'] };
    }

    let sawRequiredHeaders = false;
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const result = parseSheet(sheet);

      if (result.errors.length === 0) {
        return result;
      }

      if (!result.errors.includes('No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular')) {
        sawRequiredHeaders = true;
      }
    }

    if (sawRequiredHeaders) {
      return { rows: [], errors: ['El archivo tiene encabezados válidos pero no contiene filas de datos'] };
    }

    return { rows: [], errors: ['No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular'] };
  } catch (e) {
    return { rows: [], errors: [`Error al parsear el archivo: ${(e as Error).message}`] };
  }
}
