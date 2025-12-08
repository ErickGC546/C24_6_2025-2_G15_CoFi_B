'use client';

interface AdminStats {
  totalUsers?: number;
  activeGroups?: number;
  totalExpensesMonth?: number;
  totalTransactionsMonth?: number;
  avgExpensePerUser?: number;
}

interface AdminStatsCardsProps {
  stats: AdminStats | null;
  loading: boolean;
}

export default function AdminStatsCards({ stats, loading }: AdminStatsCardsProps) {
  const mockKpis = {
    totalUsers: 2,
    totalExpensesMonth: 0,
    activeGroups: 0,
    totalTransactionsMonth: 0,
    avgExpensePerUser: 0,
  };

  const cards = [
    {
      icon: '👥',
      label: 'Usuarios',
      value: stats?.totalUsers ?? mockKpis.totalUsers,
      subtitle: 'Totales registrados',
      bgColor: 'bg-green-50'
    },
    {
      icon: '👥',
      label: 'Grupos creados',
      value: stats?.activeGroups ?? mockKpis.activeGroups,
      subtitle: 'Total de grupos en la plataforma',
      bgColor: 'bg-blue-50'
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-4 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-gray-200"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-400">{card.subtitle}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
