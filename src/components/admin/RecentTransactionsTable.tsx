'use client';

interface AdminTransaction {
  date: string;
  userName?: string | null;
  userEmail?: string | null;
  description?: string | null;
  category?: string | null;
  amount?: number;
  currency?: string | null;
}

interface RecentTransactionsTableProps {
  transactions: AdminTransaction[];
  loading: boolean;
}

export default function RecentTransactionsTable({ transactions, loading }: RecentTransactionsTableProps) {
  return (
    <div className="mt-8 mb-8">
      <h3 className="text-lg font-medium text-gray-900 mb-4">📊 Últimas transacciones</h3>
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
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Cargando transacciones...
                </td>
              </tr>
            ) : transactions.length ? (
              transactions.map((t, i) => (
                <tr key={i} className="border-t hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(t.date).toLocaleString('es-ES')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {t.userName || t.userEmail || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {t.description || t.category || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {t.currency === 'PEN' || !t.currency 
                      ? `S/ ${Number(t.amount ?? 0).toFixed(2)}` 
                      : `${Number(t.amount ?? 0).toFixed(2)} ${t.currency}`
                    }
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  No hay transacciones recientes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
