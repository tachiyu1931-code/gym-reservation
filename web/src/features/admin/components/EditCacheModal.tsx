/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, X } from 'lucide-react';

export function EditCacheModal(props: any) {
  const {
    editingCache,
    setEditingCache,
    handleUpdateCache,
    departments,
    editName,
    setEditName,
    editDept,
    setEditDept,
    editGrade,
    setEditGrade,
    editClassName,
    setEditClassName,
    actionLoading,
  } = props;
  if (!editingCache) return null;

  const selectedDepartment = departments.find((dept: any) => dept.name === editDept);
  const availableGrades = selectedDepartment
    ? (() => {
        const classGrades = selectedDepartment.classes?.map((cls: any) => cls.grade) ?? [];
        const uniqueGrades = Array.from(new Set(classGrades)).sort((a: any, b: any) => a - b);
        if (uniqueGrades.length > 0) return uniqueGrades.map((grade: any) => `${grade}年`);

        const years = selectedDepartment.years ?? 2;
        return Array.from({ length: years }, (_, index) => `${index + 1}年`);
      })()
    : [];
  const selectedGradeNumber = parseInt(editGrade, 10);
  const availableClasses = selectedDepartment?.classes?.filter((cls: any) => cls.grade === selectedGradeNumber) ?? [];

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
              <select
                className="select-box"
                value={editDept}
                onChange={(e) => {
                  setEditDept(e.target.value);
                  setEditGrade('');
                  setEditClassName('');
                }}
                required
              >
                <option value="">選択してください</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1, maxWidth: '100%' }}>
              <label className="label">学年</label>
              <select
                className="select-box"
                value={editGrade}
                onChange={(e) => {
                  setEditGrade(e.target.value);
                  setEditClassName('');
                }}
                disabled={!editDept}
                required
              >
                <option value="">選択してください</option>
                {availableGrades.map((grade: string) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: '100%' }}>
            <label className="label">クラス</label>
            <select
              className="select-box"
              value={editClassName}
              onChange={(e) => setEditClassName(e.target.value)}
              disabled={!editDept || !editGrade}
            >
              <option value="">未設定</option>
              {availableClasses.length > 0 ? (
                availableClasses.map((cls: any) => (
                  <option key={`${cls.grade}-${cls.class_name}`} value={cls.class_name}>
                    {cls.class_name}
                  </option>
                ))
              ) : (
                editDept && editGrade && <option value="" disabled>登録済みクラスなし</option>
              )}
            </select>
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
