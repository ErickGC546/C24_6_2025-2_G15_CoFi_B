'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import AdminStatsCards from './AdminStatsCards';
import RecentTransactionsTable from './RecentTransactionsTable';
import RecentUsersTable from './RecentUsersTable';
import AdminCharts from './AdminCharts';
import SystemMetrics from './SystemMetrics';

interface AdminStats {
  totalUsers?: number;
  activeGroups?: number;
  totalExpensesMonth?: number;
  totalTransactionsMonth?: number;
  avgExpensePerUser?: number;
  recentTransactions?: any[];
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

interface AdminDashboardProps {
  userName: string;
}

export default function AdminDashboard({ userName }: AdminDashboardProps) {
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    loadAdminStats();
    loadRecentUsers();
  }, []);

  const loadAdminStats = async () => {
    try {
      setLoadingStats(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        console.error('Error al obtener admin stats', res.status);
        setAdminStats(null);
        return;
      }

      const data = await res.json();
      setAdminStats(data);
    } catch (err) {
      console.error('Error cargando admin stats:', err);
      setAdminStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadRecentUsers = async () => {
    try {
      setLoadingUsers(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/users/recent', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.ok) {
        const data = await res.json();
        setRecentUsers(data);
      } else {
        console.error('Error al obtener usuarios recientes');
        setRecentUsers([]);
      }
    } catch (err) {
      console.error('Error cargando usuarios recientes', err);
      setRecentUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            ¡Hola {userName}!
          </h1>
          <p className="text-sm text-gray-500">
            Has iniciado sesión como administrador.
          </p>
        </div>

        {/* Panel de administración */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Panel de administración
            </h2>
            <p className="text-gray-600 mt-1">
              {loadingStats ? 'Cargando estadísticas...' : 'Métricas y análisis del sistema en tiempo real.'}
            </p>
          </div>

          {/* Tarjetas de estadísticas principales */}
          <AdminStatsCards stats={adminStats} loading={loadingStats} />

          {/* Métricas del sistema */}
          <SystemMetrics stats={adminStats} />

          {/* Gráficos de análisis */}
          <AdminCharts stats={adminStats} />

          {/* Últimas transacciones */}
          <RecentTransactionsTable 
            transactions={adminStats?.recentTransactions || []} 
            loading={loadingStats}
          />

          {/* Usuarios recientes */}
          <RecentUsersTable 
            users={recentUsers} 
            loading={loadingUsers}
          />
        </div>
      </div>
    </div>
  );
}
