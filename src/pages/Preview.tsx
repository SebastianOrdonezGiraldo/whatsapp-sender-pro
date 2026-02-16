import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, XCircle, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { ParsedRow } from '@/lib/xls-parser';
import { getCarrierDisplayName } from '@/lib/carrier-detection';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getSecurityHeaders } from '@/config/security';
import { getEdgeErrorMessage, getEdgeErrorMessageSync } from '@/lib/error-utils';

type RowCategory = 'valid' | 'invalid' | 'duplicate';

interface CategorizedRow extends ParsedRow {
  category: RowCategory;
}

interface SendWhatsAppPayload {
  jobId: string;
  rows: Array<{
    phone_e164: string;
    guide_number: string;
    recipient_name: string;
  }>;
  autoProcess?: boolean;
}

async function invokeSendWhatsApp(payload: SendWhatsAppPayload) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
  }

  const securityHeaders = getSecurityHeaders();
  const { data, error } = await supabase.functions.invoke('enqueue-messages', {
    body: payload,
    headers: securityHeaders,
  });

  if (error) {
    console.error('Error en Edge Function:', error);
    const errorMsg = await getEdgeErrorMessage(error, 'Error al encolar los mensajes. Intente de nuevo.');
    throw new Error(errorMsg);
  }

  return data;
}

export default function PreviewPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CategorizedRow[]>([]);
  const [filename, setFilename] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<RowCategory | 'all'>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('wa-preview-data');
    const fname = sessionStorage.getItem('wa-preview-filename') || '';
    const assigned = sessionStorage.getItem('wa-assigned-to') || '';
    setFilename(fname);
    setAssignedTo(assigned);

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
  const sendableCount = counts.valid + counts.duplicate;
  const sendableRows = rows.filter(r => r.category === 'valid' || r.category === 'duplicate');

  const handleSendClick = () => {
    if (sendableCount === 0) {
      toast.error('No hay filas válidas para enviar');
      return;
    }
    setConfirmOpen(true);
  };

  async function handleConfirmSend() {
    if (sendableRows.length === 0) return;
    setConfirmOpen(false);
    setSending(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('No se pudo obtener el usuario autenticado');
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          source_filename: filename,
          total_rows: counts.total,
          valid_rows: counts.valid,
          invalid_rows: counts.invalid,
          duplicate_rows: counts.duplicate,
          status: 'QUEUED',
          assigned_to: assignedTo,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (jobError || !job) throw new Error(jobError?.message || 'Error creando job');

      const jobId = job.id;

      try {
        const data = await invokeSendWhatsApp({
          jobId,
          rows: sendableRows.map(r => ({
            phone_e164: r.phoneE164,
            guide_number: r.guideNumber,
            recipient_name: r.recipient,
          })),
          autoProcess: true,
        });

        const processed = data?.processResult;
        const processTriggerError = data?.processTriggerError;

        if (processTriggerError) {
          toast.warning(
            `${data?.enqueued ?? sendableRows.length} mensajes encolados. Use "Procesar cola" en esta página para iniciar el envío.`,
            { duration: 6000 }
          );
        } else if (processed) {
          toast.success(`Listo: ${processed.sent || 0} enviados, ${processed.failed || 0} fallidos. Puede reintentar los fallidos aquí.`);
        } else {
          toast.success(`${data?.enqueued || 0} mensajes encolados. El envío se realiza automáticamente.`);
        }

        sessionStorage.removeItem('wa-preview-data');
        sessionStorage.removeItem('wa-preview-filename');
        sessionStorage.removeItem('wa-assigned-to');
        navigate(`/history/${jobId}`, { state: { fromSend: true } });
      } catch (enqueueError) {
        const message = await getEdgeErrorMessage(enqueueError, 'Error al encolar los mensajes.');
        toast.error(
          `El envío se creó pero no se pudieron encolar los mensajes. (${message})`,
          { duration: 8000 }
        );
        navigate(`/history/${jobId}`, { state: { fromSend: true } });
        sessionStorage.removeItem('wa-preview-data');
        sessionStorage.removeItem('wa-preview-filename');
        sessionStorage.removeItem('wa-assigned-to');
      }
    } catch (err) {
      const message = getEdgeErrorMessageSync(err, 'Ha ocurrido un error. Intente de nuevo.');
      toast.error(message);
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
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{filename}</span>
              {assignedTo && (
                <span className="ml-3">
                  • Encargado: <span className="font-semibold text-primary">{assignedTo}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSendClick}
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

      {/* Confirmación antes de enviar */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar mensajes por WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviarán <strong>{sendableCount}</strong> mensaje(s):{' '}
              {counts.valid > 0 && <>{counts.valid} válidos</>}
              {counts.valid > 0 && counts.duplicate > 0 && ' y '}
              {counts.duplicate > 0 && <>{counts.duplicate} duplicados (se reenviarán)</>}.
              Serás redirigido al detalle del envío para ver el progreso en tiempo real.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmSend()}>
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <th className="text-left p-3 font-medium text-muted-foreground">Transportadora</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Razón</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const categoryConfig: Record<RowCategory, { className: string; label: string; icon: typeof CheckCircle2 }> = {
                  valid: { className: 'status-sent', label: 'Válido', icon: CheckCircle2 },
                  invalid: { className: 'status-failed', label: 'Inválido', icon: XCircle },
                  duplicate: { className: 'status-duplicate', label: 'Duplicado', icon: Copy },
                };
                const config = categoryConfig[row.category];
                const CategoryIcon = config.icon;

                return (
                <motion.tr
                  key={`${row.phoneE164}-${row.guideNumber}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="p-3">
                    <Badge variant="outline" className={config.className}>
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </td>
                  <td className="p-3 font-medium">{row.recipient || '—'}</td>
                  <td className="p-3 font-mono text-xs">
                    {row.phoneE164 || row.phoneRaw || '—'}
                  </td>
                  <td className="p-3 font-mono text-xs">{row.guideNumber || '—'}</td>
                  <td className="p-3">
                    {row.carrier ? (
                      <Badge variant="secondary" className="text-xs">
                        {getCarrierDisplayName(row.carrier)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.category === 'invalid' && (row.phoneReason || 'Datos incompletos')}
                    {row.category === 'duplicate' && 'Ya enviado previamente (se reenviará)'}
                  </td>
                </motion.tr>
                );
              })}
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
