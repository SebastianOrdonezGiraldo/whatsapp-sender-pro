declare module 'jspdf-autotable' {
  import type jsPDF from 'jspdf';

  interface AutoTableOptions {
    head?: Array<Array<string | number>>;
    body: Array<Array<string | number>>;
    startY?: number;
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    columnStyles?: Record<number | string, unknown>;
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}


