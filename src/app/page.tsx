'use client';

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { User as FirebaseUser } from 'firebase/auth';
import Image from 'next/image';

const AUTO_CAROUSEL_INTERVAL = 3500;

function AutoCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const slides = [
    {
      title: "Registra gastos con tu voz",
      description: "Tan simple como decir 'menos 40 soles en McDonald's' para registrar tus gastos al instante.",
      icon: <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>🎤</span>
    },
    {
      title: "Gestiona finanzas en grupo",
      description: "Comparte gastos y maneja el presupuesto con tu grupo de amigos o compañeros de clase.",
      icon: <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>👥</span>
    },
    {
      title: "Cumple tus metas de ahorro",
      description: "Define objetivos financieros y visualiza tu progreso hasta alcanzarlos.",
      icon: <span style={{ fontSize: 64, color: '#22c55e', display: 'inline-block', marginBottom: 24 }}>🎯</span>
    }
  ];

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
    }, AUTO_CAROUSEL_INTERVAL);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSlide, slides.length]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div style={{ background: 'rgba(34,197,94,0.10)', padding: '0.5rem 2.5rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 160, minHeight: 64, marginBottom: 8 }}>
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 40, fontFamily: 'Inter, Arial, sans-serif', letterSpacing: 0.5 }}>COFI</span>
            </div>
            <p style={{ color: "#6b7280", fontSize: 18, margin: 0, fontFamily: 'Inter, Arial, sans-serif' }}>
              Finanzas conscientes y colaborativas
            </p>
          </div>
          <div className="relative h-80 mt-12">
            {slides.map((slide, index) => (
              <div
                key={index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  opacity: currentSlide === index ? 1 : 0,
                  zIndex: currentSlide === index ? 10 : 0,
                  transition: "opacity 0.5s ease-in-out",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                {slide.icon}
                <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12, marginTop: 0, color: "#212121", fontFamily: 'Inter, Arial, sans-serif' }}>
                  {slide.title}
                </h2>
                <p style={{ color: "#6b7280", fontSize: 20, fontFamily: 'Inter, Arial, sans-serif', margin: 0 }}>
                  {slide.description}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-center space-x-2 mt-2">
            {slides.map((_, index) => (
              <div
                key={index}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '100%',
                  margin: '0 4px',
                  background: currentSlide === index ? '#22c55e' : '#e5e7eb'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface RecentUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export default function HomePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  // Datos mock simples para el panel de administración (KPIs)
  const mockKpis = {
    totalUsers: 2,
    totalExpensesMonth: 0,
    activeGroups: 0,
  };

  // Fetch usuarios recientes cuando haya user y sea admin (cliente)
  useEffect(() => {
    async function loadRecentUsers() {
      if (!user) return;
      try {
        setLoadingUsers(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token && process.env.NODE_ENV === 'production') {
          console.error('No hay token de autenticación');
          setRecentUsers([]);
          return;
        }

        // Usar ruta relativa (Next la resolverá) o absoluta si necesitas otra origin
        const res = await fetch('/api/admin/users/recent', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const data = await res.json();
          setRecentUsers(data);
        } else {
          console.error('No autorizado o error al obtener usuarios', await res.text());
          setRecentUsers([]);
        }
      } catch (err) {
        console.error('Error cargando usuarios recientes', err);
        setRecentUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    }

    loadRecentUsers();
  }, [user]);

  return (
    <>
      {!user ? (
        <AutoCarousel />
      ) : (
        <div className="p-10">
          <div className="flex flex-col items-start mb-8">
            <h1 className="text-3xl font-bold mb-1">
              ¡Hola admin, {user.displayName || 'Usuario'}!
            </h1>
          </div>
          <div>
            <h2 className="text-xl font-semibold mt-8">Reportes y panel de admin</h2>
            <p className="text-gray-600 mt-2">Aquí puedes ver y gestionar los reportes de usuarios y actividades.</p>
            {/* Panel básico de administración: KPIs y transacciones recientes (mock) */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Usuarios</p>
                  <p className="text-2xl font-semibold text-gray-900">{mockKpis.totalUsers}</p>
                  <p className="text-xs text-gray-400">Totales registrados</p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center">
                  <span className="text-2xl">💸</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gastos este mes</p>
                  <p className="text-2xl font-semibold text-gray-900">S/ {mockKpis.totalExpensesMonth.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Grupos activos</p>
                  <p className="text-2xl font-semibold text-gray-900">{mockKpis.activeGroups}</p>
                  <p className="text-xs text-gray-400">Grupos con actividad reciente</p>
                </div>
              </div>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-2">Usuarios registrados recientemente</h3>
              <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Usuario</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Rol</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUsers ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Cargando usuarios...</td></tr>
                    ) : recentUsers.length ? (
                      recentUsers.map((u) => (
                        <tr key={u.id} className="border-t hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-700">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 flex items-center space-x-3">
                            {u.avatarUrl ? (
                              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                                <Image src={u.avatarUrl} alt={u.name || u.email || ''} width={32} height={32} className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-600">{(u.name || u.email || '').charAt(0).toUpperCase()}</div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{u.name || 'Sin nombre'}</div>
                              <div className="text-xs text-gray-400">{u.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">S/ 0.00</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No hay usuarios recientes para mostrar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
