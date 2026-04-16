import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { GraduationCap, LogOut, Users, ChevronLeft } from 'lucide-react';
import { courseService, userService } from '../services/apiService';
import type { Course, CourseDetail, CursoModulo, User } from '../types';
import { BACKEND_URL } from '../config/api.config';

const LOGO_SRC = `${BACKEND_URL}/static/alumco-logo.png`;

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
    // si venía de string/obj, iniciamos quiz vacío
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
    if (Array.isArray(prev)) return { instrucciones: '' };
    return { instrucciones: '' };
  }

  // video
  if (typeof prev === 'string') return prev;
  if (isPlainObject(prev) && typeof prev.instrucciones === 'string') return prev.instrucciones;
  return '';
}

export default function AdminGestionCapacitaciones() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [logoOk, setLogoOk] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoadingCourseDetail, setIsLoadingCourseDetail] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editModules, setEditModules] = useState<EditModulo[]>([]);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleType, setNewModuleType] = useState<ModuloTipo>('lectura');
  const [newModuleContent, setNewModuleContent] = useState('');
  const [newModuleFileName, setNewModuleFileName] = useState('');
  const [newModuleQuiz, setNewModuleQuiz] = useState<QuizPregunta[]>([]);
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [createCourseError, setCreateCourseError] = useState<string | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) {
      if (u?.id) map.set(u.id, u);
    }
    return map;
  }, [users]);

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const response = await courseService.getCourses({ all: true });
        setCourses(response.success && response.data ? response.data : []);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    loadCourses();
  }, []);

  const ensureUsersLoaded = async () => {
    if (users.length > 0) return;

    setIsLoadingUsers(true);
    try {
      const response = await userService.getUsers();
      setUsers(response.success && response.data ? response.data : []);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCreateCourse = async () => {
    if (isCreatingCourse) return;

    setIsCreatingCourse(true);
    setCreateCourseError(null);

    try {
      const response = await courseService.createCourse({
        titulo: 'Nueva capacitación',
        descripcion: '',
        imagen: '',
      });

      if (response.success && response.data?.id) {
        navigate(`/admin/editar-curso/${response.data.id}`);
        return;
      }

      setCreateCourseError(response.error || 'No se pudo crear el curso.');
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const openAssignDialog = async (course: Course) => {
    setSelectedCourse(course);
    setSelectedUserIds(Array.isArray(course.alumnosInscritos) ? course.alumnosInscritos : []);
    setIsDialogOpen(true);
    await ensureUsersLoaded();
  };

  const closeAssignDialog = () => {
    if (isSaving) return;
    setIsDialogOpen(false);
    setSelectedCourse(null);
    setSelectedUserIds([]);
  };

  const openEditDialog = async (course: Course) => {
    if (!course?.id) return;

    setIsEditDialogOpen(true);
    setIsLoadingCourseDetail(true);

    try {
      const response = await courseService.getCourseDetail(String(course.id));
      if (!response.success || !response.data) return;

      const detail = response.data as CourseDetail;
      const modulos = (detail.modulos || []) as CursoModulo[];

      setEditCourseId(String(course.id));
      setEditTitle(detail.title || course.title || '');
      setEditDescription(detail.description || course.description || '');
      setEditImage(detail.image || course.image || '');
      setEditModules(
        modulos.map((m) => {
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
        })
      );

      setNewModuleTitle('');
      setNewModuleType('lectura');
      setNewModuleContent('');
      setNewModuleFileName('');
      setNewModuleQuiz([]);
    } finally {
      setIsLoadingCourseDetail(false);
    }
  };

  const closeEditDialog = () => {
    if (isSavingCourse) return;

    setIsEditDialogOpen(false);
    setEditCourseId(null);
    setEditTitle('');
    setEditDescription('');
    setEditImage('');
    setEditModules([]);
    setNewModuleTitle('');
    setNewModuleType('lectura');
    setNewModuleContent('');
    setNewModuleFileName('');
    setNewModuleQuiz([]);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedCourse?.id) return;

    setIsSaving(true);
    try {
      const response = await courseService.assignStudentsToCourse(selectedCourse.id, selectedUserIds);
      if (response.success && response.data) {
        setCourses((prev) => prev.map((c) => (c.id === selectedCourse.id ? response.data! : c)));
        setIsDialogOpen(false);
        setSelectedCourse(null);
        setSelectedUserIds([]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateModule = (index: number, patch: Partial<EditModulo>) => {
    setEditModules((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeModule = (index: number) => {
    setEditModules((prev) => prev.filter((_, i) => i !== index));
  };

  const moveModule = (from: number, to: number) => {
    setEditModules((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  };

  const moveModuleUp = (index: number) => moveModule(index, index - 1);
  const moveModuleDown = (index: number) => moveModule(index, index + 1);

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

      // quiz
      return newModuleQuiz;
    })();

    setEditModules((prev) => [...prev, { tituloModulo, tipo, contenido }]);
    setNewModuleTitle('');
    setNewModuleType('lectura');
    setNewModuleContent('');
    setNewModuleFileName('');
    setNewModuleQuiz([]);
  };

  const handleSaveCourse = async () => {
    if (!editCourseId) return;

    setIsSavingCourse(true);
    try {
      const response = await courseService.updateCourse(editCourseId, {
        titulo: editTitle,
        descripcion: editDescription,
        imagen: editImage,
        modulos: editModules.map((m) => ({
          tituloModulo: m.tituloModulo,
          tipo: m.tipo,
          contenido: m.tipo === 'practica_presencial' ? PRACTICA_PRESENCIAL_MESSAGE : m.contenido,
        })),
      });

      if (response.success && response.data) {
        setCourses((prev) => prev.map((c) => (c.id === editCourseId ? response.data! : c)));
        closeEditDialog();
      }
    } finally {
      setIsSavingCourse(false);
    }
  };

  const enrolledCount = (course: Course) =>
    Array.isArray(course.alumnosInscritos) ? course.alumnosInscritos.length : 0;

  const selectedUsersPreview = useMemo(() => {
    if (selectedUserIds.length === 0) return 'Nadie';

    const names = selectedUserIds
      .map((id) => usersById.get(id))
      .filter(Boolean)
      .map((u) => u!.nombreCompleto || u!.nombre || u!.email || u!.id);

    return names.length > 0 ? names.join(', ') : `${selectedUserIds.length} usuarios`;
  }, [selectedUserIds, usersById]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {logoOk ? (
                <img
                  src={LOGO_SRC}
                  alt="Logo de Alumco"
                  className="h-10 w-auto"
                  onError={() => setLogoOk(false)}
                />
              ) : (
                <div className="text-xl sm:text-2xl font-semibold text-[#1a2840] leading-tight">
                  ALUMCO
                </div>
              )}
              <div className="text-sm text-gray-600 leading-tight">
                Admin · Gestión de Capacitaciones
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => navigate('/admin')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver</span>
              </Button>
              <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <GraduationCap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#1a2840]">Gestión de Capacitaciones</h2>
                <p className="text-sm text-gray-600">
                  Asigna usuarios a cursos (se guarda en el backend)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCreateCourse} disabled={isCreatingCourse}>
                {isCreatingCourse ? 'Creando…' : 'Crear Nueva Capacitación'}
              </Button>
            </div>
          </div>

          {createCourseError ? (
            <div className="mt-2 text-sm text-red-600">{createCourseError}</div>
          ) : null}
        </div>

        {isLoadingCourses ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-40 bg-gray-200" />
                <CardHeader>
                  <div className="h-4 bg-gray-200 mb-2" />
                  <div className="h-3 bg-gray-100" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay cursos</CardTitle>
              <CardDescription>Crea o carga cursos para poder asignar usuarios.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="hover:shadow-lg transition-shadow overflow-hidden flex flex-col min-h-[360px]"
              >
                <div
                  className="h-40 bg-gradient-to-br from-purple-400 to-purple-600"
                  style={
                    course.image
                      ? {
                          backgroundImage: `url("${course.image}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : undefined
                  }
                />

                <CardHeader className="flex-1">
                  <CardTitle className="text-lg">{course.title || 'Sin título'}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {course.description || 'Sin descripción'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-600" />
                      {(() => {
                        const count = enrolledCount(course);
                        const badgeClass =
                          count > 0
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200';

                        return (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
                          >
                            {count} inscritos
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => openAssignDialog(course)}
                    >
                      Asignar usuarios
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        if (!course?.id) return;
                        navigate(`/admin/editar-curso/${course.id}`);
                      }}
                    >
                      Editar Contenido
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => (open ? setIsDialogOpen(true) : closeAssignDialog())}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Asignar usuarios</DialogTitle>
              <DialogDescription>
                {selectedCourse?.title ? (
                  <span>
                    Curso: <strong>{selectedCourse.title}</strong>
                  </span>
                ) : (
                  'Selecciona los usuarios que quedarán inscritos en este curso.'
                )}
              </DialogDescription>
            </DialogHeader>

            {isLoadingUsers ? (
              <div className="text-sm text-gray-600">Cargando usuarios…</div>
            ) : users.length === 0 ? (
              <div className="text-sm text-gray-600">No hay usuarios disponibles.</div>
            ) : (
              <div className="max-h-[320px] overflow-auto space-y-3 pr-2">
                {users.map((u) => {
                  if (!u.id) return null;

                  return (
                    <label
                      key={u.id}
                      className="flex items-start gap-3 p-3 rounded-md border bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(u.id)}
                        onCheckedChange={() => toggleUser(u.id)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {u.nombreCompleto || u.nombre || u.email || u.id}
                        </div>
                        <div className="text-xs text-gray-600 truncate">{u.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-gray-600">
              Seleccionados: <span className="font-medium">{selectedUsersPreview}</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeAssignDialog} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAssignments} disabled={isSaving || !selectedCourse?.id}>
                {isSaving ? 'Guardando…' : 'Guardar asignación'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => (open ? setIsEditDialogOpen(true) : closeEditDialog())}
        >
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Editar curso</DialogTitle>
              <DialogDescription>
                Cambia título, descripción, imagen y módulos. Al guardar, se persiste en el backend.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto scroll-smooth pr-1">
              {isLoadingCourseDetail ? (
                <div className="text-sm text-gray-600">Cargando curso…</div>
              ) : !editCourseId ? (
                <div className="text-sm text-gray-600">Selecciona un curso para editar.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3">
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

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Módulos</div>
                        <div className="text-xs text-gray-600">Edita, agrega o elimina módulos</div>
                      </div>
                    </div>

                    {editModules.length === 0 ? (
                      <div className="text-sm text-gray-600 rounded-md border p-3">Este curso aún no tiene módulos.</div>
                    ) : (
                      <div className="max-h-[320px] overflow-auto space-y-3 pr-2">
                        {editModules.map((m, index) => (
                          <div key={`${m.tituloModulo}-${index}`} className="rounded-md border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-xs font-medium text-gray-700 mb-1">Título del módulo</div>
                                <Input
                                  value={m.tituloModulo}
                                  onChange={(e) => updateModule(index, { tituloModulo: e.target.value })}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => moveModuleUp(index)}
                                  disabled={isSavingCourse || index === 0}
                                >
                                  Subir
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => moveModuleDown(index)}
                                  disabled={isSavingCourse || index === editModules.length - 1}
                                >
                                  Bajar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeModule(index)}
                                  disabled={isSavingCourse}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <div className="text-xs font-medium text-gray-700 mb-1">Tipo</div>
                                <Select
                                  value={m.tipo}
                                  onValueChange={(v) => {
                                    const nextTipo = v as ModuloTipo;
                                    updateModule(index, {
                                      tipo: nextTipo,
                                      contenido: coerceContenidoForTipo(nextTipo, m.contenido),
                                    });
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
                            </div>

                            <div>
                              <div className="text-xs font-medium text-gray-700 mb-1">Contenido</div>

                              {m.tipo === 'video' ? (
                                <Input
                                  value={typeof m.contenido === 'string' ? m.contenido : ''}
                                  onChange={(e) => updateModule(index, { contenido: e.target.value })}
                                  placeholder="Pega aquí el link/embed del video"
                                  disabled={isSavingCourse}
                                />
                              ) : m.tipo === 'practica_presencial' ? (
                                <Textarea value={PRACTICA_PRESENCIAL_MESSAGE} disabled className="min-h-[90px]" />
                              ) : m.tipo === 'lectura' ? (
                                <div className="space-y-2">
                                  <div className="text-xs text-gray-600">
                                    El archivo es simulado: solo se guarda el nombre (no se sube el documento).
                                  </div>

                                  <Input
                                    type="file"
                                    disabled={isSavingCourse}
                                    onChange={(e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      const current: LecturaContenido = isPlainObject(m.contenido)
                                        ? (m.contenido as LecturaContenido)
                                        : typeof m.contenido === 'string'
                                          ? { instrucciones: m.contenido }
                                          : { instrucciones: '' };

                                      updateModule(index, {
                                        contenido: {
                                          ...current,
                                          archivoNombre: file?.name || undefined,
                                        } satisfies LecturaContenido,
                                      });
                                    }}
                                  />

                                  {(() => {
                                    const current: LecturaContenido = isPlainObject(m.contenido)
                                      ? (m.contenido as LecturaContenido)
                                      : typeof m.contenido === 'string'
                                        ? { instrucciones: m.contenido }
                                        : { instrucciones: '' };

                                    return current.archivoNombre ? (
                                      <div className="text-xs text-gray-700">
                                        Archivo seleccionado: <span className="font-medium">{current.archivoNombre}</span>
                                      </div>
                                    ) : null;
                                  })()}

                                  <Textarea
                                    value={(() => {
                                      const current: LecturaContenido = isPlainObject(m.contenido)
                                        ? (m.contenido as LecturaContenido)
                                        : typeof m.contenido === 'string'
                                          ? { instrucciones: m.contenido }
                                          : { instrucciones: '' };
                                      return current.instrucciones || '';
                                    })()}
                                    onChange={(e) => {
                                      const current: LecturaContenido = isPlainObject(m.contenido)
                                        ? (m.contenido as LecturaContenido)
                                        : typeof m.contenido === 'string'
                                          ? { instrucciones: m.contenido }
                                          : { instrucciones: '' };

                                      updateModule(index, {
                                        contenido: {
                                          ...current,
                                          instrucciones: e.target.value,
                                        } satisfies LecturaContenido,
                                      });
                                    }}
                                    className="min-h-[90px]"
                                    placeholder="Instrucciones de lectura (qué debe revisar, puntos clave, etc.)"
                                    disabled={isSavingCourse}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {(() => {
                                    const questions: QuizPregunta[] = Array.isArray(m.contenido)
                                      ? (m.contenido as QuizPregunta[])
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
                                                      updateModule(index, { contenido: next });
                                                    }}
                                                    disabled={isSavingCourse}
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
                                                          const base: QuizPregunta = {
                                                            ...qq,
                                                            tipo: nextTipo,
                                                          };

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

                                                          return {
                                                            ...base,
                                                            opciones: undefined,
                                                          };
                                                        });
                                                        updateModule(index, { contenido: next });
                                                      }}
                                                    >
                                                      <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="seleccion_multiple">
                                                          Selección múltiple
                                                        </SelectItem>
                                                        <SelectItem value="respuesta_escrita">
                                                          Respuesta escrita
                                                        </SelectItem>
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
                                                      updateModule(index, { contenido: next });
                                                    }}
                                                    className="min-h-[70px]"
                                                    disabled={isSavingCourse}
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
                                                            updateModule(index, { contenido: next });
                                                          }}
                                                          disabled={isSavingCourse}
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
                                                            updateModule(index, { contenido: next });
                                                          }}
                                                          placeholder={`Opción ${optIndex + 1}`}
                                                          disabled={isSavingCourse}
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
                                                            updateModule(index, { contenido: next });
                                                          }}
                                                          disabled={isSavingCourse}
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
                                                          updateModule(index, { contenido: next });
                                                        }}
                                                        disabled={isSavingCourse}
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
                                                    <div className="text-xs font-medium text-gray-700 mb-1">
                                                      Respuesta modelo (opcional)
                                                    </div>
                                                    <Textarea
                                                      value={q.respuestaModelo || ''}
                                                      onChange={(e) => {
                                                        const next = questions.map((qq, i) =>
                                                          i === qIndex
                                                            ? { ...qq, respuestaModelo: e.target.value }
                                                            : qq
                                                        );
                                                        updateModule(index, { contenido: next });
                                                      }}
                                                      className="min-h-[70px]"
                                                      disabled={isSavingCourse}
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
                                              updateModule(index, { contenido: next });
                                            }}
                                            disabled={isSavingCourse}
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
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 rounded-md border p-3 space-y-3">
                      <div className="text-sm font-semibold text-gray-900">Añadir módulo</div>
                      <div className="grid sm:grid-cols-2 gap-3">
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
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Contenido</div>
                        {newModuleType === 'video' ? (
                          <Input
                            value={newModuleContent}
                            onChange={(e) => setNewModuleContent(e.target.value)}
                            placeholder="Pega aquí el link/embed del video"
                            disabled={isSavingCourse}
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
                              disabled={isSavingCourse}
                              onChange={(e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                setNewModuleFileName(file?.name || '');
                              }}
                            />

                            {newModuleFileName ? (
                              <div className="text-xs text-gray-700">
                                Archivo seleccionado:{' '}
                                <span className="font-medium">{newModuleFileName}</span>
                              </div>
                            ) : null}

                            <Textarea
                              value={newModuleContent}
                              onChange={(e) => setNewModuleContent(e.target.value)}
                              className="min-h-[90px]"
                              placeholder="Instrucciones de lectura (qué debe revisar, puntos clave, etc.)"
                              disabled={isSavingCourse}
                            />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {newModuleQuiz.length === 0 ? (
                              <div className="text-sm text-gray-600 rounded-md border p-3">
                                Aún no hay preguntas.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {newModuleQuiz.map((q, qIndex) => (
                                  <div key={qIndex} className="rounded-md border p-3 space-y-3 bg-white">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-sm font-semibold text-gray-900">
                                        Pregunta {qIndex + 1}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setNewModuleQuiz((prev) => prev.filter((_, i) => i !== qIndex))}
                                        disabled={isSavingCourse}
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
                                            prev.map((qq, i) =>
                                              i === qIndex ? { ...qq, pregunta: e.target.value } : qq
                                            )
                                          )
                                        }
                                        className="min-h-[70px]"
                                        disabled={isSavingCourse}
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
                                              disabled={isSavingCourse}
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
                                              disabled={isSavingCourse}
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
                                              disabled={isSavingCourse}
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
                                            disabled={isSavingCourse}
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
                                        <div className="text-xs font-medium text-gray-700 mb-1">
                                          Respuesta modelo (opcional)
                                        </div>
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
                                          disabled={isSavingCourse}
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
                                disabled={isSavingCourse}
                              >
                                Añadir pregunta
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={addModule} disabled={isSavingCourse || !newModuleTitle.trim()}>
                          Añadir
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t bg-white">
              <DialogFooter>
                <Button variant="outline" onClick={closeEditDialog} disabled={isSavingCourse}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCourse} disabled={isSavingCourse || !editCourseId}>
                  {isSavingCourse ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
