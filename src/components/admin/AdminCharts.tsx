'use client';

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface AdminChartsProps {
  stats: any;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminCharts({ stats }: AdminChartsProps) {
  // Datos reales de la base de datos
  const userGrowthData = stats?.userGrowth || [];
  const transactionsByDay = stats?.transactionsByDay || [];
  const expensesByCategory = stats?.expensesByCategory || [];
  const monthlyRevenue = stats?.monthlyRevenue || [];
  const activeUsersData = stats?.activeUsersData || [];

  // Datos por defecto si no hay información
  const defaultUserGrowth = [
    { mes: 'Jul', usuarios: 0 },
    { mes: 'Ago', usuarios: 0 },
    { mes: 'Sep', usuarios: 0 },
    { mes: 'Oct', usuarios: 0 },
    { mes: 'Nov', usuarios: 0 },
    { mes: 'Dic', usuarios: 0 }
  ];

  const defaultTransactionsByDay = [
    { dia: 'Lun', count: 0 },
    { dia: 'Mar', count: 0 },
    { dia: 'Mié', count: 0 },
    { dia: 'Jue', count: 0 },
    { dia: 'Vie', count: 0 },
    { dia: 'Sáb', count: 0 },
    { dia: 'Dom', count: 0 }
  ];

  const hasUserGrowthData = userGrowthData.length > 0;
  const hasTransactionsData = transactionsByDay.length > 0;
  const hasCategoryData = expensesByCategory.length > 0;
  const hasRevenueData = monthlyRevenue.length > 0;
  const hasActivityData = activeUsersData.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Gráfico de crecimiento de usuarios */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">📈</span>
          Crecimiento de Usuarios
        </h3>
        {!hasUserGrowthData && (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            Sin datos de crecimiento disponibles
          </div>
        )}
        {hasUserGrowthData && (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={userGrowthData}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="usuarios" stroke="#10b981" fillOpacity={1} fill="url(#colorUsers)" />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de transacciones por día */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">📊</span>
          Transacciones por Día (Última Semana)
        </h3>
        {!hasTransactionsData && (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            Sin transacciones en la última semana
          </div>
        )}
        {hasTransactionsData && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={transactionsByDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de gastos por categoría */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">🥧</span>
          Gastos por Categoría (Este Mes)
        </h3>
        {!hasCategoryData && (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            Sin gastos por categoría este mes
          </div>
        )}
        {hasCategoryData && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={expensesByCategory}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {expensesByCategory.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de ingresos vs gastos mensuales */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">💰</span>
          Ingresos vs Gastos Mensuales
        </h3>
        {!hasRevenueData && (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            Sin datos de ingresos y gastos
          </div>
        )}
        {hasRevenueData && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" />
            <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} name="Gastos" />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de usuarios activos por hora */}
      <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">⏰</span>
          Actividad de Usuarios por Hora (Últimas 24h)
        </h3>
        {!hasActivityData && (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            Sin actividad de usuarios en las últimas 24 horas
          </div>
        )}
        {hasActivityData && (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={activeUsersData}>
            <defs>
              <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hora" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="usuarios" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorActive)" />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
