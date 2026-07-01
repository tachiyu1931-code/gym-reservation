/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarChart3, History, Settings, Trash2, Users } from 'lucide-react';

export function AdminTabs(props: any) {
  const { activeTab, setActiveTab, setSearchQuery, setFilterDept, setFilterGrade, setFilterDate, deletedLogs, deletedCaches } = props;
  const resetFilters = () => {
    setSearchQuery('');
    setFilterDept('');
    setFilterGrade('');
    setFilterDate('');
  };

  return (
    <div className="tab-navigation">
      <button className={'tab-btn ' + (activeTab === 'logs' ? 'active' : '')} onClick={() => { setActiveTab('logs'); resetFilters(); }}>
        <History size={16} />
        利用ログ一覧
      </button>
      <button className={'tab-btn ' + (activeTab === 'departments' ? 'active' : '')} onClick={() => setActiveTab('departments')}>
        <Settings size={16} />
        学科・クラス管理
      </button>
      <button className={'tab-btn ' + (activeTab === 'cache' ? 'active' : '')} onClick={() => { setActiveTab('cache'); resetFilters(); }}>
        <Users size={16} />
        利用者キャッシュ管理
      </button>
      <button className={'tab-btn ' + (activeTab === 'stats' ? 'active' : '')} onClick={() => setActiveTab('stats')}>
        <BarChart3 size={16} />
        利用統計
      </button>
      <button className={'tab-btn ' + (activeTab === 'trash' ? 'active' : '')} onClick={() => { setActiveTab('trash'); resetFilters(); }}>
        <Trash2 size={16} />
        ゴミ箱
        {(deletedLogs.length + deletedCaches.length) > 0 && <span className="tab-count">({deletedLogs.length + deletedCaches.length})</span>}
      </button>
    </div>
  );
}
