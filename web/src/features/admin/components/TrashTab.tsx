/* eslint-disable @typescript-eslint/no-explicit-any */
import { History, RefreshCw, Settings, Trash2, Users } from 'lucide-react';

export function TrashTab(props: any) {
  const { deletedLogs, deletedCaches, deletedDepartments, handleRestoreLog, handlePermanentDeleteLog, handleRestoreCache, handlePermanentDeleteCache, handleRestoreDepartment, handlePermanentDeleteDepartment, actionLoading } = props;

  return (
        <div className="section" style={{ justifyContent: 'flex-start', alignItems: 'stretch', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>ゴミ箱</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                データを復元、または完全に削除できます。削除したデータは元に戻せません。
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div className="stat-card">
              <div className="stat-icon"><History size={24} /></div>
              <div className="stat-info">
                <span className="stat-value">{deletedLogs.length} 件</span>
                <span className="stat-label">削除済み利用ログ</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Users size={24} /></div>
              <div className="stat-info">
                <span className="stat-value">{deletedCaches.length} 件</span>
                <span className="stat-label">削除済み利用者キャッシュ</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Settings size={24} /></div>
              <div className="stat-info">
                <span className="stat-value">{deletedDepartments.length} 件</span>
                <span className="stat-label">削除済み学科</span>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>学科</h3>
            <div className="table-wrapper">
              {deletedDepartments.length === 0 ? (
                <div className="empty-state">
                  <Settings size={48} className="empty-state-icon" />
                  <p>削除済みの学科はありません</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>削除日時</th>
                      <th>学科名</th>
                      <th>修業年限</th>
                      <th>クラス</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedDepartments.map((dept: any) => (
                      <tr key={dept.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{dept.deleted_at ? new Date(dept.deleted_at).toLocaleString('ja-JP') : '-'}</td>
                        <td>{dept.name}</td>
                        <td>{dept.years}年制</td>
                        <td>{dept.classes?.length ? dept.classes.map((cls: any) => `${cls.grade}年 ${cls.class_name}`).join('、') : '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn-sm btn-edit-sm" onClick={() => handleRestoreDepartment(dept.id)} disabled={actionLoading}>
                              <RefreshCw size={14} />
                              復元
                            </button>
                            <button className="btn-sm btn-danger-sm" onClick={() => handlePermanentDeleteDepartment(dept.id, dept.name)} disabled={actionLoading}>
                              <Trash2 size={14} />
                              完全削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>利用ログ</h3>
            <div className="table-wrapper">
              {deletedLogs.length === 0 ? (
                <div className="empty-state">
                  <History size={48} className="empty-state-icon" />
                  <p>削除済みの利用ログはありません</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>削除日時</th>
                      <th>入室時刻</th>
                      <th>退室時刻</th>
                      <th>番号</th>
                      <th>氏名</th>
                      <th>クラス</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{log.deleted_at ? new Date(log.deleted_at).toLocaleString('ja-JP') : '-'}</td>
                        <td>{new Date(log.checked_in_at).toLocaleString('ja-JP')}</td>
                        <td>{log.checked_out_at ? new Date(log.checked_out_at).toLocaleString('ja-JP') : '-'}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{log.student_id}</td>
                        <td>{log.name}</td>
                        <td>{log.class_name || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn-sm btn-edit-sm" onClick={() => handleRestoreLog(log.id)} disabled={actionLoading}>
                              <RefreshCw size={14} />
                              復元
                            </button>
                            <button className="btn-sm btn-danger-sm" onClick={() => handlePermanentDeleteLog(log.id)} disabled={actionLoading}>
                              <Trash2 size={14} />
                              完全削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>利用者キャッシュ</h3>
            <div className="table-wrapper">
              {deletedCaches.length === 0 ? (
                <div className="empty-state">
                  <Users size={48} className="empty-state-icon" />
                  <p>削除済みの利用者キャッシュはありません</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>削除日時</th>
                      <th>番号</th>
                      <th>氏名</th>
                      <th>学科</th>
                      <th>学年</th>
                      <th>クラス</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedCaches.map((cache: any) => (
                      <tr key={cache.student_id}>
                        <td style={{ color: 'var(--text-muted)' }}>{cache.deleted_at ? new Date(cache.deleted_at).toLocaleString('ja-JP') : '-'}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cache.student_id}</td>
                        <td>{cache.name}</td>
                        <td>{cache.department}</td>
                        <td>{cache.grade}</td>
                        <td>{cache.class_name || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn-sm btn-edit-sm" onClick={() => handleRestoreCache(cache.student_id)} disabled={actionLoading}>
                              <RefreshCw size={14} />
                              復元
                            </button>
                            <button className="btn-sm btn-danger-sm" onClick={() => handlePermanentDeleteCache(cache.student_id)} disabled={actionLoading}>
                              <Trash2 size={14} />
                              完全削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
  );
}


