/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarChart3, History, Users } from 'lucide-react';

export function StatsTab(props: any) {
  const { todayCount, todayUniqueUsers, totalRegisteredCaches, logs, todayLogs, todayStr } = props;

  return (
        <div className="section" style={{ justifyContent: 'flex-start', alignItems: 'stretch' }}>
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <History size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{todayCount} 回</span>
                <span className="stat-label">本日の利用件数</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{todayUniqueUsers} 人</span>
                <span className="stat-label">本日の利用者数 (ユニーク)</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <BarChart3 size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{totalRegisteredCaches} 名</span>
                <span className="stat-label">キャッシュ登録学生数</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Users size={24} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="stat-info">
                <span className="stat-value">
                  {logs.filter((l: any) => !l.checked_out_at &&
                    new Date(l.checked_in_at).toISOString().split('T')[0] === todayStr
                  ).length} 人
                </span>
                <span className="stat-label">現在の在室人数</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '10px' }}>
            {/* 学科別本日利用件数 */}
            <div style={{ flex: 1, minWidth: '300px', background: 'rgba(255, 255, 255, 0.94)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                学科別利用状況 (本日)
              </h3>
              {todayLogs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>データがありません</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Array.from(new Set(todayLogs.map((l: any) => l.department))).map((dept: any) => {
                    const count = todayLogs.filter((l: any) => l.department === dept).length;
                    const percentage = Math.round((count / todayLogs.length) * 100);
                    return (
                      <div key={dept} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span>{dept}</span>
                          <span style={{ fontWeight: 600 }}>{count} 件 ({percentage}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#e5f7f4', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary)', borderRadius: '9999px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 最近の利用動向 */}
            <div style={{ flex: 1, minWidth: '300px', background: 'rgba(255, 255, 255, 0.94)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px' }}>
                最近の入室記録 (最新5件)
              </h3>
              {logs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>データがありません</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {logs.slice(0, 5).map((log: any) => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', paddingBottom: '8px', borderBottom: '1px solid rgba(31, 41, 55, 0.1)' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{log.name}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '0.8rem' }}>
                          {log.department}
                        </span>
                      </div>
                      <span style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                        {new Date(log.checked_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
