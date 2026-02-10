import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, XCircle, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedRow } from '@/lib/xls-parser';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

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
    checkDuplicates(parsedRows);
  }, [navigate]);

  async function checkDuplicates(parsedRows: ParsedRow[]) {
    try {
      // Get existing sent messages to check duplicates
      const validPhones = parsedRows
        .filter(r => r.phoneValid)
        .map(r => r.phoneE164);

      const { data: existing } = await supabase
        .from('sent_messages')
        .select('phone_e164, guide_number')
        .in('phone_e164', validPhones.length > 0 ? validPhones : ['__none__']);

      const existingSet = new Set(
        (existing || []).map(e => `${e.phone_e164}|${e.guide_number}`)
      );

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
    } catch (err) {
      console.error('Error checking duplicates:', err);
      // Categorize without duplicate check
      const categorized: CategorizedRow[] = parsedRows.map(row => ({
        ...row,
        category: row.phoneValid && row.guideNumber && row.recipient ? 'valid' : 'invalid',
      }));
      setRows(categorized);
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => ({
    valid: rows.filter(r => r.category === 'valid').length,
    invalid: rows.filter(r => r.category === 'invalid').length,
    duplicate: rows.filter(r => r.category === 'duplicate').length,
    total: rows.length,
  }), [rows]);

  const filteredRows = activeTab === 'all' ? rows : rows.filter(r => r.category === activeTab);

  async function handleSend() {
    const validRows = rows.filter(r => r.category === 'valid');
    if (validRows.length === 0) {
      toast.error('No hay filas válidas para enviar');
      return;
    }

    setSending(true);

    try {
      // Create job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          source_filename: filename,
          total_rows: counts.total,
          valid_rows: counts.valid,
          invalid_rows: counts.invalid,
          duplicate_rows: counts.duplicate,
          status: 'PROCESSING',
        })
        .select()
        .single();

      if (jobError || !job) throw new Error(jobError?.message || 'Error creando job');

      // Call edge function to send messages
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          jobId: job.id,
          rows: validRows.map(r => ({
            phone_e164: r.phoneE164,
            guide_number: r.guideNumber,
            recipient_name: r.recipient,
          })),
        },
      });

      if (error) throw error;

      toast.success(`Envío completado: ${data?.sent_ok || 0} enviados, ${data?.sent_failed || 0} fallidos`);
      sessionStorage.removeItem('wa-preview-data');
      sessionStorage.removeItem('wa-preview-filename');
      navigate(`/history/${job.id}`);
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
      {/* Header */}
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
          disabled={counts.valid === 0 || sending}
          className="h-11 px-6 font-display"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
          ) : (
            <><Send className="w-4 h-4 mr-2" /> Enviar WhatsApp ({counts.valid})</>
          )}
        </Button>
      </div>

      {/* Stats */}
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

      {/* Table */}
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
                    {row.category === 'duplicate' && 'Ya enviado previamente'}
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
