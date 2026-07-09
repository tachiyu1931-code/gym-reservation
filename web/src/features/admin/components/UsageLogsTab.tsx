/* eslint-disable @typescript-eslint/no-explicit-any */
import { Download, History, Search, Trash2 } from 'lucide-react';
import { normalizeDepartment } from '@/constants/departments';

export function UsageLogsTab(props: any) {
  const { filteredLogs, departments, searchQuery, setSearchQuery, filterDept, setFilterDept, filterStatus, setFilterStatus, filterYear, setFilterYear, filterMonth, setFilterMonth, filterDate, setFilterDate, downloadCSV, handleDeleteLog, actionLoading } = props;

  return (
        <>
          {/* 検索・フィルターツールバー */}
          <div className="toolbar">
            <div className="filter-group" style={{ flexGrow: 2 }}>
              <label>検索 (氏名・学籍番号)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="検索ワードを入力..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '40px', paddingTop: '12px', paddingBottom: '12px', fontSize: '0.95rem' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="filter-group">
              <label>学科で絞り込み</label>
              <select
                className="select-box"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                style={{ fontSize: '0.95rem', paddingTop: '12px', paddingBottom: '12px' }}
              >
                <option value="">すべて</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={normalizeDepartment(dept.name)}>{dept.name}</option>
                ))}
              </select>
            </div>

             <div className="filter-group">
              <label>ステータスで絞り込み</label>
              <select
                className="select-box"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ fontSize: '0.95rem', paddingTop: '12px', paddingBottom: '12px' }}
              >
                <option value="">すべて</option>
                <option value="active">在室中</option>
                <option value="auto_checked_out">自動退室</option>
                <option value="checked_out">退室済み</option>
              </select>
            </div>

            <div className="filter-group" style={{ minWidth: '320px' }}>
              <label>日付で絞り込み</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

                {/* 年の入力 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1.2 }}>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="すべて"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    min="2000"//2000年
                    max="2100"//2100年まで
                    style={{ padding: '12px 8px', fontSize: '0.95rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>年</span>
                </div>

                {/* 月の入力 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="すべて"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    min="1"
                    max="12"
                    style={{ padding: '12px 8px', fontSize: '0.95rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>月</span>
                </div>

                {/* 日の入力 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                  <input
                    type="number"
                    className="input-text"
                    placeholder="すべて"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    min="1"
                    max="31"
                    style={{ padding: '12px 8px', fontSize: '0.95rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>日</span>
                </div>

              </div>
            </div>

            <button className="btn btn-primary" onClick={downloadCSV} style={{ padding: '12px 24px', fontSize: '0.95rem' }}>
              <Download size={16} />
              CSV出力
            </button>
          </div>

          {/* 利用ログテーブル */}
          <div className="table-wrapper">
            {filteredLogs.length === 0 ? (
              <div className="empty-state">
                <History size={48} className="empty-state-icon" />
                <p>利用記録が見つかりません</p>
              </div>
            ) : (
              <table className="admin-table">

                <thead>
                  <tr>
                    <th>状態</th>
                    <th>入室時刻</th>
                    <th>退室時刻</th>
                    <th>滞在時間</th>
                    <th>学籍番号</th>
                    <th>氏名</th>
                    <th>クラス</th>
                    <th>学科・学年</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log: any) => {
                    const isActive = !log.checked_out_at;
                    const isAutoCheckedOut = !isActive && log.auto_checked_out;
                    const statusLabel = isActive ? '在室中' : isAutoCheckedOut ? '自動退室' : '退室済';
                    const statusStyle = isActive
                      ? {
                          background: 'rgba(16,185,129,0.15)',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary)',
                        }
                      : isAutoCheckedOut
                      ? {
                          background: 'rgba(234,179,8,0.18)',
                          color: '#facc15',
                          border: '1px solid rgba(234,179,8,0.55)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.07)',
                          color: 'var(--text-muted)',
                          border: '1px solid transparent',
                        };
                    const stayMin = log.checked_out_at
                      ? Math.round((new Date(log.checked_out_at).getTime() - new Date(log.checked_in_at).getTime()) / 60000)
                      : null;
                    return (
                      <tr key={log.id}>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            ...statusStyle,
                          }}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>{new Date(log.checked_in_at).toLocaleString('ja-JP')}</td>
                        <td style={{ color: isActive ? 'var(--text-muted)' : undefined }}>
                          {log.checked_out_at ? new Date(log.checked_out_at).toLocaleString('ja-JP') : '-'}
                        </td>
                        <td style={{ color: isActive ? 'var(--text-muted)' : undefined }}>
                          {stayMin !== null ? `${stayMin}分` : '-'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{log.student_id}</td>
                        <td style={{ fontWeight: 500 }}>{log.name}</td>
                        <td>{log.class_name || '-'}</td>
                        <td>{normalizeDepartment(log.department)} ({log.grade})</td>
                        <td>
                          <button
                            className="btn-sm btn-danger-sm"
                            onClick={() => handleDeleteLog(log.id)}
                            disabled={actionLoading}
                          >
                            <Trash2 size={14} />
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
  );
}
