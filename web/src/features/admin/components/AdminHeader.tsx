/* eslint-disable @typescript-eslint/no-explicit-any */
import { RefreshCw } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

export function AdminHeader({ loadData, loading, actionLoading }: any) {
  return (
    <div className="admin-header">
      <div className="admin-title-area">
        <h1 className="admin-page-title">GYM RESERVATION - 管理パネル</h1>
        <p className="admin-page-subtitle">入退室、学科管理</p>
      </div>
      <div className="admin-header-actions">
        <button className="btn btn-secondary" onClick={loadData} disabled={loading || actionLoading}>
          <RefreshCw size={16} className={loading ? 'spinner' : ''} />
          {loading ? '読込中' : '再読込'}
        </button>
        <NotificationBell />
      </div>
    </div>
  );
}
