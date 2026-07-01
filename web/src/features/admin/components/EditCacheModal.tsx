/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, X } from 'lucide-react';

export function EditCacheModal(props: any) {
  const { editingCache, setEditingCache, handleUpdateCache, editName, setEditName, editDept, setEditDept, editGrade, setEditGrade, actionLoading } = props;
  if (!editingCache) return null;

  return (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>学生情報の編集</h3>
              <button
                onClick={() => setEditingCache(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateCache}>
              <div className="form-group" style={{ maxWidth: '100%' }}>
                <label className="label">学籍番号 (変更不可)</label>
                <input
                  type="text"
                  className="input-text"
                  value={editingCache.student_id}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group" style={{ maxWidth: '100%' }}>
                <label className="label">氏名</label>
                <input
                  type="text"
                  className="input-text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
                <div className="form-group" style={{ flex: 1, maxWidth: '100%' }}>
                  <label className="label">学科</label>
                  <input
                    type="text"
                    className="input-text"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 1, maxWidth: '100%' }}>
                  <label className="label">学年</label>
                  <input
                    type="text"
                    className="input-text"
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="btn-group" style={{ maxWidth: '100%', marginTop: '30px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingCache(null)}
                  disabled={actionLoading}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="spinner" size={18} /> : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
