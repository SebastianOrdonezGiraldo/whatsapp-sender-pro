import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileSpreadsheet, ChevronRight, Loader2, Trash2, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'QUEUED', label: 'En cola' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'COMPLETED', label: 'Completado' },
];

async function fetchJobIdsByGuideOrPhone(query: string): Promise<string[]> {
  const safeQuery = query.replaceAll('%', '').replaceAll('_', '').replaceAll('"', '');
  const pattern = `%${safeQuery}%`;
  const { data: messages, error } = await supabase
    .from('sent_messages')
    .select('job_id')
    .or(`guide_number.ilike."${pattern}",phone_e164.ilike."${pattern}"`);
  if (error) throw error;
  return [...new Set((messages ?? []).map((m: { job_id: string }) => m.job_id))];
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [guideOrPhoneQuery, setGuideOrPhoneQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [debouncedGuideOrPhone, setDebouncedGuideOrPhone] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedGuideOrPhone(guideOrPhoneQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [guideOrPhoneQuery]);

  const hasActiveFilters = statusFilter !== '' || searchQuery.trim() !== '' || guideOrPhoneQuery.trim() !== '' || dateFrom !== '' || dateTo !== '';

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuario no autenticado');
        setLoading(false);
        return;
      }

      const userIsAdmin = user.app_metadata?.role === 'admin';

      let jobIdsByGuideOrPhone: string[] | null = null;
      if (debouncedGuideOrPhone) {
        const ids = await fetchJobIdsByGuideOrPhone(debouncedGuideOrPhone);
        jobIdsByGuideOrPhone = ids;
        if (ids.length === 0) {
          setJobs([]);
          setLoading(false);
          setIsAdmin(userIsAdmin);
          return;
        }
      }

      setIsAdmin(userIsAdmin);

      let query = supabase
        .from('jobs')
        .select('id, source_filename, total_rows, valid_rows, sent_ok, sent_failed, duplicate_rows, status, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!userIsAdmin) {
        query = query.eq('user_id', user.id);
      }
      if (jobIdsByGuideOrPhone && jobIdsByGuideOrPhone.length > 0) {
        query = query.in('id', jobIdsByGuideOrPhone);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (debouncedSearch) {
        query = query.ilike('source_filename', `%${debouncedSearch}%`);
      }
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
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
  }, [statusFilter, debouncedSearch, debouncedGuideOrPhone, dateFrom, dateTo]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const clearFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
    setGuideOrPhoneQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const userIsAdmin = user.app_metadata?.role === 'admin';
      if (!userIsAdmin) throw new Error('Solo los administradores pueden eliminar el historial');

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

      setJobs([]);
      toast.success('Todo el historial del sistema eliminado');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar';
      toast.error(message);
    } finally {
      setDeletingAll(false);
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'En cola';
      case 'PROCESSING': return 'Procesando';
      case 'COMPLETED': return 'Completado';
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'PROCESSING': return 'bg-primary/10 text-primary border-primary/20';
      case 'COMPLETED': return 'status-sent';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 w-56 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-40 rounded bg-muted/70 animate-pulse" />
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="h-9 flex-1 min-w-[200px] max-w-sm rounded-lg bg-muted animate-pulse" />
            <div className="h-9 w-36 rounded-lg bg-muted animate-pulse" style={{ animationDelay: '0.1s' }} />
            <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card/80 p-4 flex items-center gap-4"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-muted animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-3/4 max-w-xs rounded bg-muted animate-pulse" />
                <div className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
              </div>
              <div className="hidden sm:flex gap-2">
                <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
                <div className="h-6 w-14 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-5 rounded bg-muted/70 animate-pulse shrink-0" />
            </div>
          ))}
        </div>

        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando historial...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">Historial de Envíos</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Revisa y filtra todos tus envíos de WhatsApp
          </p>
        </div>
        {isAdmin && jobs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deletingAll} className="shrink-0">
                {deletingAll ? (
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
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, eliminar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground shrink-0">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Filter className="w-4 h-4 text-primary" />
            </div>
            Filtros
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <label htmlFor="history-search" className="block text-xs font-medium text-muted-foreground mb-1.5">Archivo</label>
            <Input
              id="history-search"
              type="search"
              placeholder="Nombre del archivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-lg border-border/80 bg-background/80 placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <label htmlFor="history-guide-phone" className="block text-xs font-medium text-muted-foreground mb-1.5">Guía o teléfono</label>
            <Input
              id="history-guide-phone"
              type="search"
              placeholder="Ej: 1234567890 o 700..."
              value={guideOrPhoneQuery}
              onChange={(e) => setGuideOrPhoneQuery(e.target.value)}
              className="h-10 rounded-lg border-border/80 bg-background/80 placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <label htmlFor="history-status" className="block text-xs font-medium text-muted-foreground mb-1.5">Estado</label>
            <select
              id="history-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label htmlFor="history-date-from" className="block text-xs font-medium text-muted-foreground mb-1.5">Desde</label>
              <Input
                id="history-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-[140px] rounded-lg border-border/80 bg-background/80"
              />
            </div>
            <span className="text-muted-foreground text-sm pb-2.5 hidden sm:inline">—</span>
            <div>
              <label htmlFor="history-date-to" className="block text-xs font-medium text-muted-foreground mb-1.5">Hasta</label>
              <Input
                id="history-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 w-[140px] rounded-lg border-border/80 bg-background/80"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-10 rounded-lg border-dashed text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <X className="w-4 h-4 mr-1.5" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-16 text-center">
          <div className="inline-flex p-4 rounded-2xl bg-muted/40 mb-4">
            <Clock className="w-10 h-10 text-muted-foreground/60" />
          </div>
          <p className="text-muted-foreground font-medium">
            {hasActiveFilters ? 'No hay envíos que coincidan con los filtros' : 'Aún no hay envíos'}
          </p>
          <p className="text-sm text-muted-foreground/80 mt-1">
            {hasActiveFilters ? 'Prueba con otros criterios o limpia los filtros.' : 'Sube un archivo y envía mensajes para verlos aquí.'}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-6 rounded-lg" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {jobs.length} {jobs.length === 1 ? 'envío encontrado' : 'envíos encontrados'}
          </p>
          <div className="space-y-2">
            {jobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="group rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 flex items-center gap-4 hover:border-primary/40 hover:shadow-md/5 transition-all duration-200"
              >
                <Link to={`/history/${job.id}`} className="flex items-center justify-between flex-1 min-w-0 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                      <FileSpreadsheet className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium font-display truncate text-foreground">{job.source_filename}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        <Badge variant="outline" className={`text-xs font-normal shrink-0 ${getStatusStyle(job.status)}`}>
                          {getStatusLabel(job.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {job.sent_ok > 0 && (
                      <Badge variant="outline" className="status-sent text-xs font-normal">{job.sent_ok} enviados</Badge>
                    )}
                    {job.sent_failed > 0 && (
                      <Badge variant="outline" className="status-failed text-xs font-normal">{job.sent_failed} fallidos</Badge>
                    )}
                    {job.duplicate_rows > 0 && (
                      <Badge variant="outline" className="status-duplicate text-xs font-normal">{job.duplicate_rows} dup.</Badge>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-1 shrink-0">
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este envío?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará el envío <span className="font-semibold">{job.source_filename}</span> con todos sus mensajes asociados. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
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
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
