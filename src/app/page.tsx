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
  totalBalance?: number;
  currency?: string;
  transactionsNet?: number;
  budgetAmount?: number;
}

interface AdminTransaction {
  date: string;
  userName?: string | null;
  userEmail?: string | null;
  description?: string | null;
  category?: string | null;
  amount?: number;
  currency?: string | null;
}

interface AdminStats {
  totalUsers?: number;
  activeGroups?: number;
  totalExpensesMonth?: number;
  totalTransactionsMonth?: number;
  avgExpensePerUser?: number;
  recentTransactions?: AdminTransaction[];
  // optional summary payload used elsewhere
  summary?: Summary | null;
}

interface Profile {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  aiCreditsRemaining?: number;
}

interface Summary {
  budget?: number;
  budgetUsed?: number;
  remainingBudget?: number;
  totalExpense?: number;
  currency?: string | null;
}

export default function HomePage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loadingAdminStats, setLoadingAdminStats] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  // Cuando hay user, obtener perfil desde la API /api/auth/me para conocer el role
  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      try {
        setLoadingProfile(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          // En dev quizá no tengamos token; llamar sin header igual fallará en prod
          console.warn('No se obtuvo token de auth.currentUser');
        }

        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!res.ok) {
          console.error('Error obteniendo perfil:', res.status, await res.text());
          setProfile(null);
          return;
        }

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Error cargando perfil:', err);
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [user]);

  // Datos mock simples para el panel de administración (KPIs)
  const mockKpis = {
    totalUsers: 2,
    totalExpensesMonth: 0,
    activeGroups: 0,
    totalTransactionsMonth: 0,
    avgExpensePerUser: 0,
    totalRevenueMonth: 0,
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

  
  // Cargar estadísticas del admin (si el perfil es admin)
  useEffect(() => {
    async function loadAdminStats() {
      if (!user || !profile || profile.role !== 'admin') {
        setAdminStats(null);
        return;
      }
      try {
        setLoadingAdminStats(true);
        setLoadingSummary(true);
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/stats', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          console.error('Error al obtener admin stats', res.status, await res.text());
          setAdminStats(null);
          return;
        }
        const data = await res.json();
        setAdminStats(data);
        // si la respuesta incluye resumen, guardarlo también
        if (data && data.summary) setSummary(data.summary);
      } catch (err) {
        console.error('Error cargando admin stats:', err);
        setAdminStats(null);
      } finally {
        setLoadingAdminStats(false);
        setLoadingSummary(false);
      }
    }

    loadAdminStats();
  }, [user, profile]);

  return (
    <>
      {!user ? (
        <AutoCarousel />
      ) : loadingProfile ? (
        <div className="p-10">Cargando perfil...</div>
      ) : profile && profile.role === 'admin' ? (
        <div className="p-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">¡Hola {profile.name || user.displayName || 'Admin'}!</h1>
              <p className="text-sm text-gray-500">Has iniciado sesión como administrador.</p>
            </div>
          </div>
            <div>
            <h2 className="text-xl font-semibold mt-2">Panel de administración</h2>
            <p className="text-gray-600 mt-2">{loadingAdminStats ? 'Cargando estadísticas...' : 'Accesos rápidos y métricas principales.'}</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Usuarios</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats ? adminStats.totalUsers : mockKpis.totalUsers}</p>
                  <p className="text-xs text-gray-400">Totales registrados</p>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Grupos creados</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats ? adminStats.activeGroups : mockKpis.activeGroups}</p>
                  <p className="text-xs text-gray-400">Total de grupos en la plataforma</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center">
                  <span className="text-2xl">💸</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gastos (mes)</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats ? `S/ ${Number(adminStats.totalExpensesMonth ?? 0).toFixed(2)}` : `S/ ${Number(mockKpis.totalExpensesMonth).toFixed(2)}`}</p>
                  <p className="text-xs text-gray-400">Total gastado este mes</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                  <span className="text-2xl">🔁</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transacciones (mes)</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats ? adminStats.totalTransactionsMonth ?? mockKpis.totalTransactionsMonth : mockKpis.totalTransactionsMonth}</p>
                  <p className="text-xs text-gray-400">Número de transacciones</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                  <span className="text-2xl">📈</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Promedio por usuario</p>
                  <p className="text-2xl font-semibold text-gray-900">{adminStats ? `S/ ${Number(adminStats.avgExpensePerUser ?? mockKpis.avgExpensePerUser).toFixed(2)}` : `S/ ${Number(mockKpis.avgExpensePerUser).toFixed(2)}`}</p>
                  <p className="text-xs text-gray-400">Promedio de gasto por usuario</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-2">Últimas transacciones</h3>
              <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Usuario</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Descripción</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminStats && adminStats.recentTransactions && adminStats.recentTransactions.length ? (
                      adminStats.recentTransactions.map((t: AdminTransaction, i: number) => (
                        <tr key={i} className="border-t hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-700">{new Date(t.date).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{t.userName || t.userEmail || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{t.description || t.category || '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.currency === 'PEN' || !t.currency ? `S/ ${Number(t.amount ?? 0).toFixed(2)}` : `${Number(t.amount ?? 0).toFixed(2)} ${t.currency}`}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No hay transacciones recientes para mostrar.</td></tr>
                    )}
                  </tbody>
                </table>
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
                      <th className="px-4 py-3 text-sm font-medium text-gray-600">Presupuesto</th>
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
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {(() => {
                              const val = u.budgetAmount !== undefined ? u.budgetAmount : (u.totalBalance !== undefined ? u.totalBalance : (u.transactionsNet !== undefined ? u.transactionsNet : 0));
                              const formatted = `${u.currency === 'PEN' ? 'S/ ' : ''}${Number(val).toFixed(2)}`;
                              return formatted;
                            })()}
                          </td>
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
      ) : (
        // Vista para usuario normal autenticado
        <div className="p-10">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">{(profile?.name || user.displayName || user.email || 'U').charAt(0)}</div>
            <div>
              <h1 className="text-2xl font-semibold">Hola, {profile?.name || user.displayName || 'Usuario'}</h1>
              <p className="text-sm text-gray-500">Bienvenido a COFI. Aquí puedes descargar la app.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Tus grupos</p>
              <p className="text-2xl font-semibold">0</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4">
              <p className="text-sm text-gray-500">Gastos este mes</p>
              <p className="text-2xl font-semibold">S/ 0.00</p>
            </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-md p-4">
                <p className="text-sm text-gray-500">Presupuesto Mensual</p>
                {loadingSummary ? (
                  <p className="text-2xl font-semibold">Cargando...</p>
                ) : summary ? (
                  <div>
                    <p className="text-2xl font-semibold">{summary.currency === 'PEN' || !summary.currency ? `S/ ${Number(summary.budgetUsed ?? summary.budget ?? 0).toFixed(2)} / S/ ${Number(summary.budget ?? 0).toFixed(2)}` : `${Number(summary.budgetUsed ?? summary.budget ?? 0).toFixed(2)} ${summary.currency} / ${Number(summary.budget ?? 0).toFixed(2)} ${summary.currency}`}</p>
                    <p className="text-sm text-gray-500">Queda {summary.currency === 'PEN' || !summary.currency ? `S/ ${Number(summary.remainingBudget ?? 0).toFixed(2)}` : `${Number(summary.remainingBudget ?? 0).toFixed(2)} ${summary.currency}`}</p>
                  </div>
                ) : (
                  <p className="text-2xl font-semibold">S/ 0.00</p>
                )}
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <p className="text-sm text-gray-500">Gastos este mes</p>
                <p className="text-2xl font-semibold">{summary ? `S/ ${Number(summary.totalExpense ?? 0).toFixed(2)}` : 'S/ 0.00'}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4">
                <p className="text-sm text-gray-500">Créditos de IA</p>
                <p className="text-2xl font-semibold">{profile?.aiCreditsRemaining ?? '-'}</p>
              </div>
            </div>
        </div>
      )}
    </>
  );
}
