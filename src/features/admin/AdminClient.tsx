'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  History,
  BarChart3,
  Download,
  Trash2,
  Edit3,
  Search,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Settings
} from 'lucide-react';
import {
  getUsageLogs,
  deleteUsageLog,
  restoreUsageLog,
  permanentDeleteUsageLog,
  getDeletedUsageLogs,
  getUsersCache,
  updateStudentCache,
  deleteStudentCache,
  restoreStudentCache,
  permanentDeleteStudentCache,
  getDeletedStudentCaches,
  getDepartmentMasters,
  addDepartment,
  deleteDepartment,
  addDepartmentClass,
  deleteDepartmentClass,
  updateDepartmentYears,
  type DepartmentMaster
} from '@/app/admin/actions';
import { normalizeDepartment } from '@/constants/departments';
import NotificationBell from '@/components/NotificationBell';

// 利用ログの型
interface UsageLog {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name?: string;
  is_staff: boolean;
  checked_in_at: string;
  checked_out_at: string | null;
  auto_checked_out: boolean;
  created_at: string;
  deleted_at?: string | null;
}

// 学生キャッシュの型
interface UserCache {
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name?: string;
  checked_in_at: string;
  checked_out_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'logs' | 'cache' | 'stats' | 'departments' | 'trash'>('logs');

  // データステート
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [caches, setCaches] = useState<UserCache[]>([]);

