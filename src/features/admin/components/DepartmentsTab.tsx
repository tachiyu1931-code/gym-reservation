/* eslint-disable @typescript-eslint/no-explicit-any */
import { Trash2, X } from 'lucide-react';

export function DepartmentsTab(props: any) {
  const { departments, newDeptName, setNewDeptName, newDeptYears, setNewDeptYears, actionLoading, handleAddDepartment, handleChangeYears, handleDeleteDepartment, newClassInputs, setNewClassInputs, handleAddClass, handleDeleteClass } = props;

  return (
        <div className="section" style={{ justifyContent: 'flex-start', alignItems: 'stretch' }}>

          {/* 学科の新規追加フォーム */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', maxWidth: '480px' }}>
            <input
              type="text"
              className="input-text"
              placeholder="新しい学科名を入力"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
              style={{ flex: 2 }}
            />
            <select
              className="select-box"
              value={newDeptYears}
              onChange={(e) => setNewDeptYears(Number(e.target.value))}
              style={{ flex: 1 }}
            >
              {[1, 2, 3, 4].map((y: any) => (
                <option key={y} value={y}>{y}年制</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              style={{ width: 'auto', padding: '0 20px' }}
              onClick={handleAddDepartment}
              disabled={actionLoading || !newDeptName.trim()}
            >
              追加
            </button>
          </div>

          {/* 学科一覧カード */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {departments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>学科が登録されていません。</p>
            ) : (
              departments.map((dept: any) => (
                <div
                  key={dept.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.94)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{dept.name}</h3>
                      <select
                        className="select-box"
                        value={dept.years}
                        onChange={(e) => handleChangeYears(dept.id, Number(e.target.value))}
                        disabled={actionLoading}
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
                      >
                        {[1, 2, 3, 4].map((y: any) => (
                          <option key={y} value={y}>{y}年制</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn-sm btn-danger-sm"
                      onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                      disabled={actionLoading}
                    >
                      <Trash2 size={14} />
                      学科を削除
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {dept.classes.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>クラス未登録</span>
                    ) : (
                      dept.classes.map((cls: any) => (
                        <span
                          key={`${cls.grade}-${cls.class_name}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            background: 'rgba(255, 255, 255, 0.94)',
                            border: '1px solid var(--primary)',
                            fontSize: '0.85rem'
                          }}
                        >
                          {cls.grade}年 {cls.class_name}
                          <button
                            onClick={() => handleDeleteClass(dept.id, cls)}
                            disabled={actionLoading}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                            title="このクラスを削除"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', maxWidth: '320px', flexWrap: 'wrap' }}>
                    <select
                      className="select-box"
                      value={newClassInputs[dept.id]?.grade || '1'}
                      onChange={(e) =>
                        setNewClassInputs((prev: any) => ({
                          ...prev,
                          [dept.id]: {
                            grade: e.target.value,
                            className: prev[dept.id]?.className || '',
                          },
                        }))
                      }
                      disabled={actionLoading}
                      style={{ width: '80px' }}
                    >
                      {Array.from({ length: dept.years }, (_, index) => index + 1).map((year: any) => (
                        <option key={year} value={String(year)}>{year}年</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="input-text"
                      placeholder="例: A組"
                      maxLength={10}
                      value={newClassInputs[dept.id]?.className || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewClassInputs((prev: any) => ({
                          ...prev,
                          [dept.id]: {
                            grade: prev[dept.id]?.grade || '1',
                            className: value,
                          },
                        }));
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddClass(dept.id)}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ width: 'auto', padding: '0 16px' }}
                      onClick={() => handleAddClass(dept.id)}
                      disabled={actionLoading || !(newClassInputs[dept.id]?.className || '').trim()}
                    >
                      クラス追加
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
  );
}
