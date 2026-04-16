import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { BookOpen, GraduationCap, LogOut, User, AlertCircle } from 'lucide-react';
import CourseCard from '../components/CourseCard';
import { courseService } from '../services/apiService';
import { BACKEND_URL } from '../config/api.config';
import type { Course } from '../types';

const LOGO_SRC = `${BACKEND_URL}/static/alumco-logo.png`;

export default function Panel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [logoOk, setLogoOk] = useState(true);

  // Cargar cursos al montar el componente
  useEffect(() => {
    const loadCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const response = await courseService.getCourses();
        
        if (response.success && response.data) {
          setCourses(response.data);
          setServerStatus('connected');
        } else {
          setCourses([]);
          setServerStatus('disconnected');
        }
      } catch (error) {
        console.error('Error en loadCourses:', error);
        setCourses([]);
        setServerStatus('disconnected');
      } finally {
        setIsLoadingCourses(false);
      }
    };

    loadCourses();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleOpenCourse = (courseId: string) => {
    if (!courseId) return;
    navigate(`/curso/${courseId}`, { state: { from: location.pathname } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
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
                Portal de Capacitación ELEAM
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-[#1a2840] to-[#2d4263] rounded-lg p-6 sm:p-8 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-8 h-8" />
              <h2 className="text-2xl sm:text-3xl">
                {(() => {
                  const displayName = user?.nombreCompleto || user?.name || 'Usuario';
                  const genero = (user as any)?.genero as string | undefined;
                  const saludo =
                    genero === 'femenino'
                      ? '¡Bienvenida'
                      : genero === 'masculino'
                        ? '¡Bienvenido'
                        : '¡Te damos la bienvenida';
                  return `${saludo}, ${displayName}!`;
                })()}
              </h2>
            </div>
            <p className="text-lg text-blue-100">
              Continúa con tu capacitación y desarrollo profesional
            </p>
          </div>
        </div>

        {/* Server Status Banner */}
        {serverStatus === 'disconnected' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                No se pudieron cargar los cursos desde el servidor
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Verifica que el backend esté ejecutándose en {BACKEND_URL}
              </p>
            </div>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Cursos Disponibles</CardTitle>
                  <CardDescription>{courses.length} cursos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Accede a nuestros cursos de capacitación profesional y desarrolla nuevas habilidades.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Mi Progreso</CardTitle>
                  <CardDescription>Próximamente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Aquí podrás ver tu progreso en los cursos y certificaciones obtenidas.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/perfil')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/perfil');
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Mi Perfil</CardTitle>
                  <CardDescription>Datos y certificados</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Gestiona tu información personal, firma y descarga tus certificados.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Courses Section */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-[#1a2840] mb-4">Cursos Disponibles</h3>
          
          {isLoadingCourses ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <div className="h-40 bg-gray-200"></div>
                  <CardHeader>
                    <div className="h-4 bg-gray-200 mb-2"></div>
                    <div className="h-3 bg-gray-100"></div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.length === 0 ? (
                <Card className="sm:col-span-2 lg:col-span-3">
                  <CardHeader>
                    <CardTitle>No hay cursos disponibles</CardTitle>
                    <CardDescription>
                      Los cursos se cargan desde el servidor. Si tu archivo JSON no tiene cursos, aquí no se mostrará ninguno.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                courses.map((course) => (
                  <CourseCard key={course.id} course={course} onOpen={handleOpenCourse} />
                ))
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
