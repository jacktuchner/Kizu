"use client";

import { useState, useEffect } from "react";

interface Payment {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  metadata: any;
}

const TYPE_LABELS: Record<string, string> = {
  CALL_PAYMENT: "Guide Call",
  GUIDE_PAYOUT: "Payout",
  GROUP_SESSION_PAYMENT: "Group Session",
};

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-600",
};

export default function PurchaseHistory({ role }: { role: "seeker" | "guide" }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  async function fetchPayments(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/history?role=${role}&page=${page}`);
      if (!res.ok) throw new Error("Failed to load payment history.");
      const data = await res.json();
      setPayments(data.payments || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error(err);
      setError("Failed to load payment history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayments();
  }, [role]);

  const title = role === "seeker" ? "Payment History" : "Payout History";

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => fetchPayments()} className="text-sm text-red-600 hover:text-red-700 font-medium">Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">{title}</h2>

      {payments.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 text-sm">No {role === "seeker" ? "payment history" : "payouts"} yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pr-4 text-gray-600">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">
                        {(payment.metadata as any)?.description || TYPE_LABELS[payment.type] || payment.type}
                      </p>
                      <p className="text-xs text-gray-400">{TYPE_LABELS[payment.type] || payment.type}</p>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900">
                      ${payment.amount.toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[payment.status] || "bg-gray-100 text-gray-600"}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => fetchPayments(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-xs text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchPayments(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
