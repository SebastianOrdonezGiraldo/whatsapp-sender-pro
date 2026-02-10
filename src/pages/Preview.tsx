import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, XCircle, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ParsedRow } from '@/lib/xls-parser';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { WA_RUNTIME_CONFIG } from '@/config/whatsapp';
import { delay, sendWhatsAppMessage } from '@/lib/whatsapp-api';
import { getSentMessageKeySet, saveJobWithMessages, type LocalJob, type LocalMessage } from '@/lib/local-history';

type RowCategory = 'valid' | 'invalid' | 'duplicate';

interface CategorizedRow extends ParsedRow {
  category: RowCategory;
}

const ALLOWED_STATUS = 'Impreso';

export default function PreviewPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CategorizedRow[]>([]);
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<RowCategory | 'all'>('all');

  useEffect(() => {
    const raw = sessionStorage.getItem('wa-preview-data');
    const fname = sessionStorage.getItem('wa-preview-filename') || '';
    setFilename(fname);

    if (!raw) {
      navigate('/');
      return;
    }

    const parsedRows: ParsedRow[] = JSON.parse(raw);
    categorizeRows(parsedRows);
  }, [navigate]);

  function categorizeRows(parsedRows: ParsedRow[]) {
    const existingSet = getSentMessageKeySet();

    const categorized: CategorizedRow[] = parsedRows.map(row => {
      if (!row.phoneValid || !row.guideNumber || !row.recipient) {
        return { ...row, category: 'invalid' as const };
      }
      if (row.status && row.status.toLowerCase() !== ALLOWED_STATUS.toLowerCase()) {
        return { ...row, category: 'invalid' as const, phoneReason: `Estado "${row.status}" no es "${ALLOWED_STATUS}"` };
      }
      const key = `${row.phoneE164}|${row.guideNumber}`;
      if (existingSet.has(key)) {
        return { ...row, category: 'duplicate' as const };
      }
      return { ...row, category: 'valid' as const };
    });

    setRows(categorized);
    setLoading(false);
  }

  const counts = useMemo(() => ({
    valid: rows.filter(r => r.category === 'valid').length,
    invalid: rows.filter(r => r.category === 'invalid').length,
    duplicate: rows.filter(r => r.category === 'duplicate').length,
    total: rows.length,
  }), [rows]);

  const filteredRows = activeTab === 'all' ? rows : rows.filter(r => r.category === activeTab);
  const sendableCount = counts.valid + counts.duplicate;

  async function handleSend() {
    const sendableRows = rows.filter(r => r.category === 'valid' || r.category === 'duplicate');
    if (sendableRows.length === 0) {
      toast.error('No hay filas válidas para enviar');
      return;
    }

    if (!WA_RUNTIME_CONFIG.token || !WA_RUNTIME_CONFIG.phoneNumberId) {
      toast.error('Faltan credenciales locales en src/config/whatsapp.ts');
      return;
    }

    setSending(true);

    try {
      const jobId = crypto.randomUUID();
      const now = new Date().toISOString();
      let sentOk = 0;
      let sentFailed = 0;

      const messages: LocalMessage[] = [];

      for (const row of sendableRows) {
        const result = await sendWhatsAppMessage({
          phoneE164: row.phoneE164,
          guideNumber: row.guideNumber,
          recipientName: row.recipient,
        });

        if (result.ok) {
          sentOk++;
        } else {
          sentFailed++;
        }

        messages.push({
          id: crypto.randomUUID(),
          job_id: jobId,
          phone_e164: row.phoneE164,
          guide_number: row.guideNumber,
          recipient_name: row.recipient,
          status: result.ok ? 'SENT' : 'FAILED',
          error_message: result.errorMessage,
          wa_message_id: result.waMessageId,
          created_at: new Date().toISOString(),
        });

        if (WA_RUNTIME_CONFIG.sendDelayMs > 0) {
          await delay(WA_RUNTIME_CONFIG.sendDelayMs);
        }
      }

      const job: LocalJob = {
        id: jobId,
        source_filename: filename,
        total_rows: counts.total,
        valid_rows: counts.valid,
        invalid_rows: counts.invalid,
        duplicate_rows: counts.duplicate,
        sent_ok: sentOk,
        sent_failed: sentFailed,
        status: sentFailed > 0 && sentOk === 0 ? 'FAILED' : 'COMPLETED',
        created_at: now,
      };

      saveJobWithMessages(job, messages);

      toast.success(`Envío completado: ${sentOk} enviados, ${sentFailed} fallidos`);
      sessionStorage.removeItem('wa-preview-data');
      sessionStorage.removeItem('wa-preview-filename');
      navigate(`/history/${jobId}`);
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { key: 'all' as const, label: 'Todos', count: counts.total },
    { key: 'valid' as const, label: 'Válidos', count: counts.valid },
    { key: 'invalid' as const, label: 'Inválidos', count: counts.invalid },
    { key: 'duplicate' as const, label: 'Duplicados', count: counts.duplicate },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold font-display">Previsualización</h2>
            <p className="text-sm text-muted-foreground font-mono">{filename}</p>
          </div>
        </div>
        <Button
          onClick={handleSend}
          disabled={sendableCount === 0 || sending}
          className="h-11 px-6 font-display"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> Enviar WhatsApp ({sendableCount})</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`glass-card p-4 text-left transition-all ${
              activeTab === tab.key ? 'ring-2 ring-primary' : ''
            }`}
          >
            <p className="text-2xl font-bold font-display">{tab.count}</p>
            <p className="text-sm text-muted-foreground">{tab.label}</p>
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Destinatario</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Celular</th>
                <th className="text-left p-3 font-medium text-muted-foreground">N° Guía</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Razón</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        row.category === 'valid' ? 'status-sent' :
                        row.category === 'invalid' ? 'status-failed' :
                        'status-duplicate'
                      }
                    >
                      {row.category === 'valid' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {row.category === 'invalid' && <XCircle className="w-3 h-3 mr-1" />}
                      {row.category === 'duplicate' && <Copy className="w-3 h-3 mr-1" />}
                      {row.category === 'valid' ? 'Válido' : row.category === 'invalid' ? 'Inválido' : 'Duplicado'}
                    </Badge>
                  </td>
                  <td className="p-3 font-medium">{row.recipient || '—'}</td>
                  <td className="p-3 font-mono text-xs">
                    {row.phoneE164 || row.phoneRaw || '—'}
                  </td>
                  <td className="p-3 font-mono text-xs">{row.guideNumber || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.category === 'invalid' && (row.phoneReason || 'Datos incompletos')}
                    {row.category === 'duplicate' && 'Ya enviado previamente (se reenviará)'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No hay filas en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  );
}
