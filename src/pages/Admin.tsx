import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2, Users, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface StaffMember {
  id: string;
  name: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  job_count?: number;
}

export default function AdminPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouse_staff')
        .select('*')
        .order('name');

      if (error) throw error;

      const staffData = (data as StaffMember[]) || [];

      const { data: jobCounts } = await supabase
        .from('jobs')
        .select('assigned_to_id');

      const countMap = new Map<string, number>();
      if (jobCounts) {
        for (const job of jobCounts) {
          if (job.assigned_to_id) {
            countMap.set(job.assigned_to_id, (countMap.get(job.assigned_to_id) || 0) + 1);
          }
        }
      }

      setStaff(
        staffData.map((s) => ({
          ...s,
          job_count: countMap.get(s.id) || 0,
        }))
      );
    } catch (err) {
      toast.error('Error al cargar el personal');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStaff();
  }, [fetchStaff]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('warehouse_staff').insert({ name: trimmed });
      if (error) throw error;
      toast.success(`"${trimmed}" agregado al personal`);
      setNewName('');
      setShowAddDialog(false);
      await fetchStaff();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
        toast.error(`Ya existe un operario con el nombre "${trimmed}"`);
      } else {
        toast.error(msg);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setEditName(member.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('warehouse_staff')
        .update({ name: trimmed })
        .eq('id', id);
      if (error) throw error;
      toast.success('Nombre actualizado');
      setEditingId(null);
      await fetchStaff();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error(`Ya existe otro operario con el nombre "${trimmed}"`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    try {
      const { error } = await supabase
        .from('warehouse_staff')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);
      if (error) throw error;
      toast.success(member.is_active ? 'Operario desactivado' : 'Operario activado');
      await fetchStaff();
    } catch (err) {
      toast.error('Error al cambiar estado');
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('warehouse_staff')
        .delete()
        .eq('id', deletingId);
      if (error) throw error;
      toast.success('Operario eliminado');
      setDeletingId(null);
      await fetchStaff();
    } catch (err) {
      toast.error('Error al eliminar operario');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredStaff = staff.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold font-display tracking-tight">Panel de Administración</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">Gestión del personal de bodega</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="shrink-0 h-11 px-6 font-display">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Operario
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 lg:p-5">
          <p className="text-2xl font-bold font-display">{staff.length}</p>
          <p className="text-sm text-muted-foreground">Total operarios</p>
        </div>
        <div className="glass-card p-4 lg:p-5">
          <p className="text-2xl font-bold font-display text-success">{staff.filter((s) => s.is_active).length}</p>
          <p className="text-sm text-muted-foreground">Activos</p>
        </div>
        <div className="glass-card p-4 lg:p-5">
          <p className="text-2xl font-bold font-display text-muted-foreground">{staff.filter((s) => !s.is_active).length}</p>
          <p className="text-sm text-muted-foreground">Inactivos</p>
        </div>
        <div className="glass-card p-4 lg:p-5">
          <p className="text-2xl font-bold font-display text-primary">
            {staff.reduce((sum, s) => sum + (s.job_count || 0), 0)}
          </p>
          <p className="text-sm text-muted-foreground">Envíos asignados</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <Input
          type="search"
          placeholder="Buscar operario..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 rounded-lg border-border/80 bg-background/50 placeholder:text-muted-foreground/70 max-w-sm"
        />
      </div>

      {/* Staff table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Envíos</TableHead>
              <TableHead>Vinculado a</TableHead>
              <TableHead>Fecha de alta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? 'No hay operarios que coincidan con la búsqueda' : 'No hay operarios registrados'}
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((member, i) => (
                <motion.tr
                  key={member.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="font-medium">
                    {editingId === member.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-9 max-w-[200px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveEdit(member.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-success"
                          onClick={() => void handleSaveEdit(member.id)}
                          disabled={savingEdit}
                        >
                          {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-display">{member.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        member.is_active
                          ? 'status-sent cursor-pointer'
                          : 'bg-muted text-muted-foreground border-border cursor-pointer'
                      }
                      onClick={() => void handleToggleActive(member)}
                    >
                      {member.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm">{member.job_count}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.user_id ? (
                      <span className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Vinculado
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString('es-CO', {
                      dateStyle: 'medium',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleStartEdit(member)}
                        disabled={editingId !== null}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={editingId !== null}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar operario?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.job_count && member.job_count > 0 ? (
                                <span className="text-destructive font-medium">
                                  Este operario tiene {member.job_count} envío(s) asignado(s).
                                  Al eliminarlo, los envíos quedarán sin referencia de operario.
                                  Considera desactivarlo en lugar de eliminarlo.
                                </span>
                              ) : (
                                'Se eliminará permanentemente. Esta acción no se puede deshacer.'
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                setDeletingId(member.id);
                                void handleDelete();
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleting && deletingId === member.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add dialog */}
      <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Agregar Operario</AlertDialogTitle>
            <AlertDialogDescription>
              Ingresa el nombre del nuevo operario de bodega.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nombre del operario"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAdd();
                if (e.key === 'Escape') setShowAddDialog(false);
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleAdd()} disabled={adding || !newName.trim()}>
              {adding ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Agregando...</>
              ) : (
                'Agregar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating admin indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-muted-foreground">
        <Users className="w-4 h-4 text-primary" />
        <span>
          Los operarios activos aparecerán en el formulario de carga de archivos.
          Los inactivos se ocultan del selector pero mantienen su histórico.
        </span>
      </div>
    </div>
  );
}
