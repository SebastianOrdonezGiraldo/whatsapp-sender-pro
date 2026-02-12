import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileSpreadsheet, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

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
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      const { data } = await supabase
        .from('jobs')
        .select('id, source_filename, total_rows, valid_rows, sent_ok, sent_failed, duplicate_rows, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      setJobs((data as Job[]) || []);
      setLoading(false);
    }
    fetchJobs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-display">Historial de Envíos</h2>
        <p className="text-muted-foreground mt-1">Todos los jobs procesados</p>
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
