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
  guideNumber: [
    'numero de guia',
    'número de guía',
    'numero de guía',
    'nro guia',
    'nro. guia',
    'guia',
    'no. guia',
    'numero guia',
    'guía',
    'n guia',
    'n° guia',
    '# guia'
  ],
  recipient: [
    'destinatario',
    'nombre destinatario',
    'dest',
    'nombre',
    'cliente',
    'receptor',
    'remitente'
  ],
  phone: [
    'numero de celular',
    'número de celular',
    'celular',
    'cel',
    'telefono celular',
    'teléfono celular',
    'nro celular',
    'nro. celular',
    'numero celular',
    'movil',
    'móvil',
    'whatsapp',
    'contacto',
    'telefono',
    'teléfono',
    'tel'
  ],
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

  const maxHeaderScanRows = Math.min(300, jsonData.length);
  let foundHeaderWithoutData = false;

  const candidates: Array<{ rows: ParsedRow[]; validPhones: number }> = [];

  // Some SISCLINET exports include intro rows and repeated header-like sections.
  // Evaluate every viable header row and keep the candidate with best data quality.
  for (let i = 0; i < maxHeaderScanRows; i++) {
    const row = jsonData[i] as string[];
    if (!row || row.every(cell => !String(cell || '').trim())) continue;

    const headers = row.map(String);
    const colGuide = findColumn(headers, REQUIRED_COLUMNS.guideNumber);
    const colRecipient = findColumn(headers, REQUIRED_COLUMNS.recipient);
    const colPhone = findColumn(headers, REQUIRED_COLUMNS.phone);

    if (colGuide === -1 || colRecipient === -1 || colPhone === -1) {
      continue;
    }

    const colStatus = findColumn(headers, REQUIRED_COLUMNS.status);
    const dataRows = jsonData.slice(i + 1);
    const rows: ParsedRow[] = [];
    let validPhones = 0;

    for (const dataRow of dataRows) {
      const r = dataRow as string[];
      const guideNumber = String(r[colGuide] || '').trim();
      const recipient = String(r[colRecipient] || '').trim();
      const phoneRaw = String(r[colPhone] || '').trim();
      const status = colStatus !== -1 ? String(r[colStatus] || '').trim() : '';

      if (!guideNumber && !recipient && !phoneRaw) continue;

      // Skip repeated header rows that can appear inside report sections.
      const normalizedGuide = normalizeHeader(guideNumber);
      const normalizedRecipient = normalizeHeader(recipient);
      const normalizedPhone = normalizeHeader(phoneRaw);

      const isRepeatedHeaderRow =
        normalizedGuide === normalizeHeader(String(headers[colGuide] || '')) &&
        normalizedRecipient === normalizeHeader(String(headers[colRecipient] || '')) &&
        normalizedPhone === normalizeHeader(String(headers[colPhone] || ''));
      if (isRepeatedHeaderRow) continue;

      const headerWords = ['guia', 'destinat', 'celular', 'telefono', 'estado', 'numero'];
      const headerHits = [normalizedGuide, normalizedRecipient, normalizedPhone]
        .reduce((acc, value) => acc + (headerWords.some(word => value.includes(word)) ? 1 : 0), 0);
      if (!/\d/.test(phoneRaw) && headerHits >= 2) continue;

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

    if (rows.length > 0) {
      candidates.push({ rows, validPhones });
    } else {
      foundHeaderWithoutData = true;
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (b.validPhones !== a.validPhones) return b.validPhones - a.validPhones;
      return b.rows.length - a.rows.length;
    });
    return { rows: candidates[0].rows, errors: [] };
  }

  if (foundHeaderWithoutData) {
    return { rows: [], errors: ['El archivo tiene encabezados válidos pero no contiene filas de datos'] };
  }

  return { rows: [], errors: ['No se encontraron las columnas requeridas: Número de Guía, Destinatario, Número de Celular'] };
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