  // 学科・クラス管理用ステート
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptYears, setNewDeptYears] = useState(2);
  // クラス追加入力: { [deptId]: { grade: string; className: string } }
  const [newClassInputs, setNewClassInputs] = useState<Record<number, { grade: string; className: string }>>({});

  // ゴミ箱用ステート
  const [deletedLogs, setDeletedLogs] = useState<UsageLog[]>([]);
  const [deletedCaches, setDeletedCaches] = useState<UserCache[]>([]);

  // フィルター・検索ステート
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  // システムステータス
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 編集モーダルステート
  const [editingCache, setEditingCache] = useState<UserCache | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editGrade, setEditGrade] = useState('');

  // データロード
  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [logsData, cachesData, deptData, delLogsData, delCachesData] = await Promise.all([
        getUsageLogs() as Promise<UsageLog[]>,
        getUsersCache() as Promise<UserCache[]>,
        getDepartmentMasters(),
        getDeletedUsageLogs() as Promise<UsageLog[]>,
        getDeletedStudentCaches() as Promise<UserCache[]>,
      ]);
      setLogs(logsData);
      setCaches(cachesData);
      setDepartments(deptData);
      setDeletedLogs(delLogsData);
      setDeletedCaches(delCachesData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setErrorMsg('データの取得に失敗しました。データベースの接続を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ログをゴミ箱へ移動（論理削除）
  const handleDeleteLog = async (id: number) => {
    if (!window.confirm('この利用記録をゴミ箱に移動しますか？\n30日以内は復元可能です。')) return;

    setActionLoading(true);
    try {
      await deleteUsageLog(id);
      setLogs(prev => prev.filter(log => log.id !== id));
      const updatedDeleted = await getDeletedUsageLogs() as UsageLog[];
      setDeletedLogs(updatedDeleted);
    } catch (err) {
      alert('削除に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  // キャッシュをゴミ箱へ移動（論理削除）
  const handleDeleteCache = async (studentId: string) => {
    if (!window.confirm(`学籍番号 ${studentId} のキャッシュデータをゴミ箱に移動しますか？\n30日以内は復元可能です。`)) return;

    setActionLoading(true);
    try {
      await deleteStudentCache(studentId);
      setCaches(prev => prev.filter(c => c.student_id !== studentId));
      const updatedDeleted = await getDeletedStudentCaches() as UserCache[];
      setDeletedCaches(updatedDeleted);
    } catch (err) {
      alert('削除に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };
  const handleRestoreLog = async (id: number) => {
    setActionLoading(true);
    try {
      await restoreUsageLog(id);
      const [updatedLogs, updatedDeleted] = await Promise.all([
        getUsageLogs() as Promise<UsageLog[]>,
        getDeletedUsageLogs() as Promise<UsageLog[]>,
      ]);
      setLogs(updatedLogs);
      setDeletedLogs(updatedDeleted);
    } catch (err) {
      alert('復元に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteLog = async (id: number) => {
    if (!window.confirm('この利用記録を完全に削除します。元に戻せません。実行しますか？')) return;

    setActionLoading(true);
    try {
      await permanentDeleteUsageLog(id);
      setDeletedLogs(prev => prev.filter(log => log.id !== id));
    } catch (err) {
      alert('完全削除に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreCache = async (studentId: string) => {
    setActionLoading(true);
    try {
      await restoreStudentCache(studentId);
      const [updatedCaches, updatedDeleted] = await Promise.all([
        getUsersCache() as Promise<UserCache[]>,
        getDeletedStudentCaches() as Promise<UserCache[]>,
      ]);
      setCaches(updatedCaches);
      setDeletedCaches(updatedDeleted);
    } catch (err) {
      alert('復元に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteCache = async (studentId: string) => {
    if (!window.confirm(`番号 ${studentId} のキャッシュデータを完全に削除します。元に戻せません。実行しますか？`)) return;

    setActionLoading(true);
    try {
      await permanentDeleteStudentCache(studentId);
      setDeletedCaches(prev => prev.filter(cache => cache.student_id !== studentId));
    } catch (err) {
      alert('完全削除に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  // キャッシュ更新処理
  const [editClassName, setEditClassName] = useState('');

  const openEditModal = (cache: UserCache) => {
    setEditingCache(cache);
    setEditName(cache.name);
    setEditDept(cache.department);
    setEditGrade(cache.grade);
    setEditClassName(cache.class_name || '');
  };

  const handleUpdateCache = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCache) return;

    setActionLoading(true);
    try {
      await updateStudentCache(
        editingCache.student_id,
        editName,
        editDept,
        editGrade,
        editClassName
      );

      setCaches(prev => prev.map(c =>
        c.student_id === editingCache.student_id
          ? { ...c, name: editName, department: editDept, grade: editGrade, class_name: editClassName, updated_at: new Date().toISOString() }
          : c
      ));
      setEditingCache(null);
    } catch (err) {
      alert('更新に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    const name = newDeptName.trim();
    if (!name) return;
    setActionLoading(true);
    try {
      await addDepartment(name, newDeptYears);
      setNewDeptName('');
      setNewDeptYears(2);
      const updated = await getDepartmentMasters();
      setDepartments(updated);
    } catch (err: any) {
      alert(err.message || '学科の追加に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeYears = async (departmentId: number, years: number) => {
    setActionLoading(true);
    try {
      await updateDepartmentYears(departmentId, years);
      setDepartments(prev =>
        prev.map(d => d.id === departmentId ? { ...d, years } : d)
      );
      setNewClassInputs(prev => {
        const current = prev[departmentId];
        if (!current || Number(current.grade) <= years) return prev;
        return { ...prev, [departmentId]: { ...current, grade: '1' } };
      });
    } catch (err: any) {
      alert(err.message || '修業年限の更新に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDepartment = async (id: number, name: string) => {
    if (!window.confirm(`学科「${name}」を削除しますか？\n紐づくクラス情報も削除されます。`)) return;
    setActionLoading(true);
    try {
      await deleteDepartment(id);
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert('削除に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddClass = async (departmentId: number) => {
    const targetDept = departments.find((dept) => dept.id === departmentId);
    const years = targetDept?.years ?? 4;
    const input = newClassInputs[departmentId] || { grade: '1', className: '' };
    const className = input.className.trim().toUpperCase();
    const grade = Number(input.grade);
    if (!className || !Number.isInteger(grade) || grade < 1 || grade > years) return;
    setActionLoading(true);
    try {
      await addDepartmentClass(departmentId, grade, className);
      setNewClassInputs(prev => ({ ...prev, [departmentId]: { grade: '1', className: '' } }));
      const updated = await getDepartmentMasters();
      setDepartments(updated);
    } catch (err: any) {
      alert(err.message || 'クラスの追加に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClass = async (departmentId: number, cls: { grade: number; class_name: string }) => {
    if (!window.confirm(`クラス「${cls.grade}年 ${cls.class_name}」を削除しますか？`)) return;
    setActionLoading(true);
    try {
      await deleteDepartmentClass(departmentId, cls.grade, cls.class_name);
      setDepartments(prev =>
        prev.map(d =>
          d.id === departmentId
            ? { ...d, classes: d.classes.filter(c => !(c.grade === cls.grade && c.class_name === cls.class_name)) }
            : d
        )
      );
    } catch (err) {
      alert('削除に失敗しました。');
    } finally {
      setActionLoading(false);
    }
  };

  // フィルタリング処理（利用ログ用）
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.student_id.includes(searchQuery);

    const matchesDept = filterDept === '' || normalizeDepartment(log.department) === filterDept;

    let year = '';
    let month = '';
    let day = '';

    if (log.checked_in_at) {
      // データベースの時刻をローカル（日本時間）の "YYYY-MM-DD" 形式に変換
      const d = new Date(log.checked_in_at);
      year = String(d.getFullYear());
      month = String(d.getMonth() + 1).padStart(2, '0'); // 月は0から始まるため+1
      day = String(d.getDate()).padStart(2, '0');
    }

    // 入力された数字と日本時間の日付を比較（空欄ならすべて通す）
    const matchesYear = filterYear === '' || year === filterYear;
    const matchesMonth = filterMonth === '' || month === filterMonth.padStart(2, '0');
    const matchesDate = filterDate === '' || day === filterDate.padStart(2, '0');
    return matchesSearch && matchesDept && matchesYear && matchesMonth && matchesDate;

  });

  // フィルタリング処理（キャッシュ用）
  const filteredCaches = caches.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.student_id.includes(searchQuery);

    const matchesDept = filterDept === '' || normalizeDepartment(c.department) === filterDept;
    const matchesGrade = filterGrade === '' || c.grade === filterGrade;

    return matchesSearch && matchesDept && matchesGrade;
  });

  // CSVダウンロード処理
  const downloadCSV = () => {
    if (filteredLogs.length === 0) {
      alert('ダウンロードするデータがありません。');
      return;
    }

    const headers = ['入室日時', '退室日時', '滞在時間', '学籍番号', '氏名', '学科', '学年', 'クラス名'];
    const rows = filteredLogs.map(log => {
      const stayMin = log.checked_out_at
        ? Math.round((new Date(log.checked_out_at).getTime() - new Date(log.checked_in_at).getTime()) / 60000)
        : null;
      return [
        new Date(log.checked_in_at).toLocaleString('ja-JP'),
        log.checked_out_at ? new Date(log.checked_out_at).toLocaleString('ja-JP') : '在室中',
        stayMin !== null ? `${stayMin}分` : '-',
        log.student_id,
        log.name,
        normalizeDepartment(log.department),
        log.grade,
        log.class_name || ''
      ];
    });

    // CSV文字列作成 (Excelの文字化けを防ぐためにBOMを付与)
    const csvContent = "\ufeff" + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gym_usage_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 統計処理（本日の利用数、ユニーク人数等）
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(log => log.checked_in_at.startsWith(todayStr));
  const todayCount = todayLogs.length;
  const todayUniqueUsers = new Set(todayLogs.map(log => log.student_id)).size;
  const totalRegisteredCaches = caches.length;

  return (
    <div className="admin-layout">
      {/* 管理者ヘッダー */}
      <div className="admin-header">
        <div className="admin-title-area">
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
            GYM RESERVE - 管理パネル
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            利用記録の確認とキャッシュマスタの保守
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-secondary" onClick={loadData} disabled={loading || actionLoading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            {loading ? '読込中' : '再読込'}
          </button>
          <NotificationBell />
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => { setActiveTab('logs'); setSearchQuery(''); setFilterDept(''); setFilterGrade(''); setFilterDate(''); }}
        >
          <History size={16} />
          利用ログ一覧
        </button>
        <button
          className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          <Settings size={16} />
          学科・クラス管理
        </button>
        <button
          className={`tab-btn ${activeTab === 'cache' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cache'); setSearchQuery(''); setFilterDept(''); setFilterGrade(''); setFilterDate(''); }}
        >
          <Users size={16} />
          利用者キャッシュ管理
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart3 size={16} />
          利用統計
        </button>
        <button
          className={`tab-btn ${activeTab === 'trash' ? 'active' : ''}`}
          onClick={() => { setActiveTab('trash'); setSearchQuery(''); setFilterDept(''); setFilterGrade(''); setFilterDate(''); }}
        >
          <Trash2 size={16} />
          ゴミ箱
          {(deletedLogs.length + deletedCaches.length) > 0 && (
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              ({deletedLogs.length + deletedCaches.length})
            </span>
          )}
        </button>
      </div>

      {/* エラー表示 */}
      {errorMsg && (
        <div className="alert-box" style={{ maxWidth: '100%' }}>
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* タブ1: 利用ログ一覧 */}
      {activeTab === 'logs' && !loading && (
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
                {departments.map((dept) => (
                  <option key={dept.id} value={normalizeDepartment(dept.name)}>{dept.name}</option>
                ))}
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
                  {filteredLogs.map(log => {
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
      )}

      {/* タブ2: 学生キャッシュ管理 */}
      {activeTab === 'cache' && !loading && (
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
                {departments.map((dept) => (
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
                  {filteredCaches.map(c => (
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
      )}
      {/* タブ: ゴミ箱 */}
      {activeTab === 'trash' && !loading && (
        <div className="section" style={{ justifyContent: 'flex-start', alignItems: 'stretch', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>ゴミ箱</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                論理削除されたデータを復元、または完全削除できます。完全削除は元に戻せません。
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
                    {deletedLogs.map(log => (
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
                    {deletedCaches.map(cache => (
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
      )}
      {/* タブ3: 利用統計 */}
      {activeTab === 'stats' && !loading && (
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
                  {logs.filter(l => !l.checked_out_at &&
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
                  {Array.from(new Set(todayLogs.map(l => l.department))).map(dept => {
                    const count = todayLogs.filter(l => l.department === dept).length;
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
                  {logs.slice(0, 5).map(log => (
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
      )}

      {/* タブ4: 学科・クラス管理 */}
      {activeTab === 'departments' && !loading && (
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
              {[1, 2, 3, 4].map(y => (
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
              departments.map((dept) => (
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
                        {[1, 2, 3, 4].map(y => (
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
                      dept.classes.map((cls) => (
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
                        setNewClassInputs(prev => ({
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
                      {Array.from({ length: dept.years }, (_, index) => index + 1).map((year) => (
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
                        setNewClassInputs(prev => ({
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
      )}



      {/* ローディングスピナー */}
      {loading && (
        <div className="section" style={{ minHeight: '300px' }}>
          <Loader2 className="spinner" size={40} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>データを読み込んでいます...</p>
        </div>
      )}

      {/* 編集ポップアップモーダル */}
      {editingCache && (
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
      )}
    </div>
  );
}
