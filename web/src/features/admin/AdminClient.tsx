'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
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
import { AdminHeader } from './components/AdminHeader';
import { AdminTabs } from './components/AdminTabs';
import { UsageLogsTab } from './components/UsageLogsTab';
import { UserCacheTab } from './components/UserCacheTab';
import { TrashTab } from './components/TrashTab';
import { StatsTab } from './components/StatsTab';
import { DepartmentsTab } from './components/DepartmentsTab';
import { EditCacheModal } from './components/EditCacheModal';

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
      <AdminHeader loadData={loadData} loading={loading} actionLoading={actionLoading} />

      <AdminTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setSearchQuery={setSearchQuery}
        setFilterDept={setFilterDept}
        setFilterGrade={setFilterGrade}
        setFilterDate={setFilterDate}
        deletedLogs={deletedLogs}
        deletedCaches={deletedCaches}
      />

      {errorMsg && (
        <div className="alert-box admin-alert-box">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {activeTab === 'logs' && !loading && (
        <UsageLogsTab
          filteredLogs={filteredLogs}
          departments={departments}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterDept={filterDept}
          setFilterDept={setFilterDept}
          filterYear={filterYear}
          setFilterYear={setFilterYear}
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          downloadCSV={downloadCSV}
          handleDeleteLog={handleDeleteLog}
          actionLoading={actionLoading}
        />
      )}

      {activeTab === 'cache' && !loading && (
        <UserCacheTab
          filteredCaches={filteredCaches}
          departments={departments}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterDept={filterDept}
          setFilterDept={setFilterDept}
          filterGrade={filterGrade}
          setFilterGrade={setFilterGrade}
          openEditModal={openEditModal}
          handleDeleteCache={handleDeleteCache}
          actionLoading={actionLoading}
        />
      )}

      {activeTab === 'trash' && !loading && (
        <TrashTab
          deletedLogs={deletedLogs}
          deletedCaches={deletedCaches}
          handleRestoreLog={handleRestoreLog}
          handlePermanentDeleteLog={handlePermanentDeleteLog}
          handleRestoreCache={handleRestoreCache}
          handlePermanentDeleteCache={handlePermanentDeleteCache}
          actionLoading={actionLoading}
        />
      )}

      {activeTab === 'stats' && !loading && (
        <StatsTab
          todayCount={todayCount}
          todayUniqueUsers={todayUniqueUsers}
          totalRegisteredCaches={totalRegisteredCaches}
          logs={logs}
          todayLogs={todayLogs}
          todayStr={todayStr}
        />
      )}

      {activeTab === 'departments' && !loading && (
        <DepartmentsTab
          departments={departments}
          newDeptName={newDeptName}
          setNewDeptName={setNewDeptName}
          newDeptYears={newDeptYears}
          setNewDeptYears={setNewDeptYears}
          actionLoading={actionLoading}
          handleAddDepartment={handleAddDepartment}
          handleChangeYears={handleChangeYears}
          handleDeleteDepartment={handleDeleteDepartment}
          newClassInputs={newClassInputs}
          setNewClassInputs={setNewClassInputs}
          handleAddClass={handleAddClass}
          handleDeleteClass={handleDeleteClass}
        />
      )}

      {loading && (
        <div className="section admin-loading-section">
          <Loader2 className="spinner" size={40} />
          <p className="admin-loading-text">データを読み込んでいます...</p>
        </div>
      )}

      <EditCacheModal
        editingCache={editingCache}
        setEditingCache={setEditingCache}
        handleUpdateCache={handleUpdateCache}
        editName={editName}
        setEditName={setEditName}
        editDept={editDept}
        setEditDept={setEditDept}
        editGrade={editGrade}
        setEditGrade={setEditGrade}
        actionLoading={actionLoading}
      />
    </div>
  );
}


