'use client';

import Image from 'next/image';

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

interface RecentUsersTableProps {
  users: RecentUser[];
  loading: boolean;
}

export default function RecentUsersTable({ users, loading }: RecentUsersTableProps) {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium text-gray-900 mb-4">👤 Usuarios registrados recientemente</h3>
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
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length ? (
              users.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(u.createdAt).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center space-x-3">
                      {u.avatarUrl ? (
                        <div className="relative w-8 h-8 rounded-full overflow-hidden">
                          <Image 
                            src={u.avatarUrl} 
                            alt={u.name || u.email || ''} 
                            width={32} 
                            height={32} 
                            className="object-cover" 
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-600">
                          {(u.name || u.email || '').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{u.name || 'Sin nombre'}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {(() => {
                      const val = u.budgetAmount ?? u.totalBalance ?? u.transactionsNet ?? 0;
                      return `${u.currency === 'PEN' ? 'S/ ' : ''}${Number(val).toFixed(2)}`;
                    })()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  No hay usuarios recientes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
