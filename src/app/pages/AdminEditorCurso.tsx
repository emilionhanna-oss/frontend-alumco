import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Toaster } from '../components/ui/sonner';
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
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { courseService, userService } from '../services/apiService';
import type { CourseDetail, CursoModulo, User } from '../types';

const PRACTICA_PRESENCIAL_MESSAGE =
  'Se le ha notificado a tu instructor que has finalizado la parte teórica. Por favor, espera a ser contactado para coordinar tu evaluación práctica presencial';

type ModuloTipo = 'video' | 'lectura' | 'quiz' | 'practica_presencial';

type LecturaContenido = {
  archivoNombre?: string;
  instrucciones?: string;
};

type QuizTipoPregunta = 'seleccion_multiple' | 'respuesta_escrita';

type QuizOpcion = {
  texto: string;
  correcta: boolean;
};

type QuizPregunta = {
  tipo: QuizTipoPregunta;
  pregunta: string;
  opciones?: QuizOpcion[];
  respuestaModelo?: string;
};

type ModuloContenido = string | LecturaContenido | QuizPregunta[];

type EditModulo = {
  tituloModulo: string;
  tipo: ModuloTipo;
  contenido: ModuloContenido;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function coerceContenidoForTipo(nextTipo: ModuloTipo, prev: ModuloContenido): ModuloContenido {
  if (nextTipo === 'practica_presencial') return PRACTICA_PRESENCIAL_MESSAGE;

  if (nextTipo === 'quiz') {
    if (Array.isArray(prev)) return prev;
    return [];
  }

  if (nextTipo === 'lectura') {
    if (isPlainObject(prev)) {
      return {
        archivoNombre: typeof prev.archivoNombre === 'string' ? prev.archivoNombre : undefined,
        instrucciones: typeof prev.instrucciones === 'string' ? prev.instrucciones : undefined,
      } satisfies LecturaContenido;
    }
    if (typeof prev === 'string') return { instrucciones: prev };
    return { instrucciones: '' };
  }

  // video
  if (typeof prev === 'string') return prev;
  if (isPlainObject(prev) && typeof prev.instrucciones === 'string') return prev.instrucciones;
  return '';
}

export default function AdminEditorCurso() {
  const navigate = useNavigate();
  const { id } = useParams();

  const courseId = useMemo(() => (id ? String(id) : ''), [id]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editModules, setEditModules] = useState<EditModulo[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleType, setNewModuleType] = useState<ModuloTipo>('lectura');
  const [newModuleContent, setNewModuleContent] = useState('');
  const [newModuleFileName, setNewModuleFileName] = useState('');
  const [newModuleQuiz, setNewModuleQuiz] = useState<QuizPregunta[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRedirectingAfterSave, setIsRedirectingAfterSave] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [baselineSnapshot, setBaselineSnapshot] = useState('');

  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [massAssignSede, setMassAssignSede] = useState<string>('all');
  const [massAssignCargo, setMassAssignCargo] = useState<string>('all');
  const [isMassAssigning, setIsMassAssigning] = useState(false);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        editTitle,
        editDescription,
        editImage,
        editModules,
      }),
    [editTitle, editDescription, editImage, editModules]
  );

  const hasUnsavedChanges = baselineSnapshot !== '' && baselineSnapshot !== currentSnapshot;

  const activeUsers = useMemo(
    () =>
      allUsers.filter(
        (u) => String(u?.estado || '').toLowerCase() === 'activo' && typeof u?.id === 'string'
      ),
    [allUsers]
  );

  const availableSedes = useMemo(() => {
    const set = new Set<string>();
    for (const user of activeUsers) {
      const sede = String(user?.sede || '').trim();
      if (sede) set.add(sede);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [activeUsers]);

  const availableCargos = useMemo(() => {
    const set = new Set<string>();
    for (const user of activeUsers) {
      const cargo = String(user?.cargo || '').trim();
      if (cargo) set.add(cargo);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [activeUsers]);

  const redirectTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!courseId) {
        setLoadError('Falta el ID del curso.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await courseService.getCourseDetail(courseId);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'No se pudo cargar el curso');
        }

        const detail = response.data as CourseDetail;
        const modulos = (detail.modulos || []) as CursoModulo[];

        if (!isMounted) return;

        const loadedTitle = detail.title || '';
        const loadedDescription = detail.description || '';
        const loadedImage = detail.image || '';
        const loadedAssignedUsers = Array.isArray(detail.alumnosInscritos)
          ? detail.alumnosInscritos.map(String)
          : [];

        setEditTitle(loadedTitle);
        setEditDescription(loadedDescription);
        setEditImage(loadedImage);
        setAssignedUserIds(loadedAssignedUsers);

        const mapped: EditModulo[] = modulos.map((m) => {
          const tipo = (m.tipo || 'lectura') as ModuloTipo;

          if (tipo === 'practica_presencial') {
            return {
              tituloModulo: m.tituloModulo || 'Módulo sin título',
              tipo,
              contenido: PRACTICA_PRESENCIAL_MESSAGE,
            };
          }

          if (tipo === 'lectura') {
            const raw = (m as any).contenido;

            if (typeof raw === 'string') {
              return {
                tituloModulo: m.tituloModulo || 'Módulo sin título',
                tipo,
                contenido: { instrucciones: raw } satisfies LecturaContenido,
              };
            }

            if (isPlainObject(raw)) {
              return {
                tituloModulo: m.tituloModulo || 'Módulo sin título',
                tipo,
                contenido: {
                  archivoNombre: typeof raw.archivoNombre === 'string' ? raw.archivoNombre : undefined,
                  instrucciones: typeof raw.instrucciones === 'string' ? raw.instrucciones : undefined,
                } satisfies LecturaContenido,
              };
            }

            return {
              tituloModulo: m.tituloModulo || 'Módulo sin título',
              tipo,
              contenido: { instrucciones: '' } satisfies LecturaContenido,
            };
          }

          if (tipo === 'quiz') {
            const raw = (m as any).contenido;

            if (Array.isArray(raw)) {
              return {
                tituloModulo: m.tituloModulo || 'Módulo sin título',
                tipo,
                contenido: raw as QuizPregunta[],
              };
            }

            if (typeof raw === 'string') {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  return {
                    tituloModulo: m.tituloModulo || 'Módulo sin título',
                    tipo,
                    contenido: parsed as QuizPregunta[],
                  };
                }
              } catch {
                // ignore
              }
            }

            return {
              tituloModulo: m.tituloModulo || 'Módulo sin título',
              tipo,
              contenido: [] as QuizPregunta[],
            };
          }

          // video
          return {
            tituloModulo: m.tituloModulo || 'Módulo sin título',
            tipo,
            contenido: typeof (m as any).contenido === 'string' ? (m as any).contenido : '',
          };
        });

        setEditModules(mapped);
        setSelectedIndex(0);

        setBaselineSnapshot(
          JSON.stringify({
            editTitle: loadedTitle,
            editDescription: loadedDescription,
            editImage: loadedImage,
            editModules: mapped,
          })
        );

        setNewModuleTitle('');
        setNewModuleType('lectura');
        setNewModuleContent('');
        setNewModuleFileName('');
        setNewModuleQuiz([]);
      } catch (e) {
        if (!isMounted) return;
        setLoadError(e instanceof Error ? e.message : 'No se pudo cargar el curso');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setIsLoadingUsers(true);

      try {
        const response = await userService.getUsers();
        if (!isMounted) return;
        setAllUsers(response.success && response.data ? response.data : []);
      } finally {
        if (!isMounted) return;
        setIsLoadingUsers(false);
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateModule = (index: number, patch: Partial<EditModulo>) => {
    setEditModules((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeModule = (index: number) => {
    const name = editModules[index]?.tituloModulo || `#${index + 1}`;
    const ok = window.confirm(
      `¿Estás seguro que deseas eliminar el módulo ${name}?\n\nSe perderán todos los datos de este módulo si guardas el curso.`
    );
    if (!ok) return;

    setEditModules((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex((prev) => {
      if (index < prev) return prev - 1;
      if (index === prev) return Math.max(0, prev - 1);
      return prev;
    });
  };

  const moveModule = (from: number, to: number) => {
    setEditModules((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });

    setSelectedIndex((prev) => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });
  };

  const addModule = () => {
    const tituloModulo = newModuleTitle.trim();
    if (!tituloModulo) return;

    const tipo = newModuleType;

    const contenido: ModuloContenido = (() => {
      if (tipo === 'practica_presencial') return PRACTICA_PRESENCIAL_MESSAGE;
      if (tipo === 'video') return (newModuleContent || '').trim();
      if (tipo === 'lectura') {
        const instrucciones = (newModuleContent || '').trim();
        const archivoNombre = (newModuleFileName || '').trim();
        return {
          instrucciones: instrucciones || undefined,
          archivoNombre: archivoNombre || undefined,
        } satisfies LecturaContenido;
      }
      return newModuleQuiz;
    })();

    setEditModules((prev) => {
      const next = [...prev, { tituloModulo, tipo, contenido }];
      setSelectedIndex(next.length - 1);
      return next;
    });

    setNewModuleTitle('');
    setNewModuleType('lectura');
    setNewModuleContent('');
    setNewModuleFileName('');
    setNewModuleQuiz([]);
  };

  const selectedModule = editModules[selectedIndex];

  const handleMassAssign = async (mode: 'sede' | 'cargo') => {
    if (!courseId || isMassAssigning) return;

    const selectedValue = mode === 'sede' ? massAssignSede : massAssignCargo;
    if (!selectedValue || selectedValue === 'all') {
      toast.error(`Selecciona ${mode === 'sede' ? 'una sede' : 'un cargo'} para inscribir.`);
      return;
    }

    const candidates = activeUsers.filter((user) => {
      if (!user.id) return false;

      if (mode === 'sede') {
        return String(user.sede || '').trim() === selectedValue;
      }

      return String(user.cargo || '').trim() === selectedValue;
    });

    if (candidates.length === 0) {
      toast.error('No se encontraron usuarios activos para ese filtro.');
      return;
    }

    const candidateIds = candidates.map((u) => String(u.id));
    const mergedIds = Array.from(new Set([...assignedUserIds, ...candidateIds]));

    if (mergedIds.length === assignedUserIds.length) {
      toast.message('Todos los usuarios de ese grupo ya estaban inscritos.');
      return;
    }

    setIsMassAssigning(true);

    try {
      const response = await courseService.assignStudentsToCourse(courseId, mergedIds);
      if (!response.success) {
        toast.error(response.error || 'No se pudo realizar la asignación masiva.');
        return;
      }

      setAssignedUserIds(mergedIds);

      const addedCount = mergedIds.length - assignedUserIds.length;
      toast.success(`Se inscribieron ${addedCount} usuario(s) por ${mode}.`);
    } finally {
      setIsMassAssigning(false);
    }
  };

  const handleSave = async () => {
    if (!courseId || isRedirectingAfterSave) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await courseService.updateCourse(courseId, {
        titulo: editTitle,
        descripcion: editDescription,
        imagen: editImage,
        modulos: editModules.map((m) => ({
          tituloModulo: m.tituloModulo,
          tipo: m.tipo,
          contenido: m.tipo === 'practica_presencial' ? PRACTICA_PRESENCIAL_MESSAGE : m.contenido,
        })),
      });

      if (!response.success) {
        setSaveError(response.error || 'No se pudo guardar');
        return;
      }

      setBaselineSnapshot(currentSnapshot);

      const courseName = editTitle?.trim() ? editTitle.trim() : 'Sin título';
      toast.success(`¡Curso ${courseName} guardado correctamente!`);

      setIsRedirectingAfterSave(true);

      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }

      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/admin/gestion-capacitaciones');
      }, 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseId || isDeleting || isRedirectingAfterSave) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await courseService.deleteCourse(courseId);
      if (!response.success) {
        setDeleteError(response.error || 'No se pudo eliminar el curso');
        return;
      }

      const courseName = editTitle?.trim() ? editTitle.trim() : 'Sin título';
      toast.success(`Curso ${courseName} eliminado correctamente.`);

      setIsRedirectingAfterSave(true);

      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }

      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/admin/gestion-capacitaciones');
      }, 2000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackToCourses = () => {
    if (isSaving || isDeleting || isRedirectingAfterSave) return;

    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'Tienes cambios sin guardar. ¿Estás seguro que deseas salir?\n\nSi sales ahora, perderás los cambios.'
      );
      if (!ok) return;
    }

    navigate('/admin/gestion-capacitaciones');
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving || isDeleting || isRedirectingAfterSave) return;
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      // Chrome requiere asignar returnValue para mostrar el diálogo
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isDeleting, isRedirectingAfterSave, isSaving]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster richColors />
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-600">Admin · Editor de Curso</div>
              <h1 className="text-xl font-bold text-[#1a2840] truncate">
                {editTitle?.trim() ? editTitle : 'Editar curso'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleBackToCourses}
                disabled={isSaving || isDeleting || isRedirectingAfterSave}
              >
                Volver a cursos
              </Button>

              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isSaving || isDeleting || isRedirectingAfterSave || isLoading || !!loadError}
                  >
                    Eliminar curso
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar curso</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Estás seguro que deseas eliminar este curso? Se perderán todos los datos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting || isRedirectingAfterSave}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setIsDeleteDialogOpen(false);
                          void handleDeleteCourse();
                        }}
                        disabled={isDeleting || isRedirectingAfterSave}
                      >
                        {isDeleting ? 'Eliminando…' : 'Sí, eliminar'}
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                onClick={handleSave}
                disabled={isSaving || isDeleting || isRedirectingAfterSave || isLoading || !!loadError}
              >
                {isSaving ? 'Guardando…' : isRedirectingAfterSave ? 'Redirigiendo…' : 'Guardar'}
              </Button>
            </div>
          </div>

          {saveError ? (
            <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
              {saveError}
            </div>
          ) : null}

          {deleteError ? (
            <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
              {deleteError}
            </div>
          ) : null}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full">
          <div className="h-full flex">
            <aside className="w-[320px] shrink-0 border-r bg-white overflow-y-auto">
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Curso</div>
                  <div className="text-xs text-gray-600">Datos generales</div>
                </div>

                {isLoading ? (
                  <div className="text-sm text-gray-600">Cargando…</div>
                ) : loadError ? (
                  <div className="text-sm text-rose-700">{loadError}</div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Título</div>
                      <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Descripción</div>
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="min-h-[90px]"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-700 mb-1">Imagen (URL o ruta)</div>
                      <Input value={editImage} onChange={(e) => setEditImage(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Asignación masiva</div>
                    <div className="text-xs text-gray-600">Inscribe usuarios activos por sede o por cargo</div>
                  </div>

                  <div className="rounded-md border p-3 bg-slate-50 space-y-3">
                    <div className="text-xs text-gray-600">
                      Inscritos actuales: <span className="font-semibold text-gray-800">{assignedUserIds.length}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-700">Por sede</div>
                      <Select value={massAssignSede} onValueChange={setMassAssignSede}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona sede" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Selecciona sede</SelectItem>
                          {availableSedes.map((sede) => (
                            <SelectItem key={sede} value={sede}>
                              {sede}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => void handleMassAssign('sede')}
                        disabled={isMassAssigning || isLoadingUsers || availableSedes.length === 0}
                      >
                        {isMassAssigning ? 'Asignando...' : 'Inscribir usuarios de la sede'}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-700">Por cargo</div>
                      <Select value={massAssignCargo} onValueChange={setMassAssignCargo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Selecciona cargo</SelectItem>
                          {availableCargos.map((cargo) => (
                            <SelectItem key={cargo} value={cargo}>
                              {cargo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => void handleMassAssign('cargo')}
                        disabled={isMassAssigning || isLoadingUsers || availableCargos.length === 0}
                      >
                        {isMassAssigning ? 'Asignando...' : 'Inscribir usuarios del cargo'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Módulos</div>
                      <div className="text-xs text-gray-600">Navega y reordena</div>
                    </div>
                    <div className="text-xs text-gray-600">{editModules.length}</div>
                  </div>

                  {editModules.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-600 rounded-md border p-3">
                      Este curso aún no tiene módulos.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {editModules.map((m, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                          <div
                            key={`${m.tituloModulo}-${idx}`}
                            className={`rounded-md border p-2 ${
                              isSelected ? 'bg-purple-50 border-purple-200' : 'bg-white'
                            }`}
                          >
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => setSelectedIndex(idx)}
                              disabled={isSaving}
                            >
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {idx + 1}. {m.tituloModulo || 'Módulo'}
                              </div>
                              <div className="text-xs text-gray-600">{m.tipo}</div>
                            </button>

                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => moveModule(idx, idx - 1)}
                                disabled={isSaving || idx === 0}
                              >
                                Subir
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => moveModule(idx, idx + 1)}
                                disabled={isSaving || idx === editModules.length - 1}
                              >
                                Bajar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeModule(idx)}
                                disabled={isSaving}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="text-sm font-semibold text-gray-900">Añadir módulo</div>

                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Título</div>
                    <Input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Tipo</div>
                    <Select
                      value={newModuleType}
                      onValueChange={(v) => {
                        const nextTipo = v as ModuloTipo;
                        setNewModuleType(nextTipo);
                        setNewModuleContent('');
                        setNewModuleFileName('');
                        setNewModuleQuiz([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video (Link)</SelectItem>
                        <SelectItem value="lectura">Documento (Lectura)</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="practica_presencial">Práctica Presencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-gray-700 mb-1">Contenido</div>

                    {newModuleType === 'video' ? (
                      <Input
                        value={newModuleContent}
                        onChange={(e) => setNewModuleContent(e.target.value)}
                        placeholder="Pega aquí el link/embed del video"
                        disabled={isSaving}
                      />
                    ) : newModuleType === 'practica_presencial' ? (
                      <Textarea value={PRACTICA_PRESENCIAL_MESSAGE} disabled className="min-h-[90px]" />
                    ) : newModuleType === 'lectura' ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-600">
                          El archivo es simulado: solo se guarda el nombre (no se sube el documento).
                        </div>

                        <Input
                          type="file"
                          disabled={isSaving}
                          onChange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            setNewModuleFileName(file?.name || '');
                          }}
                        />

                        {newModuleFileName ? (
                          <div className="text-xs text-gray-700">
                            Archivo seleccionado: <span className="font-medium">{newModuleFileName}</span>
                          </div>
                        ) : null}

                        <Textarea
                          value={newModuleContent}
                          onChange={(e) => setNewModuleContent(e.target.value)}
                          className="min-h-[90px]"
                          placeholder="Instrucciones de lectura"
                          disabled={isSaving}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {newModuleQuiz.length === 0 ? (
                          <div className="text-sm text-gray-600 rounded-md border p-3">Aún no hay preguntas.</div>
                        ) : (
                          <div className="space-y-3">
                            {newModuleQuiz.map((q, qIndex) => (
                              <div key={qIndex} className="rounded-md border p-3 space-y-3 bg-white">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-semibold text-gray-900">Pregunta {qIndex + 1}</div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setNewModuleQuiz((prev) => prev.filter((_, i) => i !== qIndex))}
                                    disabled={isSaving}
                                  >
                                    Quitar
                                  </Button>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-xs font-medium text-gray-700 mb-1">Tipo</div>
                                    <Select
                                      value={q.tipo}
                                      onValueChange={(v) => {
                                        const nextTipo = v as QuizTipoPregunta;
                                        setNewModuleQuiz((prev) =>
                                          prev.map((qq, i) => {
                                            if (i !== qIndex) return qq;
                                            const base: QuizPregunta = { ...qq, tipo: nextTipo };
                                            if (nextTipo === 'seleccion_multiple') {
                                              return {
                                                ...base,
                                                opciones:
                                                  Array.isArray(base.opciones) && base.opciones.length > 0
                                                    ? base.opciones
                                                    : [
                                                        { texto: 'Opción 1', correcta: true },
                                                        { texto: 'Opción 2', correcta: false },
                                                      ],
                                              };
                                            }
                                            return { ...base, opciones: undefined };
                                          })
                                        );
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="seleccion_multiple">Selección múltiple</SelectItem>
                                        <SelectItem value="respuesta_escrita">Respuesta escrita</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div>
                                  <div className="text-xs font-medium text-gray-700 mb-1">Enunciado</div>
                                  <Textarea
                                    value={q.pregunta || ''}
                                    onChange={(e) =>
                                      setNewModuleQuiz((prev) =>
                                        prev.map((qq, i) => (i === qIndex ? { ...qq, pregunta: e.target.value } : qq))
                                      )
                                    }
                                    className="min-h-[70px]"
                                    disabled={isSaving}
                                  />
                                </div>

                                {q.tipo === 'seleccion_multiple' ? (
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium text-gray-700">Opciones</div>
                                    {(q.opciones || []).map((opt, optIndex) => (
                                      <div key={optIndex} className="flex items-center gap-2">
                                        <Checkbox
                                          checked={!!opt.correcta}
                                          onCheckedChange={() => {
                                            setNewModuleQuiz((prev) =>
                                              prev.map((qq, i) => {
                                                if (i !== qIndex) return qq;
                                                const opciones = (qq.opciones || []).map((oo, oi) => ({
                                                  ...oo,
                                                  correcta: oi === optIndex,
                                                }));
                                                return { ...qq, opciones };
                                              })
                                            );
                                          }}
                                          disabled={isSaving}
                                        />
                                        <Input
                                          value={opt.texto || ''}
                                          onChange={(e) => {
                                            setNewModuleQuiz((prev) =>
                                              prev.map((qq, i) => {
                                                if (i !== qIndex) return qq;
                                                const opciones = (qq.opciones || []).map((oo, oi) =>
                                                  oi === optIndex ? { ...oo, texto: e.target.value } : oo
                                                );
                                                return { ...qq, opciones };
                                              })
                                            );
                                          }}
                                          placeholder={`Opción ${optIndex + 1}`}
                                          disabled={isSaving}
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setNewModuleQuiz((prev) =>
                                              prev.map((qq, i) => {
                                                if (i !== qIndex) return qq;
                                                const before = qq.opciones || [];
                                                const opciones = before.filter((_, oi) => oi !== optIndex);
                                                if (opciones.length > 0 && !opciones.some((o) => o.correcta)) {
                                                  opciones[0] = { ...opciones[0], correcta: true };
                                                }
                                                return { ...qq, opciones };
                                              })
                                            );
                                          }}
                                          disabled={isSaving}
                                        >
                                          −
                                        </Button>
                                      </div>
                                    ))}

                                    <div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setNewModuleQuiz((prev) =>
                                            prev.map((qq, i) => {
                                              if (i !== qIndex) return qq;
                                              const opciones = [...(qq.opciones || [])];
                                              opciones.push({
                                                texto: `Opción ${opciones.length + 1}`,
                                                correcta: opciones.length === 0,
                                              });
                                              return { ...qq, opciones };
                                            })
                                          );
                                        }}
                                        disabled={isSaving}
                                      >
                                        Añadir opción
                                      </Button>
                                    </div>

                                    <div className="text-xs text-gray-600">
                                      Marca con el check la opción correcta (solo una).
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs font-medium text-gray-700 mb-1">Respuesta modelo (opcional)</div>
                                    <Textarea
                                      value={q.respuestaModelo || ''}
                                      onChange={(e) =>
                                        setNewModuleQuiz((prev) =>
                                          prev.map((qq, i) =>
                                            i === qIndex ? { ...qq, respuestaModelo: e.target.value } : qq
                                          )
                                        )
                                      }
                                      className="min-h-[70px]"
                                      disabled={isSaving}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <Button
                            type="button"
                            onClick={() => {
                              setNewModuleQuiz((prev) => [
                                ...prev,
                                {
                                  tipo: 'seleccion_multiple',
                                  pregunta: '',
                                  opciones: [
                                    { texto: 'Opción 1', correcta: true },
                                    { texto: 'Opción 2', correcta: false },
                                  ],
                                },
                              ]);
                            }}
                            disabled={isSaving}
                          >
                            Añadir pregunta
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={addModule} disabled={isSaving || !newModuleTitle.trim()}>
                      Añadir
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            <section className="flex-1 overflow-y-auto">
              <div className="p-6">
                {isLoading ? (
                  <Card className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-gray-200 rounded w-1/2" />
                      <div className="h-4 bg-gray-100 rounded w-full" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-32 bg-gray-200 rounded" />
                    </CardContent>
                  </Card>
                ) : loadError ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Editor</CardTitle>
                      <CardDescription>No se pudo cargar el curso</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-700">{loadError}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleBackToCourses}>
                          Volver
                        </Button>
                        <Button onClick={() => window.location.reload()}>Reintentar</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : !selectedModule ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Módulos</CardTitle>
                      <CardDescription>Agrega un módulo para comenzar.</CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Editando módulo</div>
                      <div className="text-xs text-gray-600">#{selectedIndex + 1}</div>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{selectedModule.tituloModulo}</CardTitle>
                        <CardDescription>
                          Tipo: <span className="font-medium">{selectedModule.tipo}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-1">Título del módulo</div>
                          <Input
                            value={selectedModule.tituloModulo}
                            onChange={(e) => updateModule(selectedIndex, { tituloModulo: e.target.value })}
                            disabled={isSaving}
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1">Tipo</div>
                            <Select
                              value={selectedModule.tipo}
                              onValueChange={(v) => {
                                const nextTipo = v as ModuloTipo;
                                updateModule(selectedIndex, {
                                  tipo: nextTipo,
                                  contenido: coerceContenidoForTipo(nextTipo, selectedModule.contenido),
                                });
                              }}
                              disabled={isSaving}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="video">Video (Link)</SelectItem>
                                <SelectItem value="lectura">Documento (Lectura)</SelectItem>
                                <SelectItem value="quiz">Quiz</SelectItem>
                                <SelectItem value="practica_presencial">Práctica Presencial</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-gray-700 mb-1">Contenido</div>

                          {selectedModule.tipo === 'video' ? (
                            <Input
                              value={typeof selectedModule.contenido === 'string' ? selectedModule.contenido : ''}
                              onChange={(e) => updateModule(selectedIndex, { contenido: e.target.value })}
                              placeholder="Pega aquí el link/embed del video"
                              disabled={isSaving}
                            />
                          ) : selectedModule.tipo === 'practica_presencial' ? (
                            <Textarea value={PRACTICA_PRESENCIAL_MESSAGE} disabled className="min-h-[90px]" />
                          ) : selectedModule.tipo === 'lectura' ? (
                            <div className="space-y-2">
                              <div className="text-xs text-gray-600">
                                El archivo es simulado: solo se guarda el nombre (no se sube el documento).
                              </div>

                              <Input
                                type="file"
                                disabled={isSaving}
                                onChange={(e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  const current: LecturaContenido = isPlainObject(selectedModule.contenido)
                                    ? (selectedModule.contenido as LecturaContenido)
                                    : typeof selectedModule.contenido === 'string'
                                      ? { instrucciones: selectedModule.contenido }
                                      : { instrucciones: '' };

                                  updateModule(selectedIndex, {
                                    contenido: {
                                      ...current,
                                      archivoNombre: file?.name || undefined,
                                    } satisfies LecturaContenido,
                                  });
                                }}
                              />

                              {(() => {
                                const current: LecturaContenido = isPlainObject(selectedModule.contenido)
                                  ? (selectedModule.contenido as LecturaContenido)
                                  : typeof selectedModule.contenido === 'string'
                                    ? { instrucciones: selectedModule.contenido }
                                    : { instrucciones: '' };

                                return current.archivoNombre ? (
                                  <div className="text-xs text-gray-700">
                                    Archivo seleccionado: <span className="font-medium">{current.archivoNombre}</span>
                                  </div>
                                ) : null;
                              })()}

                              <Textarea
                                value={(() => {
                                  const current: LecturaContenido = isPlainObject(selectedModule.contenido)
                                    ? (selectedModule.contenido as LecturaContenido)
                                    : typeof selectedModule.contenido === 'string'
                                      ? { instrucciones: selectedModule.contenido }
                                      : { instrucciones: '' };
                                  return current.instrucciones || '';
                                })()}
                                onChange={(e) => {
                                  const current: LecturaContenido = isPlainObject(selectedModule.contenido)
                                    ? (selectedModule.contenido as LecturaContenido)
                                    : typeof selectedModule.contenido === 'string'
                                      ? { instrucciones: selectedModule.contenido }
                                      : { instrucciones: '' };

                                  updateModule(selectedIndex, {
                                    contenido: {
                                      ...current,
                                      instrucciones: e.target.value,
                                    } satisfies LecturaContenido,
                                  });
                                }}
                                className="min-h-[120px]"
                                placeholder="Instrucciones de lectura"
                                disabled={isSaving}
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {(() => {
                                const questions: QuizPregunta[] = Array.isArray(selectedModule.contenido)
                                  ? (selectedModule.contenido as QuizPregunta[])
                                  : [];

                                return (
                                  <div className="space-y-3">
                                    {questions.length === 0 ? (
                                      <div className="text-sm text-gray-600 rounded-md border p-3">
                                        Aún no hay preguntas.
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {questions.map((q, qIndex) => (
                                          <div key={qIndex} className="rounded-md border p-3 space-y-3 bg-white">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="text-sm font-semibold text-gray-900">
                                                Pregunta {qIndex + 1}
                                              </div>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  const next = questions.filter((_, i) => i !== qIndex);
                                                  updateModule(selectedIndex, { contenido: next });
                                                }}
                                                disabled={isSaving}
                                              >
                                                Quitar
                                              </Button>
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-3">
                                              <div>
                                                <div className="text-xs font-medium text-gray-700 mb-1">Tipo</div>
                                                <Select
                                                  value={q.tipo}
                                                  onValueChange={(v) => {
                                                    const nextTipo = v as QuizTipoPregunta;
                                                    const next = questions.map((qq, i) => {
                                                      if (i !== qIndex) return qq;
                                                      const base: QuizPregunta = { ...qq, tipo: nextTipo };

                                                      if (nextTipo === 'seleccion_multiple') {
                                                        return {
                                                          ...base,
                                                          opciones:
                                                            Array.isArray(base.opciones) && base.opciones.length > 0
                                                              ? base.opciones
                                                              : [
                                                                  { texto: 'Opción 1', correcta: true },
                                                                  { texto: 'Opción 2', correcta: false },
                                                                ],
                                                        };
                                                      }

                                                      return { ...base, opciones: undefined };
                                                    });
                                                    updateModule(selectedIndex, { contenido: next });
                                                  }}
                                                  disabled={isSaving}
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="seleccion_multiple">Selección múltiple</SelectItem>
                                                    <SelectItem value="respuesta_escrita">Respuesta escrita</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>

                                            <div>
                                              <div className="text-xs font-medium text-gray-700 mb-1">Enunciado</div>
                                              <Textarea
                                                value={q.pregunta || ''}
                                                onChange={(e) => {
                                                  const next = questions.map((qq, i) =>
                                                    i === qIndex ? { ...qq, pregunta: e.target.value } : qq
                                                  );
                                                  updateModule(selectedIndex, { contenido: next });
                                                }}
                                                className="min-h-[70px]"
                                                disabled={isSaving}
                                              />
                                            </div>

                                            {q.tipo === 'seleccion_multiple' ? (
                                              <div className="space-y-2">
                                                <div className="text-xs font-medium text-gray-700">Opciones</div>
                                                {(q.opciones || []).map((opt, optIndex) => (
                                                  <div key={optIndex} className="flex items-center gap-2">
                                                    <Checkbox
                                                      checked={!!opt.correcta}
                                                      onCheckedChange={() => {
                                                        const next = questions.map((qq, i) => {
                                                          if (i !== qIndex) return qq;
                                                          const opciones = (qq.opciones || []).map((oo, oi) => ({
                                                            ...oo,
                                                            correcta: oi === optIndex,
                                                          }));
                                                          return { ...qq, opciones };
                                                        });
                                                        updateModule(selectedIndex, { contenido: next });
                                                      }}
                                                      disabled={isSaving}
                                                    />
                                                    <Input
                                                      value={opt.texto || ''}
                                                      onChange={(e) => {
                                                        const next = questions.map((qq, i) => {
                                                          if (i !== qIndex) return qq;
                                                          const opciones = (qq.opciones || []).map((oo, oi) =>
                                                            oi === optIndex ? { ...oo, texto: e.target.value } : oo
                                                          );
                                                          return { ...qq, opciones };
                                                        });
                                                        updateModule(selectedIndex, { contenido: next });
                                                      }}
                                                      placeholder={`Opción ${optIndex + 1}`}
                                                      disabled={isSaving}
                                                    />
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => {
                                                        const next = questions.map((qq, i) => {
                                                          if (i !== qIndex) return qq;
                                                          const before = qq.opciones || [];
                                                          const opciones = before.filter((_, oi) => oi !== optIndex);
                                                          if (opciones.length > 0 && !opciones.some((o) => o.correcta)) {
                                                            opciones[0] = { ...opciones[0], correcta: true };
                                                          }
                                                          return { ...qq, opciones };
                                                        });
                                                        updateModule(selectedIndex, { contenido: next });
                                                      }}
                                                      disabled={isSaving}
                                                    >
                                                      −
                                                    </Button>
                                                  </div>
                                                ))}

                                                <div>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                      const next = questions.map((qq, i) => {
                                                        if (i !== qIndex) return qq;
                                                        const opciones = [...(qq.opciones || [])];
                                                        opciones.push({
                                                          texto: `Opción ${opciones.length + 1}`,
                                                          correcta: opciones.length === 0,
                                                        });
                                                        return { ...qq, opciones };
                                                      });
                                                      updateModule(selectedIndex, { contenido: next });
                                                    }}
                                                    disabled={isSaving}
                                                  >
                                                    Añadir opción
                                                  </Button>
                                                </div>

                                                <div className="text-xs text-gray-600">
                                                  Marca con el check la opción correcta (solo una).
                                                </div>
                                              </div>
                                            ) : (
                                              <div>
                                                <div className="text-xs font-medium text-gray-700 mb-1">Respuesta modelo (opcional)</div>
                                                <Textarea
                                                  value={q.respuestaModelo || ''}
                                                  onChange={(e) => {
                                                    const next = questions.map((qq, i) =>
                                                      i === qIndex ? { ...qq, respuestaModelo: e.target.value } : qq
                                                    );
                                                    updateModule(selectedIndex, { contenido: next });
                                                  }}
                                                  className="min-h-[70px]"
                                                  disabled={isSaving}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div>
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          const next = [...questions];
                                          next.push({
                                            tipo: 'seleccion_multiple',
                                            pregunta: '',
                                            opciones: [
                                              { texto: 'Opción 1', correcta: true },
                                              { texto: 'Opción 2', correcta: false },
                                            ],
                                          });
                                          updateModule(selectedIndex, { contenido: next });
                                        }}
                                        disabled={isSaving}
                                      >
                                        Añadir pregunta
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
