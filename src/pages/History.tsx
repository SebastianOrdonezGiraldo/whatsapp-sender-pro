import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileSpreadsheet, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Job {
  id: string;
  source_filename: string;
  total_rows: number;
  valid_rows: number;
  sent_ok: number;
  sent_failed: number;
  duplicate_rows: number;
  status: string;
  created_at: string;
  user_id: string;
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function fetchJobs() {
      try {
        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('Usuario no autenticado');
          setLoading(false);
          return;
        }

        const userIsAdmin = user.app_metadata?.role === 'admin';
        setIsAdmin(userIsAdmin);

        // Construir query base
        let query = supabase
          .from('jobs')
          .select('id, source_filename, total_rows, valid_rows, sent_ok, sent_failed, duplicate_rows, status, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(50);

        // Si no es admin, filtrar solo sus jobs
        if (!userIsAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        setJobs((data as Job[]) || []);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al cargar el historial';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');
  
      const userIsAdmin = user.app_metadata?.role === 'admin';

      if (!userIsAdmin) {
        throw new Error('Solo los administradores pueden eliminar el historial');
      }

      // Admin: borrar todos los registros
      const { error: sentMessagesError } = await supabase
        .from('sent_messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (sentMessagesError) throw sentMessagesError;

      const { error: queueError } = await supabase
        .from('message_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (queueError) throw queueError;

      const { error: jobsError } = await supabase
        .from('jobs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (jobsError) throw jobsError;

      toast.success('Todo el historial del sistema eliminado');
      setJobs([]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const userIsAdmin = user.app_metadata?.role === 'admin';
      if (!userIsAdmin) {
        throw new Error('Solo los administradores pueden eliminar envíos');
      }

      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      toast.success('Envío eliminado correctamente');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar envío';
      toast.error(message);
    } finally {
      setDeletingJobId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Historial de Envíos</h2>
          <p className="text-muted-foreground mt-1">Todos los mensajes procesados</p>
        </div>
        {isAdmin && jobs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Eliminar todo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar todo el historial?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará todos los jobs y mensajes enviados de forma permanente. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sí, eliminar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-muted-foreground">No hay envíos registrados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/history/${job.id}`}
                className="glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium font-display">{job.source_filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(job.created_at).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    {job.sent_ok > 0 && (
                      <Badge variant="outline" className="status-sent">{job.sent_ok} enviados</Badge>
                    )}
                    {job.sent_failed > 0 && (
                      <Badge variant="outline" className="status-failed">{job.sent_failed} fallidos</Badge>
                    )}
                    {job.duplicate_rows > 0 && (
                      <Badge variant="outline" className="status-duplicate">{job.duplicate_rows} dupes</Badge>
                    )}
                  </div>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          disabled={deletingJobId === job.id}
                          aria-label={`Eliminar envío ${job.source_filename}`}
                        >
                          {deletingJobId === job.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este envío?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará el envío <span className="font-semibold">{job.source_filename}</span> con todos sus mensajes asociados. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDeleteJob(job.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sí, eliminar envío
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
