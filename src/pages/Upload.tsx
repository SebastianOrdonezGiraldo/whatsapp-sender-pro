import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseXlsFile, type ParseResult } from '@/lib/xls-parser';
import { motion, AnimatePresence } from 'framer-motion';

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
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

      // Store in sessionStorage for preview page
      sessionStorage.setItem('wa-preview-data', JSON.stringify(result.rows));
      sessionStorage.setItem('wa-preview-filename', file.name);
      navigate('/preview');
    } catch (e) {
      setError(`Error procesando el archivo: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-display">Subir Informe</h2>
        <p className="text-muted-foreground mt-1">
          Cargue el archivo .xls exportado desde Servientrega SISCLINET
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`glass-card p-12 text-center cursor-pointer transition-all duration-200 ${
          dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'hover:border-primary/30'
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
              className="flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7 text-success" />
              </div>
              <div>
                <p className="font-medium font-display">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB — Click para cambiar
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                <UploadIcon className="w-7 h-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium font-display">Arrastra el archivo aquí</p>
                <p className="text-sm text-muted-foreground">o haz click para seleccionar (.xls, .xlsx)</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-start gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Preview Button */}
      <Button
        className="w-full mt-6 h-12 text-base font-display"
        disabled={!file || parsing}
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
  );
}
