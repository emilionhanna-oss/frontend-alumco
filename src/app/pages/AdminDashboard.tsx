import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  BookOpen,
  ChartBar,
  GraduationCap,
  LogOut,
  Settings,
  ShieldAlert,
  Users,
  UserCog,
} from 'lucide-react';
import { BACKEND_URL } from '../config/api.config';
import { userService } from '../services/apiService';

const LOGO_SRC = `${BACKEND_URL}/static/alumco-logo.png`;

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoOk, setLogoOk] = useState(true);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadPendingUsers = async () => {
      try {
        const response = await userService.getUsers();
        if (!mounted || !response.success || !response.data) return;

        const pending = response.data.filter(
          (u) => String(u.estado || '').toLowerCase() === 'pendiente'
        ).length;

        setPendingUsersCount(pending);
      } catch {
        if (!mounted) return;
        setPendingUsersCount(0);
      }
    };

    loadPendingUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
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
                Administración · Portal de Capacitación ELEAM
              </div>
            </div>

            <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
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
              <UserCog className="w-8 h-8" />
              <h2 className="text-2xl sm:text-3xl">Panel de Administración</h2>
            </div>
            <p className="text-lg text-blue-100">
              {(() => {
                const displayName = user?.nombreCompleto || user?.name;
                const genero = (user as any)?.genero as string | undefined;
                const saludo =
                  genero === 'femenino'
                    ? 'Bienvenida'
                    : genero === 'masculino'
                      ? 'Bienvenido'
                      : 'Te damos la bienvenida';
                return `${saludo}${displayName ? `, ${displayName}` : ''}. Gestiona la plataforma y el seguimiento de capacitación.`;
              })()}
            </p>
          </div>
        </div>

        {/* Admin Cards (3x2 en escritorio) */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <ShieldAlert className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <CardTitle>Alertas de Sistema</CardTitle>
                  <CardDescription>Estado de ONG y ELEAM</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Notificaciones sobre conectividad, incidencias operativas y avisos relevantes para la gestión.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/mi-aprendizaje')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/admin/mi-aprendizaje');
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Mi Aprendizaje</CardTitle>
                  <CardDescription>Cursos obligatorios</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Cursos internos que el Administrador debe completar como parte del equipo Alumco.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/gestion-capacitaciones')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/admin/gestion-capacitaciones');
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Gestión de Capacitación</CardTitle>
                  <CardDescription>Yo Profesor</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Administra, crea y organiza cursos para colaboradores y personal ELEAM.</p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/dashboard-metrics')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/admin/dashboard-metrics');
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ChartBar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Panel de Control</CardTitle>
                  <CardDescription>Métricas y reportes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Acceso a una vista detallada con indicadores, avances y reportes por curso y por ELEAM.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin/usuarios')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/admin/usuarios');
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-100 rounded-lg">
                  <Users className="w-6 h-6 text-cyan-700" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span>Centro de Usuarios</span>
                    {pendingUsersCount > 0 ? (
                      <Badge className="bg-red-600 text-white border-red-700">{pendingUsersCount}</Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>Colaboradores y progreso</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Listado de usuarios, asignación de cursos y seguimiento del progreso individual y grupal.
              </p>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/perfil')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/perfil');
            }}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Settings className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <CardTitle>Mi Perfil</CardTitle>
                  <CardDescription>Datos y certificados</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Administra tu información, firma y descarga tus certificados.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
