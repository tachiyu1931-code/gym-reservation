'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Keyboard,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Globe
} from 'lucide-react';
import { saveOfflineLog, getOfflineLogs, deleteOfflineLog } from '@/utils/db';
import { DEPARTMENTS } from '@/constants/departments';
import { cleanStudentId, cleanName } from '@/utils/cleansing';
import type { SupportedLanguage, TranslationMessages } from '@/lib/translations';


const GRADES = ['1年', '2年', '3年', '4年', '教職員'];

export default function GymCheckIn() {
  const [lang, setLang] = useState<SupportedLanguage>(() => {
    if (typeof window === 'undefined') return 'ja';

    const savedLang = localStorage.getItem('gym_lang');
    return savedLang === 'ja' || savedLang === 'en' ? savedLang : 'ja';
  });
  const [translations, setTranslations] = useState<TranslationMessages | null>(null);
  const [translationError, setTranslationError] = useState('');


  useEffect(() => {
    const controller = new AbortController();

    const loadTranslations = async () => {
      setTranslationError('');

      try {
        const res = await fetch(`/api/translations?lang=${encodeURIComponent(lang)}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error('Failed to fetch translations');

        const data = await res.json() as { messages: TranslationMessages };
        setTranslations(data.messages);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('Failed to load translations:', err);
        setTranslationError('表示文言の取得に失敗しました。');
      }
    };

    loadTranslations();

    return () => controller.abort();
  }, [lang]);

  const handleLanguageChange = (selectedLang: SupportedLanguage) => {
    setLang(selectedLang);
    localStorage.setItem('gym_lang', selectedLang);
  };

  const t = translations ?? (new Proxy({}, { get: () => '' }) as TranslationMessages);

  const [screen, setScreen] = useState<'welcome' | 'scan' | 'user-type' | 'form' | 'checkout-confirm' | 'success'>('welcome');

  const [studentId, setStudentId] = useState('');
  const [userType, setUserType] = useState<'student' | 'staff' | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');

  // ⭐️ 動的学科・クラスマスタ管理用のState
  const [dynamicDepartments, setDynamicDepartments] = useState<string[]>([]);
  // classes は { grade: number; class_name: string }[] の形式
  const [deptToClassesMap, setDeptToClassesMap] = useState<Record<string, { grade: number; class_name: string }[]>>({});
  const [deptToYearsMap, setDeptToYearsMap] = useState<Record<string, number>>({});

  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [scannedName, setScannedName] = useState('');
  const [ocrResult, setOcrResult] = useState('');
  const [checkoutLog, setCheckoutLog] = useState<any>(null);
  const [successType, setSuccessType] = useState<'checkin' | 'checkout'>('checkin');
  const [welcomeMode, setWelcomeMode] = useState<'checkin' | 'checkout'>('checkin');

  // ホバー状態を管理するためのState
  const [hoveredBtn, setHoveredBtn] = useState<'in' | 'out' | 'scan' | 'student' | 'staff' | null>(null);

  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ⭐️ DBから学科マスターデータを動的に取得する処理
  const loadDepartmentMaster = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      if (!res.ok) throw new Error('Failed to fetch departments');

      const data = await res.json();

      setDynamicDepartments(data.map((d: any) => d.name));

      // classes: { grade: number; class_name: string }[]
      const classMap: Record<string, { grade: number; class_name: string }[]> = {};
      const yearsMap: Record<string, number> = {};
      data.forEach((d: any) => {
        classMap[d.name] = d.classes || [];
        yearsMap[d.name] = d.years || 2;
      });
      setDeptToClassesMap(classMap);
      setDeptToYearsMap(yearsMap);
    } catch (err) {
      console.error('Failed to load dynamic departments, using fallbacks:', err);
      setDynamicDepartments([...DEPARTMENTS]);
      setDeptToClassesMap({});
      setDeptToYearsMap({});
    }
  }, []);

  useEffect(() => {
    loadDepartmentMaster();
  }, [loadDepartmentMaster]);

  const updateOnlineStatus = useCallback(async () => {
    const online = navigator.onLine;
    setIsOnline(online);

    try {
      const logs = await getOfflineLogs();
      setOfflineCount(logs.length);

      if (online && logs.length > 0) {
        await syncOfflineLogs(logs);
      }
    } catch (err) {
      console.error('Failed to access IndexedDB:', err);
    }
  }, []);

  const syncOfflineLogs = async (logs: any[]) => {
    console.log(`Syncing ${logs.length} offline logs to Supabase...`);
    for (const log of logs) {
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: log.student_id,
            name: log.name,
            department: log.department,
            grade: log.grade,
            class_name: log.class_name,
            is_staff: log.is_staff,
            checked_in_at: log.checked_in_at,
          })
        });

        if (res.ok) {
          await deleteOfflineLog(log.id);
          console.log(`Synced log successfully: id ${log.id}`);
        } else {
          console.error(`Failed to sync log id ${log.id}: HTTP ${res.status}`);
          break;
        }
      } catch (err) {
        console.error(`Failed to sync log id ${log.id} due to network error:`, err);
        break;
      }
    }

    const remainingLogs = await getOfflineLogs();
    setOfflineCount(remainingLogs.length);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      updateOnlineStatus();

      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      return () => {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
      };
    }
  }, [updateOnlineStatus]);

  const resetTimeoutTimer = useCallback(() => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

    if (screen === 'form' || screen === 'scan') {
      // 手動入力・スキャン画面: 60秒無操作で待受画面に戻る
      timeoutTimerRef.current = setTimeout(() => {
        handleReset();
        setErrorMessage(t.timeoutMsg);
        setTimeout(() => setErrorMessage(''), 5000);
      }, 60000);
    } else if (screen === 'checkout-confirm') {
      // チェックアウト確認画面: 10秒無操作で待受画面に戻る
      timeoutTimerRef.current = setTimeout(() => {
        handleReset();
      }, 10000);
    }
  }, [screen, t.timeoutMsg]);

  useEffect(() => {
    resetTimeoutTimer();
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [screen, studentId, name, department, grade, className, resetTimeoutTimer]);

  const handleReset = () => {
    setScreen('welcome');
    setStudentId('');
    setName('');
    setDepartment('');
    setGrade('');
    setClassName('');
    setErrorMessage('');
    setOcrResult('');
    setCheckoutLog(null);
    setSuccessType('checkin');
    setWelcomeMode('checkin');
    setUserType(null);
    setHoveredBtn(null);
  };

  useEffect(() => {
  if (screen !== 'success') return;

  const timer = window.setTimeout(() => {
    handleReset();
  }, 3000);

  return () => window.clearTimeout(timer);
}, [screen]);

  // 学科を選んだ時点で、その学科の修業年限に応じて学年の選択肢を絞り込み、
  // クラスが1つだけ特定できる場合は自動入力する
  const handleDepartmentChange = (deptValue: string) => {
    setDepartment(deptValue);

    // 学年が、新しい学科の修業年限を超えている場合はリセット
    const yearsCount = deptToYearsMap[deptValue] ?? 4;
    const availableGrades = GRADES.slice(0, yearsCount);
    if (grade && !availableGrades.includes(grade)) {
      setGrade('');
    }
    // 学科が変わったらクラスもリセット
    setClassName('');
  };

  const lookupCache = async (id: string) => {
    if (!id || id.length < 4) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const checkoutRes = await fetch(`/api/checkout?student_id=${encodeURIComponent(id)}`);
      if (checkoutRes.ok) {
        const checkoutData = await checkoutRes.json();
        if (checkoutData.found) {
          setCheckoutLog(checkoutData.log);
          setName(checkoutData.log.name);
          setStudentId(id);
          setLoading(false);
          setScreen('checkout-confirm');
          return;
        }
      }

      const cacheRes = await fetch(`/api/cache?student_id=${encodeURIComponent(id)}`);
      if (cacheRes.ok) {
        const result = await cacheRes.json();
        if (result.found && result.data) {
          setName(result.data.name || '');
          setDepartment(result.data.department || '');
          setGrade(result.data.grade || '');
          setClassName(result.data.class_name || '');
          if (result.data.is_staff) {
            setUserType('staff');
            setGrade('教職員');
            setClassName('教職員');
          } else {
            setUserType('student');
          }
        }
      }
      setScreen('form');

    } catch (err) {
      console.error('Lookup failed:', err);
      setScreen('form');
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = (mode: 'checkin' | 'checkout') => {
    setWelcomeMode(mode);
    setSuccessType(mode);
    setScreen('user-type');
  };

  const handleCheckOut = async () => {
    if (!checkoutLog) return;
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: checkoutLog.id,
          checked_out_at: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setScannedName(name);
        setSuccessType('checkout');
        setScreen('success');
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Checkout failed');
      }
    } catch (err: any) {
      setErrorMessage(t.checkoutErr);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInOrOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (welcomeMode === 'checkout' && checkoutLog) {
      handleCheckOut();
      return;
    }

    // 教職員の場合は、学年とクラスを自動補完してバリデーションを通す
    let finalGrade = grade;
    let finalClassName = className;
    if (userType === 'staff') {
      finalGrade = '教職員';
      finalClassName = '教職員';
    }

    if (!studentId.trim() || !name.trim() || !department || !finalGrade || !finalClassName) {
      setErrorMessage(t.requiredError);
      return;
    }

    const cleanId = cleanStudentId(studentId);
    const cleanN = cleanName(name);

    if (!cleanId || !cleanN) {
      setErrorMessage(t.requiredError);
      return;
    }

    setStudentId(cleanId);
    setName(cleanN);

    setLoading(true);
    const logTime = new Date().toISOString();

    const logData = {
      student_id: cleanId,
      name: cleanN,
      department: department,
      grade: finalGrade,
      class_name: finalClassName,
      is_staff: userType === 'staff',
      checked_in_at: logTime,
      action: 'checkin' as const,
    };

    const apiPath = '/api/checkin';

    try {
      if (isOnline) {
        const res = await fetch(apiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData)
        });

        if (res.ok) {
          setScannedName(cleanN);
          setScreen('success');
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Server registration failed');
        }
      } else {
        await saveOfflineLog(logData);
        setOfflineCount(prev => prev + 1);
        setScannedName(`${cleanN} (${t.offlineReg})`);
        setScreen('success');
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      try {
        await saveOfflineLog(logData);
        setOfflineCount(prev => prev + 1);
        setScannedName(`${cleanN} (${t.offlineSave})`);
        setScreen('success');
      } catch (dbErr) {
        setErrorMessage(t.registerErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // ラズパイ(/api/scan)に撮影・OCRを依頼し、結果を既存のlookupCache処理に渡す。
  // カメラ自体はラズパイ側にあるため、ノートPC側でgetUserMediaは使用しない。
  const handleScanStudentId = async () => {
    setScreen('scan');
    setErrorMessage('');
    setOcrResult('');
    setOcrLoading(true);

    try {
      //画面側からscanの依頼
      const res = await fetch('/api/scan', { method: 'POST' });
      const data = await res.json();

      if (!data.success || !data.studentId) {
        setErrorMessage(data.error || '学籍番号を読み取れませんでした。もう一度お試しください。');
        setOcrLoading(false);
        return; // scan画面に留まり、再試行ボタンで再スキャンできるようにする
      }

      setOcrResult(`${t.detectLabel}: ${data.studentId}`);
      setStudentId(data.studentId);
      setOcrLoading(false);
      await lookupCache(data.studentId);
    } catch (err) {
      console.error('Raspi scan request failed:', err);
      setErrorMessage('ラズパイへの接続に失敗しました。WiFi接続状況を確認してください。');
      setOcrLoading(false);
    }
  };

  // トップ画面ボタンのベースとなる共通スタイル
  const baseBtnStyle = {
    fontSize: '1.4rem',
    padding: '24px',
    borderRadius: '16px',
    border: '1px solid var(--card-border)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  };

  return (
    <div className="app-container" onClick={resetTimeoutTimer}>
      {/* 言語切り替えトグル */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', gap: '8px', alignItems: 'center' }}>
        <Globe size={16} style={{ color: 'var(--text-muted)' }} />
        <button
          className={`btn ${lang === 'ja' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 12px', fontSize: '0.85rem', minHeight: 'auto', width: 'auto' }}
          onClick={() => handleLanguageChange('ja')}
        >
          日本語
        </button>
        <button
          className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '4px 12px', fontSize: '0.85rem', minHeight: 'auto', width: 'auto' }}
          onClick={() => handleLanguageChange('en')}
        >
          English
        </button>
      </div>

      {/* ヘッダー */}
      <div className="header">
        <h1 className="title">{t.title}</h1>
        <p className="subtitle">{t.subtitle}</p>
      </div>

      {/* エラーメッセージ */}
      {(translationError || errorMessage) && (
        <div className="alert-box">
          <AlertCircle size={20} />
          <span>{translationError || errorMessage}</span>
        </div>
      )}

      {/* 1. 受付トップ画面 */}
      {screen === 'welcome' && (
        <div className="section" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '360px', margin: '0 auto' }}>

            {/* 入室ボタン：通常時は背景をなじませ、ホバー時だけ緑色に */}
            <button
              style={{
                ...baseBtnStyle,
                backgroundColor: hoveredBtn === 'in' ? '#10b981' : '#2d3748',
                color: '#ffffff',
                border: hoveredBtn === 'in' ? '1px solid #10b981' : '1px solid var(--card-border)',
              }}
              onMouseEnter={() => setHoveredBtn('in')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => handleModeSelect('checkin')}
            >
              {t.btnIn}
            </button>

            {/* 退室ボタン：通常時は背景をなじませ、ホバー時だけ別の色（オレンジ系）に */}
            <button
              style={{
                ...baseBtnStyle,
                backgroundColor: hoveredBtn === 'out' ? '#e82c22ff' : '#2d3748',
                color: '#ffffff',
                border: hoveredBtn === 'out' ? '1px solid #e82222ff' : '1px solid var(--card-border)',
              }}
              onMouseEnter={() => setHoveredBtn('out')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => handleModeSelect('checkout')}
            >
              {t.btnOut}
            </button>

            {/* 学生証スキャンボタン：通常時は背景をなじませ、ホバー時だけ深い緑に */}
            <button
              style={{
                ...baseBtnStyle,
                fontSize: '1.2rem',
                padding: '20px',
                marginTop: '10px',
                backgroundColor: hoveredBtn === 'scan' ? '#6db2b2' : '#2d3748',
                color: '#ffffff',
                border: hoveredBtn === 'scan' ? '1px solid #6db2b2' : '1px solid var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={() => setHoveredBtn('scan')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={handleScanStudentId}
            >
              <Camera size={24} />
              {t.btnScan}
            </button>

          </div>
        </div>
      )}


      {screen === 'user-type' && (
        <div className="section" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {t.selectType}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t.selectTypeSub}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '360px', margin: '0 auto' }}>

            {/* 学生ボタン */}
            <button
              style={{
                ...baseBtnStyle,
                backgroundColor: hoveredBtn === 'student' ? 'var(--primary)' : '#2d3748',
                color: '#ffffff',
                border: hoveredBtn === 'student' ? '1px solid var(--primary)' : '1px solid var(--card-border)',
              }}
              onMouseEnter={() => setHoveredBtn('student')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => {
                setUserType('student');
                setScreen('form');
              }}
            >
              {t.student}
            </button>

            {/* 教職員ボタン */}
            <button
              style={{
                ...baseBtnStyle,
                backgroundColor: hoveredBtn === 'staff' ? '#8b5cf6' : '#2d3748', // ホバー時はパープル
                color: '#ffffff',
                border: hoveredBtn === 'staff' ? '1px solid #8b5cf6' : '1px solid var(--card-border)',
              }}
              onMouseEnter={() => setHoveredBtn('staff')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => {
                setUserType('staff');
                setGrade('教職員');
                setClassName('教職員');
                setScreen('form');
              }}
            >
              {t.staff}
            </button>

            {/* 戻るボタン */}
            <button
              className="btn btn-secondary"
              style={{ marginTop: '10px', padding: '12px' }}
              onClick={handleReset}
            >
              <ArrowLeft size={18} />
              {t.btnBack}
            </button>

          </div>
        </div>
      )}

      {/* スキャン画面（ラズパイにOCRを依頼している間の待機/結果表示） */}
      {screen === 'scan' && (
        <div className="section" style={{ justifyContent: 'center', minHeight: '40vh' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                backgroundColor: 'var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              {ocrLoading ? (
                <Loader2 className="spinner" size={48} />
              ) : (
                <Camera size={48} />
              )}
            </div>
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>
              {t.scanGuide}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px', minHeight: '20px' }}>
              {ocrLoading ? t.scanning : ocrResult || t.waitingScan}
            </p>
          </div>

          <div className="btn-group" style={{ maxWidth: '360px', margin: '0 auto', width: '100%' }}>
            {errorMessage && (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleScanStudentId}
                disabled={ocrLoading}
              >
                <RefreshCw size={18} />
                {t.btnRetry}
              </button>
            )}
            <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={handleReset}>
              <ArrowLeft size={18} />
              {t.btnBack}
            </button>
          </div>
        </div>
      )}

      {/* チェックアウト確認画面 */}
      {screen === 'checkout-confirm' && (
        <div className="section" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
            {t.statusActive}
          </h2>
          <p className="success-name">{name} さん</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
            入室時刻: {checkoutLog && new Date(checkoutLog.checked_in_at).toLocaleTimeString('ja-JP')}
          </p>
          <p style={{ fontSize: '1.1rem', marginBottom: '32px' }}>
            {t.checkoutConfirm}
          </p>
          <div className="btn-group">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleReset} disabled={loading}>
              {t.btnCancel}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCheckOut} disabled={loading}>
              {loading ? <Loader2 className="spinner" size={20} /> : t.btnCheckout}
            </button>
          </div>
        </div>
      )}

      {/* 2. 手続きフォーム画面 */}
      {screen === 'form' && (
        <div className="section" style={{ justifyContent: 'flex-start' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {welcomeMode === 'checkin' ? t.btnIn : t.btnOut}({userType === 'student' ? t.student : t.staff})
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {welcomeMode === 'checkin' ? t.welcomeIn : t.welcomeOut}
            </p>
          </div>

          <form onSubmit={handleCheckInOrOut} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            <div className="form-group">
              <label className="label">{t.labelStudentId}</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder={t.placeholderId}
                  value={studentId}
                  onChange={(e) => setStudentId(cleanStudentId(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && studentId.length >= 4) {
                      lookupCache(studentId);
                    }
                  }}
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => studentId.length >= 4 && lookupCache(studentId)}
                  disabled={studentId.length < 4 || loading}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: studentId.length >= 4 ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: studentId.length >= 4 ? 'pointer' : 'not-allowed',
                    padding: '8px'
                  }}
                >
                  {loading ? <Loader2 className="spinner" size={20} /> : <Keyboard size={20} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="label">{t.labelName}</label>
              <input
                type="text"
                className="input-text"
                placeholder={t.placeholderName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => setName(cleanName(e.target.value))}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '480px', flexWrap: 'wrap' }}>

              {/* 🔄 学科/所属の選択（動的マスタを参照） */}
              <div className="form-group" style={{ flex: '2 1 200px' }}>
                <label className="label">{t.labelDept}</label>
                <select
                  className="select-box"
                  value={department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                >
                  <option value="">{t.selectDefault}</option>
                  {dynamicDepartments.map((dept, index) => (
                    <option key={index} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* 学生の場合のみ、学年とクラスの入力欄を動的に表示 */}
              {userType === 'student' && (
                <>
                  {/* 学年プルダウン: 選択した学科の修業年限で絞り込み */}
                  <div className="form-group" style={{ flex: '1 1 140px' }}>
                    <label className="label">{t.labelGrade}</label>
                    <select
                      className="select-box"
                      value={grade}
                      onChange={(e) => { setGrade(e.target.value); setClassName(''); }}
                      disabled={!department}
                    >
                      <option value="">{t.selectDefault}</option>
                      {GRADES.filter(g => g !== '教職員')
                        .slice(0, department ? (deptToYearsMap[department] ?? 4) : 4)
                        .map((g, index) => (
                          <option key={index} value={g}>{g}</option>
                        ))}
                    </select>
                  </div>

                  {/* 🔄 クラスプルダウン: 選択した学年のクラスのみ表示 */}
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="label">{t.labelClass}</label>
                    <select
                      className="select-box"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      disabled={!department || !grade} // 学科・学年が選ばれるまで選択不可
                    >
                      <option value="">{t.selectDefault}</option>
                      {(() => {
                        // 選択した学科 + 学年に対応するクラス一覧を取得
                        const gradeNum = parseInt(grade?.charAt(0) || '0', 10);
                        const allClasses = deptToClassesMap[department] || [];
                        const filtered = allClasses.filter(c => c.grade === gradeNum);
                        return filtered.length > 0
                          ? filtered.map(c => (
                              <option key={`${c.grade}-${c.class_name}`} value={c.class_name}>
                                {c.class_name}
                              </option>
                            ))
                          : <option value="" disabled>クラス未登録</option>;
                      })()}
                    </select>
                  </div>
                </>
              )}

            </div>

            <div className="btn-group" style={{ marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleReset} disabled={loading}>
                {t.btnCancel}
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? <Loader2 className="spinner" size={20} /> : (welcomeMode === 'checkin' ? t.btnCheckin : t.btnCheckout)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 完了（Success）画面 */}
      {screen === 'success' && (
        <div className="section">
          <div className="success-icon-wrapper">
            <div className="success-circle">
              <CheckCircle size={56} color="var(--primary)" />
            </div>
          </div>
          <h2 className="success-text-big">
            {successType === 'checkout' ? t.successCheckout : t.successCheckin}
          </h2>
          <p className="success-name">{scannedName} さん</p>
          <p style={{ color: 'var(--text-muted)' }}>
            {successType === 'checkout' ? t.msgCheckout : t.msgCheckin}
          </p>
          <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <Loader2 className="spinner" size={16} />
            <span>{t.autoBack}</span>
          </div>
        </div>
      )}

      {/* ステータスバッジ */}
      <div className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`}>
        <div className="status-dot"></div>
        <span>
          {isOnline
            ? 'ONLINE'
            : `OFFLINE (未送信: ${offlineCount}件)`
          }
        </span>
        {!isOnline && offlineCount > 0 && (
          <button
            onClick={updateOnlineStatus}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginLeft: '4px'
            }}
            title="再試行"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
