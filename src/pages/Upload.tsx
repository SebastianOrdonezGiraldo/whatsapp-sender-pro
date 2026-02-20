import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileSpreadsheet, AlertCircle, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseXlsFile, type ParseResult } from '@/lib/xls-parser';
import { motion, AnimatePresence } from 'framer-motion';
import { LIMITS } from '@/config/limits';

// Lista de encargados de bodega
const WAREHOUSE_STAFF = [
  'Maria Paula',
  'Daniel',
  'Juan',
  'Miguel',
] as const;

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['xls', 'xlsx', 'xml'].includes(ext || '')) {
      setError('Formato no soportado. Suba un archivo .xls o .xlsx');
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handlePreview = async () => {
    if (!file) return;
    
    // Validar que se haya seleccionado un encargado
    if (!assignedTo) {
      setError('Por favor, seleccione quién está realizando el envío');
      return;
    }
    
    setParsing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const result: ParseResult = parseXlsFile(buffer);

      if (result.errors.length > 0) {
        setError(result.errors.join('. '));
        setParsing(false);
        return;
      }

      if (result.rows.length === 0) {
        setError('No se encontraron filas de datos en el archivo');
        setParsing(false);
        return;
      }

      // Validate maximum rows limit
      if (result.rows.length > LIMITS.MAX_ROWS_PER_FILE) {
        setError(
          `El archivo contiene ${result.rows.length} registros, pero el límite es ${LIMITS.MAX_ROWS_PER_FILE}. ` +
          `Por favor, divida el archivo en partes más pequeñas (máximo ${LIMITS.MAX_ROWS_PER_FILE} registros cada una) y súbalas por separado.`
        );
        setParsing(false);
        return;
      }

      // Store in sessionStorage for preview page
      sessionStorage.setItem('wa-preview-data', JSON.stringify(result.rows));
      sessionStorage.setItem('wa-preview-filename', file.name);
      sessionStorage.setItem('wa-assigned-to', assignedTo);
      navigate('/preview');
    } catch (e) {
      setError(`Error procesando el archivo: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-6 lg:mb-8">
        <h2 className="text-2xl lg:text-3xl font-bold font-display">Subir Informe</h2>
        <p className="text-muted-foreground mt-1.5">
          Cargue el archivo .xls exportado para enviar notificaciones por WhatsApp
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Columna principal: formulario */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 lg:p-8">
            <label className="block text-sm font-medium mb-3">
              ¿Quién está realizando este envío? <span className="text-destructive">*</span>
            </label>
            <select
              value={assignedTo}
              onChange={(e) => {
                setAssignedTo(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              <option value="">Seleccionar encargado...</option>
              {WAREHOUSE_STAFF.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {!assignedTo && (
              <p className="text-xs text-muted-foreground mt-2">
                Este campo es obligatorio para trazabilidad de los envíos
              </p>
            )}
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`glass-card p-8 lg:p-14 text-center cursor-pointer transition-all duration-200 touch-manipulation ${
              dragActive ? 'border-primary bg-primary/5 scale-[1.01] ring-2 ring-primary/30' : 'hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99]'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xls,.xlsx,.xml"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <AnimatePresence mode="wait">
              {file ? (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-xl bg-success/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-success" />
                  </div>
                  <div>
                    <p className="font-medium font-display text-lg">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file.size / 1024).toFixed(1)} KB — Click o arrastra otro archivo para cambiar
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                    <UploadIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium font-display text-lg">Arrastra el archivo aquí</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      o haz click para seleccionar — Formatos: .xls, .xlsx
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <Button
            className="w-full lg:w-auto lg:min-w-[200px] h-12 text-base font-display px-8"
            disabled={!file || !assignedTo || parsing}
            onClick={handlePreview}
          >
            {parsing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              'Previsualizar'
            )}
          </Button>
        </div>

        {/* Columna lateral: info y consejos (desktop) */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 glass-card p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div className="space-y-3">
                <p className="font-semibold text-foreground">Límite de registros</p>
                <p className="text-sm text-muted-foreground">
                  Máximo <span className="font-semibold text-primary">{LIMITS.MAX_ROWS_PER_FILE} registros</span> por archivo.
                  Si tienes más, divide el Excel en varios archivos.
                </p>
                <div className="text-sm text-muted-foreground pt-3 border-t border-border/50 space-y-2">
                  <p className="font-medium text-foreground">💡 Consejos</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ordena por fecha o transportadora antes de dividir</li>
                    <li>Cada archivo se procesa independientemente</li>
                    <li>Revisa el progreso en Historial</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
