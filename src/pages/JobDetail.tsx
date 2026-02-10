import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { getJobs, getMessagesByJob, type LocalJob, type LocalMessage } from '@/lib/local-history';

export default function JobDetailPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<LocalJob | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    const selectedJob = getJobs().find(item => item.id === jobId) || null;
    setJob(selectedJob);
    setMessages(getMessagesByJob(jobId));
    setLoading(false);
  }, [jobId]);

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
    { label: 'Duplicados', value: job.duplicate_rows, className: 'text-warning' },
    { label: 'Enviados', value: job.sent_ok, className: 'text-success' },
    { label: 'Fallidos', value: job.sent_failed, className: 'text-destructive' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold font-display">Detalle del Job</h2>
          <p className="text-sm text-muted-foreground font-mono">{job.source_filename}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map(stat => (
          <div key={stat.label} className="glass-card p-4">
            <p className={`text-2xl font-bold font-display ${stat.className}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Estado</p>
          <Badge variant="outline" className={job.status === 'COMPLETED' ? 'status-sent' : 'status-failed'}>
            {job.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleString('es-CO')}</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold font-display">Mensajes ({messages.length})</h3>
        </div>

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
                      className={msg.status === 'SENT' ? 'status-sent' : 'status-failed'}
                    >
                      {msg.status === 'SENT' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {msg.status === 'FAILED' && <XCircle className="w-3 h-3 mr-1" />}
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
            <p>No hay mensajes en este job</p>
          </div>
        )}
      </div>
    </div>
  );
}
