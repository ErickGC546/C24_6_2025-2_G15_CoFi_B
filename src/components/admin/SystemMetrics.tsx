'use client';

interface SystemMetricsProps {
  stats: any;
}

export default function SystemMetrics({ stats }: SystemMetricsProps) {
  const metrics = [
    {
      title: 'Tasa de Retención',
      value: '85%',
      change: '+5%',
      trend: 'up',
      icon: '🎯',
      description: 'Usuarios que vuelven después de 7 días',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Usuarios Activos Diarios',
      value: '2',
      change: '0%',
      trend: 'neutral',
      icon: '👥',
      description: 'Usuarios activos hoy',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      title: 'Tiempo Promedio de Sesión',
      value: '12 min',
      change: '+2 min',
      trend: 'up',
      icon: '⏱️',
      description: 'Duración promedio por sesión',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      title: 'Transacciones Diarias',
      value: '0',
      change: '0%',
      trend: 'neutral',
      icon: '💳',
      description: 'Transacciones registradas hoy',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      title: 'Grupos Activos',
      value: stats?.activeGroups || '0',
      change: '0%',
      trend: 'neutral',
      icon: '👨‍👩‍👧‍👦',
      description: 'Grupos con actividad reciente',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600'
    },
    {
      title: 'Tasa de Conversión',
      value: '100%',
      change: '0%',
      trend: 'neutral',
      icon: '🎪',
      description: 'Usuarios registrados / Visitantes',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    }
  ];

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">📊 Métricas del Sistema</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className={`${metric.bgColor} rounded-lg p-5 hover:shadow-md transition-shadow`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">{metric.icon}</span>
                  <h4 className="text-sm font-medium text-gray-600">{metric.title}</h4>
                </div>
                <p className={`text-3xl font-bold ${metric.textColor} mb-1`}>{metric.value}</p>
                <p className="text-xs text-gray-500">{metric.description}</p>
              </div>
              <div className={`flex items-center space-x-1 text-xs font-medium ${
                metric.trend === 'up' ? 'text-green-600' : 
                metric.trend === 'down' ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                <span>{metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '—'}</span>
                <span>{metric.change}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
