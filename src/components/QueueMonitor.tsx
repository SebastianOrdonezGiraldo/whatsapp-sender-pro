import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getSecurityHeaders } from '@/config/security';
import { getEdgeErrorMessage } from '@/lib/error-utils';

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  retrying: number;
  total: number;
}

interface QueueMonitorProps {
  jobId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onStatsUpdate?: (stats: QueueStats) => void;
}

export default function QueueMonitor({
  jobId,
  autoRefresh = true,
  refreshInterval = 3000,
  onStatsUpdate,
}: QueueMonitorProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc('get_job_queue_stats', {
          job_uuid: jobId,
        });

        if (error) throw error;

        if (data && isMounted) {
          const statsData = data as QueueStats;
          setStats(statsData);
          setLastUpdate(new Date());
          onStatsUpdate?.(statsData);
        }
      } catch (err) {
        console.error('Error fetching queue stats:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => { isMounted = false; clearInterval(interval); };
    }

    return () => { isMounted = false; };
  }, [jobId, autoRefresh, refreshInterval, onStatsUpdate]);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
        return;
      }

      const headers = {
        ...getSecurityHeaders(),
        Authorization: `Bearer ${session.access_token}`,
      };

      const { data, error } = await supabase.functions.invoke('process-message-queue', {
        body: { jobId },
        headers,
      });

      if (error) {
        const errorMsg = await getEdgeErrorMessage(error, 'Error al procesar la cola.');
        throw new Error(errorMsg);
      }

      toast.success(data?.message || 'Cola procesada correctamente');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar la cola.';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const completedCount = stats.sent + stats.failed;
  const progressPercentage = stats.total > 0 ? (completedCount / stats.total) * 100 : 0;
  const isProcessing = stats.processing > 0 || stats.pending > 0 || stats.retrying > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Estado de la Cola
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </CardTitle>
            <CardDescription>
              Última actualización: {lastUpdate.toLocaleTimeString('es-CO')}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleProcessQueue}
            disabled={processing || stats.pending === 0}
          >
            {processing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Procesar Cola
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso Total</span>
            <span className="font-medium">
              {completedCount} / {stats.total} ({progressPercentage.toFixed(1)}%)
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Pending */}
          <div className="glass-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Pendientes</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>

          {/* Processing */}
          {stats.processing > 0 && (
            <div className="glass-card p-3 space-y-1">
              <div className="flex items-center gap-2 text-blue-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Procesando</span>
              </div>
              <p className="text-2xl font-bold">{stats.processing}</p>
            </div>
          )}

          {/* Retrying */}
          {stats.retrying > 0 && (
            <div className="glass-card p-3 space-y-1">
              <div className="flex items-center gap-2 text-orange-500">
                <RefreshCw className="w-4 h-4" />
                <span className="text-xs">Reintentando</span>
              </div>
              <p className="text-2xl font-bold">{stats.retrying}</p>
            </div>
          )}

          {/* Sent */}
          <div className="glass-card p-3 space-y-1">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs">Enviados</span>
            </div>
            <p className="text-2xl font-bold">{stats.sent}</p>
          </div>

          {/* Failed */}
          {stats.failed > 0 && (
            <div className="glass-card p-3 space-y-1">
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="w-4 h-4" />
                <span className="text-xs">Fallidos</span>
              </div>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
          )}
        </div>

        {/* Status Message */}
        {isProcessing && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm">
            <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
            <div>
              <p className="font-medium">Procesamiento en curso</p>
              <p className="text-xs opacity-80 mt-0.5">
                Los mensajes se están enviando con rate limiting automático
              </p>
            </div>
          </div>
        )}

        {!isProcessing && stats.sent === stats.total && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Procesamiento completado</p>
              <p className="text-xs opacity-80 mt-0.5">
                Todos los mensajes han sido procesados exitosamente
              </p>
            </div>
          </div>
        )}

        {stats.failed > 0 && !isProcessing && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{stats.failed} mensajes fallidos</p>
              <p className="text-xs opacity-80 mt-0.5">
                Algunos mensajes no pudieron ser enviados después de múltiples reintentos
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

