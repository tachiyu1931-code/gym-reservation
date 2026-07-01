/* eslint-disable @typescript-eslint/no-explicit-any */
import { Edit3, Search, Trash2, Users } from 'lucide-react';
import { normalizeDepartment } from '@/constants/departments';

export function UserCacheTab(props: any) {
  const { filteredCaches, departments, searchQuery, setSearchQuery, filterDept, setFilterDept, filterGrade, setFilterGrade, openEditModal, handleDeleteCache, actionLoading } = props;

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
              <label>学年で絞り込み</label>
              <select
                className="select-box"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                style={{ fontSize: '0.95rem', paddingTop: '12px', paddingBottom: '12px' }}
              >
                <option value="">すべて</option>
                {[1, 2, 3, 4].map((grade) => (
                  <option key={grade} value={`${grade}年`}>
                    {grade}年生
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* キャッシュテーブル */}
          <div className="table-wrapper">
            {filteredCaches.length === 0 ? (
              <div className="empty-state">
                <Users size={48} className="empty-state-icon" />
                <p>キャッシュデータが登録されていません</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>学籍番号</th>
                    <th>氏名</th>
                    <th>学科</th>
                    <th>学年</th>
                    <th>最終更新</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCaches.map((c: any) => (
                    <tr key={c.student_id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.student_id}</td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>{c.department}</td>
                      <td>{c.grade}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(c.updated_at).toLocaleString('ja-JP')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn-sm btn-edit-sm"
                            onClick={() => openEditModal(c)}
                            disabled={actionLoading}
                          >
                            <Edit3 size={14} />
                            編集
                          </button>
                          <button
                            className="btn-sm btn-danger-sm"
                            onClick={() => handleDeleteCache(c.student_id)}
                            disabled={actionLoading}
                          >
                            <Trash2 size={14} />
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
  );
}
