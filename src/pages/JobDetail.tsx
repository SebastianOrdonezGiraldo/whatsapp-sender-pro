import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import QueueMonitor from '@/components/QueueMonitor';

interface Job {
  id: string;
  source_filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  sent_ok: number;
  sent_failed: number;
  status: string;
  created_at: string;
}

interface Message {
  id: string;
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  status: string;
  error_message: string | null;
  wa_message_id: string | null;
  created_at: string;
}

interface QueueMessage {
  id: string;
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  error_message: string | null;
  error_code: string | null;
  scheduled_at: string;
  created_at: string;
}

export default function JobDetailPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [queueMessages, setQueueMessages] = useState<QueueMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [jobRes, msgRes, queueRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId!).maybeSingle(),
      supabase.from('sent_messages').select('*').eq('job_id', jobId!).order('created_at'),
      supabase.from('message_queue').select('*').eq('job_id', jobId!).order('created_at'),
    ]);
    setJob(jobRes.data as Job | null);
    setMessages((msgRes.data as Message[]) || []);
    setQueueMessages((queueRes.data as QueueMessage[]) || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    async function fetch() {
      const [jobRes, msgRes] = await Promise.all([
        supabase.from('jobs').select('id, source_filename, total_rows, valid_rows, invalid_rows, duplicate_rows, sent_ok, sent_failed, status, created_at').eq('id', jobId!).maybeSingle(),
        supabase.from('sent_messages').select('id, phone_e164, guide_number, recipient_name, status, error_message, wa_message_id, created_at').eq('job_id', jobId!).order('created_at'),
      ]);
      setJob(jobRes.data as Job | null);
      setMessages((msgRes.data as Message[]) || []);
      setLoading(false);
    }
    if (jobId) fetch();
  }, [jobId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Job no encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/history')}>
          Volver al historial
        </Button>
      </div>
    );
  }

  const stats = [
    { label: 'Total', value: job.total_rows, className: '' },
    { label: 'Válidos', value: job.valid_rows, className: 'text-success' },
    { label: 'Inválidos', value: job.invalid_rows, className: 'text-destructive' },
    { label: 'Duplicados', value: job.duplicate_rows, className: 'text-muted-foreground' },
    { label: 'Enviados OK', value: job.sent_ok, className: 'text-success' },
    { label: 'Fallidos', value: job.sent_failed, className: 'text-destructive' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold font-display">{job.source_filename}</h2>
            <p className="text-sm text-muted-foreground">
              {new Date(job.created_at).toLocaleString('es-CO')}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Queue Monitor */}
      {queueMessages.length > 0 && (
        <div className="mb-6">
          <QueueMonitor jobId={jobId!} onStatsUpdate={handleRefresh} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="glass-card p-3 text-center">
            <p className={`text-xl font-bold font-display ${s.className}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs for Messages */}
      <Tabs defaultValue="sent" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sent">
            Mensajes Enviados ({messages.length})
          </TabsTrigger>
          {queueMessages.length > 0 && (
            <TabsTrigger value="queue">
              Cola ({queueMessages.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sent">
          {/* Messages table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Destinatario</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Celular</th>
                <th className="text-left p-3 font-medium text-muted-foreground">N° Guía</th>
                <th className="text-left p-3 font-medium text-muted-foreground">WA ID</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Error</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg, i) => (
                <motion.tr
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="p-3">
                    <Badge
                      variant="outline"
                      className={
                        msg.status === 'SENT' ? 'status-sent' :
                        msg.status === 'FAILED' ? 'status-failed' :
                        'status-pending'
                      }
                    >
                      {msg.status === 'SENT' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {msg.status === 'FAILED' && <XCircle className="w-3 h-3 mr-1" />}
                      {msg.status === 'PENDING' && <MinusCircle className="w-3 h-3 mr-1" />}
                      {msg.status}
                    </Badge>
                  </td>
                  <td className="p-3 font-medium">{msg.recipient_name}</td>
                  <td className="p-3 font-mono text-xs">{msg.phone_e164}</td>
                  <td className="p-3 font-mono text-xs">{msg.guide_number}</td>
                  <td className="p-3 font-mono text-xs truncate max-w-[120px]">{msg.wa_message_id || '—'}</td>
                  <td className="p-3 text-xs text-destructive">{msg.error_message || ''}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay mensajes enviados en este job</p>
          </div>
        )}
      </div>
        </TabsContent>

        {queueMessages.length > 0 && (
          <TabsContent value="queue">
            {/* Queue Messages table */}
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Prioridad</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Destinatario</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Celular</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">N° Guía</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Reintentos</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Próximo Intento</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueMessages.map((msg, i) => (
                      <motion.tr
                        key={msg.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              msg.status === 'SENT' ? 'status-sent' :
                              msg.status === 'FAILED' ? 'status-failed' :
                              msg.status === 'RETRYING' ? 'bg-orange-500/10 text-orange-600' :
                              msg.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-600' :
                              'status-pending'
                            }
                          >
                            {msg.status === 'SENT' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {msg.status === 'FAILED' && <XCircle className="w-3 h-3 mr-1" />}
                            {msg.status === 'RETRYING' && <RefreshCw className="w-3 h-3 mr-1" />}
                            {msg.status === 'PROCESSING' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            {msg.status === 'PENDING' && <MinusCircle className="w-3 h-3 mr-1" />}
                            {msg.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="font-mono text-xs">
                            P{msg.priority}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium">{msg.recipient_name}</td>
                        <td className="p-3 font-mono text-xs">{msg.phone_e164}</td>
                        <td className="p-3 font-mono text-xs">{msg.guide_number}</td>
                        <td className="p-3 text-xs">
                          {msg.retry_count}/{msg.max_retries}
                        </td>
                        <td className="p-3 text-xs">
                          {msg.next_retry_at 
                            ? new Date(msg.next_retry_at).toLocaleTimeString('es-CO')
                            : '—'
                          }
                        </td>
                        <td className="p-3 text-xs text-destructive max-w-[200px] truncate">
                          {msg.error_message || ''}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
