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
  Globe,
  Trophy,
  BarChart3
} from 'lucide-react';
import { saveOfflineLog, getOfflineLogs, deleteOfflineLog } from '@/utils/db';
import { DEPARTMENTS } from '@/constants/departments';
import { cleanStudentId, cleanName } from '@/utils/cleansing';
import { detectUserType } from '@/utils/detectUserType';
import { DEFAULT_LANGUAGE, TRANSLATIONS, type SupportedLanguage, type TranslationMessages } from '@/lib/translations';
import { ScannerOverlay } from '@/components/ScannerOverlay';

const GRADES = ['1年', '2年', '3年', '4年', '教�E員'];
const STAFF_LABEL = '教職員';

const GRADE_LABEL_KEYS: Record<string, keyof Pick<TranslationMessages, 'grade1' | 'grade2' | 'grade3' | 'grade4'>> = {
  '1年': 'grade1',
  '2年': 'grade2',
  '3年': 'grade3',
  '4年': 'grade4',
};

type MessageValues = Record<string, string | number>;

function formatMessage(template: string, values: MessageValues) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll('{' + key + '}', String(value)),
    template
  );
}

function formatDisplayName(displayName: string, suffix: string) {
  return suffix ? displayName + ' ' + suffix : displayName;
}

type Screen = 'welcome' | 'scan' | 'form' | 'checkin-confirm' | 'checkout-confirm' | 'success' | 'rankings';

type UsageStatsLike = {
  total_usage_minutes: number;
  monthly_usage_minutes: number;
  consecutive_days: number;
  last_used_date: string | null;
};

type RankingEntry = {
  rank: number;
  user_code_suffix: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  monthly_usage_minutes: number;
  consecutive_days: number;
};

type RankingResponse = {
  monthly: RankingEntry[];
  streaks: RankingEntry[];
};

type UsageLogLike = {
  id: number;
  student_id: string;
  name: string;
  department: string;
  grade: string;
  class_name: string;
  is_staff?: boolean;
  checked_in_at: string;
  usage_duration_minutes?: number | null;
};

export default function GymCheckIn() {
  const [lang, setLang] = useState<SupportedLanguage>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

    const savedLang = localStorage.getItem('gym_lang');
    return savedLang === 'ja' || savedLang === 'en' ? savedLang : DEFAULT_LANGUAGE;
  });
  const [translations, setTranslations] = useState<TranslationMessages>(() => TRANSLATIONS[DEFAULT_LANGUAGE]);
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
        setTranslationError(TRANSLATIONS[lang].translationLoadErr);
      }
    };

    loadTranslations();

    return () => controller.abort();
  }, [lang]);

  const handleLanguageChange = (selectedLang: SupportedLanguage) => {
    setLang(selectedLang);
    setTranslations(TRANSLATIONS[selectedLang]);
    localStorage.setItem('gym_lang', selectedLang);
  };

  const t = translations;

  const [screen, setScreen] = useState<Screen>('welcome');

  const [studentId, setStudentId] = useState('');
  const [userType, setUserType] = useState<'student' | 'staff' | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');

  //  動的学科のクラスマスタ管理
  const [dynamicDepartments, setDynamicDepartments] = useState<string[]>([]);
  const [deptToClassesMap, setDeptToClassesMap] = useState<Record<string, { grade: number; class_name: string }[]>>({});
  const [deptToYearsMap, setDeptToYearsMap] = useState<Record<string, number>>({});

  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [scannedName, setScannedName] = useState('');
  const [ocrResult, setOcrResult] = useState('');
  const [checkoutLog, setCheckoutLog] = useState<UsageLogLike | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [successType, setSuccessType] = useState<'checkin' | 'checkout'>('checkin');
  const [successStats, setSuccessStats] = useState<UsageStatsLike | null>(null);
  const [successDuration, setSuccessDuration] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [rankings, setRankings] = useState<RankingResponse | null>(null);
  const [rankingsLoading, setRankingsLoading] = useState(false);

  const encouragements = [t.msgCheckin, t.welcomeMessage, t.autoDetect];
  const checkoutMessages = [t.msgCheckout, t.checkoutConfirm, t.btnBack];

  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recentInputRef = useRef<{ id: string; at: number } | null>(null);

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
        const endpoint = log.action === 'check_out' ? '/api/checkout' : '/api/checkin';
        const body = log.action === 'check_out'
          ? { log_id: log.log_id, checked_out_at: log.checked_out_at }
          : {
              student_id: log.student_id,
              name: log.name,
              department: log.department,
              grade: log.grade,
              class_name: log.class_name,
              is_staff: log.is_staff,
              checked_in_at: log.checked_in_at,
            };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
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

    if (screen === 'form' || screen === 'scan' || screen === 'checkin-confirm') {
      timeoutTimerRef.current = setTimeout(() => {
        handleReset();
        setErrorMessage(t.timeoutMsg);
        setTimeout(() => setErrorMessage(''), 5000);
      }, 60000);
    } else if (screen === 'checkout-confirm') {
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
    setCheckoutNotice('');
    setSuccessType('checkin');
    setSuccessStats(null);
    setSuccessDuration(null);
    setSuccessMessage('');
    setUserType(null);
  };

  useEffect(() => {
  if (screen !== 'success') return;

  const timer = window.setTimeout(() => {
    handleReset();
  }, 3000);

  return () => window.clearTimeout(timer);
}, [screen]);

    const handleDepartmentChange = (deptValue: string) => {
    setDepartment(deptValue);

    // 学年が、新しい学科、修業年限を超えていた場合セルフリサーチ
    const yearsCount = deptToYearsMap[deptValue] ?? 4;
    const availableGrades = GRADES.slice(0, yearsCount);
    if (grade && !availableGrades.includes(grade)) {
      setGrade('');
    }
    // 学科が変わったらクラスもリセット
    setClassName('');
  };


  const isSameLocalDate = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const formatMonthDay = (dateString: string) => {
    const formatter = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-US', {
      month: 'numeric',
      day: 'numeric',
    });
    return formatter.format(new Date(dateString));
  };
  const lookupUserStatus = async (id: string) => {
    const normalizedId = id.trim().toUpperCase();
    const detectedType = detectUserType(normalizedId);

    if (detectedType === 'unknown') {
      setErrorMessage(t.requiredError);
      return;
    }

    const now = Date.now();
    if (recentInputRef.current?.id === normalizedId && now - recentInputRef.current.at < 3000) {
      setErrorMessage(t.processing);
      return;
    }
    recentInputRef.current = { id: normalizedId, at: now };

    setLoading(true);
    setErrorMessage('');
    setCheckoutNotice('');
    setStudentId(normalizedId);
    setUserType(detectedType);

    try {
      const [checkoutRes, cacheRes] = await Promise.all([
        fetch(`/api/checkout?student_id=${encodeURIComponent(normalizedId)}`),
        fetch(`/api/cache?student_id=${encodeURIComponent(normalizedId)}`),
      ]);

      const checkoutData = checkoutRes.ok ? await checkoutRes.json() : null;
      if (checkoutData?.found && checkoutData.log) {
        const log = checkoutData.log as UsageLogLike;
        setCheckoutLog(log);
        setName(log.name || '');
        setDepartment(log.department || '');
        setGrade(log.grade || '');
        setClassName(log.class_name || '');
        setUserType(log.is_staff ? 'staff' : detectedType);
        await executeCheckOut(log);
        return;
      }

      const cacheData = cacheRes.ok ? await cacheRes.json() : null;
      if (cacheData?.found && cacheData.data) {
        const data = cacheData.data;
        setName(data.name || '');
        setDepartment(detectedType === 'staff' ? STAFF_LABEL : data.department || '');
        setGrade(detectedType === 'staff' ? STAFF_LABEL : data.grade || '');
        setClassName(detectedType === 'staff' ? STAFF_LABEL : data.class_name || '');
        setUserType(detectedType);
        setScreen('checkin-confirm');
        return;
      }

      setName('');
      setDepartment(detectedType === 'staff' ? STAFF_LABEL : '');
      setGrade(detectedType === 'staff' ? STAFF_LABEL : '');
      setClassName(detectedType === 'staff' ? STAFF_LABEL : '');
      setScreen('form');
    } catch (err) {
      console.error('lookupUserStatus failed:', err);
      setErrorMessage(t.registerErr);
    } finally {
      setLoading(false);
    }
  };
  const executeCheckOut = async (targetLog: UsageLogLike | null = checkoutLog) => {
    if (!targetLog) return;
    setLoading(true);
    setErrorMessage('');
    setCheckoutNotice('');

    try {
      const checkedOutAt = new Date();
      const fallbackMinutes = Math.max(1, Math.round((checkedOutAt.getTime() - new Date(targetLog.checked_in_at).getTime()) / 60000));

      if (!isOnline) {
        await saveOfflineLog({
          action: 'check_out',
          student_id: targetLog.student_id,
          log_id: targetLog.id,
          checked_out_at: checkedOutAt.toISOString(),
        });
        setOfflineCount(prev => prev + 1);
        setScannedName(targetLog.name || name);
        setSuccessDuration(fallbackMinutes);
        setSuccessStats(null);
        setSuccessMessage(checkoutMessages[Math.floor(Math.random() * checkoutMessages.length)]);
        setSuccessType('checkout');
        setScreen('success');
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: targetLog.id,
          checked_out_at: checkedOutAt.toISOString(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Checkout failed');
      }

      const result = await res.json() as { usage_duration_minutes?: number; stats?: UsageStatsLike };

      const checkedInAt = new Date(targetLog.checked_in_at);
      if (!isSameLocalDate(checkedInAt, checkedOutAt)) {
        setCheckoutNotice(formatMessage(t.checkoutNotice, { date: formatMonthDay(targetLog.checked_in_at) }));
      }

      setScannedName(targetLog.name || name);
      setSuccessDuration(result.usage_duration_minutes ?? fallbackMinutes);
      setSuccessStats(result.stats ?? null);
      setSuccessMessage(checkoutMessages[Math.floor(Math.random() * checkoutMessages.length)]);
      setSuccessType('checkout');
      setScreen('success');
    } catch (err) {
      console.error('Checkout failed:', err);
      setErrorMessage(t.checkoutErr);
    } finally {
      setLoading(false);
    }
  };
  const handleCheckInOrOut = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMessage('');

    const normalizedId = studentId.trim().toUpperCase();
    const detectedType = detectUserType(normalizedId);

    if (detectedType === 'unknown') {
      setErrorMessage(t.requiredError);
      return;
    }
    // 教職員の場合、学年とクラスを自動補完してバリデーションを通す
    let finalDepartment = department;
    let finalGrade = grade;
    let finalClassName = className;
    if (detectedType === 'staff') {
      finalDepartment = '教職員';
      finalGrade = '教職員';
      finalClassName = '教職員';
    }

    if (!studentId.trim() || !name.trim() || !finalDepartment || !finalGrade || !finalClassName) {
      setErrorMessage(t.requiredError);
      return;
    }

    const cleanId = detectedType === 'student' ? cleanStudentId(normalizedId) : normalizedId;
    const cleanN = cleanName(name);

    if (!cleanId || !cleanN) {
      setErrorMessage(t.requiredError);
      return;
    }

    setStudentId(cleanId);
    setName(cleanN);
    setUserType(detectedType);

    setLoading(true);
    const logTime = new Date().toISOString();

    const logData = {
      student_id: cleanId,
      name: cleanN,
      department: finalDepartment,
      grade: finalGrade,
      class_name: finalClassName,
      is_staff: detectedType === 'staff',
      checked_in_at: logTime,
      action: 'check_in' as const,
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
          setSuccessStats(null);
          setSuccessDuration(null);
          setSuccessMessage(encouragements[Math.floor(Math.random() * encouragements.length)]);
          setSuccessType('checkin');
          setScreen('success');
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Server registration failed');
        }
      } else {
        await saveOfflineLog(logData);
        setOfflineCount(prev => prev + 1);
        setScannedName(`${cleanN} (${t.offlineReg})`);
        setSuccessStats(null);
        setSuccessDuration(null);
        setSuccessMessage(encouragements[Math.floor(Math.random() * encouragements.length)]);
        setSuccessType('checkin');
        setScreen('success');
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      try {
        await saveOfflineLog(logData);
        setOfflineCount(prev => prev + 1);
        setScannedName(`${cleanN} (${t.offlineSave})`);
        setSuccessStats(null);
        setSuccessDuration(null);
        setSuccessMessage(encouragements[Math.floor(Math.random() * encouragements.length)]);
        setSuccessType('checkin');
        setScreen('success');
      } catch (dbErr) {
        setErrorMessage(t.registerErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStudentIdChange = (value: string) => {
    const normalizedId = value.trim().toUpperCase();
    const detectedType = detectUserType(normalizedId);

    setStudentId(normalizedId);

    if (detectedType === 'unknown') {
      setUserType(null);
      return;
    }

    setUserType(detectedType);
    if (detectedType === 'staff') {
      setDepartment('教職員');
      setGrade('教職員');
      setClassName('教職員');
    } else if (department === '教職員' || grade === '教職員' || className === '教職員') {
      setDepartment('');
      setGrade('');
      setClassName('');
    }
  };
    const loadRankings = async () => {
    setRankingsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/rankings');
      if (!res.ok) throw new Error('Failed to fetch rankings');
      const data = await res.json() as RankingResponse;
      setRankings(data);
      setScreen('rankings');
    } catch (err) {
      console.error('Failed to load rankings:', err);
      setErrorMessage(t.registerErr);
    } finally {
      setRankingsLoading(false);
    }
  };

  const handleScanStudentId = async () => {
    setScreen('scan');
    setErrorMessage('');
    setOcrResult('');
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
          日本語</button>
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

      {/* 1. 受付画面 */}
      {screen === 'welcome' && (
        <div className="section" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <p style={{ letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 28 }}>
            {t.heroPrompt}
          </p>

          <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
            <div className="form-group">
              <label className="label">{t.labelStudentId}</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder={t.placeholderId}
                  value={studentId}
                  onChange={(e) => handleStudentIdChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') lookupUserStatus(studentId);
                  }}
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => lookupUserStatus(studentId)}
                  disabled={loading || detectUserType(studentId) === 'unknown'}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: detectUserType(studentId) !== 'unknown' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: detectUserType(studentId) !== 'unknown' ? 'pointer' : 'not-allowed',
                    padding: '8px'
                  }}
                >
                  {loading ? <Loader2 className="spinner" size={20} /> : <Keyboard size={20} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
              <span style={{ color: 'var(--text-muted)' }}>{t.or}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
            </div>

            <div className="btn-group" style={{ maxWidth: '520px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleScanStudentId}
                disabled={loading}
              >
                <Camera size={24} />
                {t.btnScan}
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={loadRankings}
                disabled={rankingsLoading}
              >
                {rankingsLoading ? <Loader2 className="spinner" size={20} /> : <BarChart3 size={22} />}
                {t.btnRankings}
              </button>
            </div>
          </div>
        </div>
      )}
      {screen === 'scan' && (
       <ScannerOverlay
          lang={lang}
          t={t}
          onScanSuccess={async (scannedId) => {
            setStudentId(scannedId);
            await lookupUserStatus(scannedId);
          }}
          onClose={handleReset}
        />
      )}

      {/* チェックイン確認画面(登録済み・未在室のユーザー向け) */}
      {screen === 'rankings' && (
        <div className="section" style={{ justifyContent: 'flex-start' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={24} />
            {t.rankingsTitle}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, width: '100%' }}>
            {[{ title: t.monthlyRanking, rows: rankings?.monthly ?? [], unit: 'minutes' }, { title: t.streakRanking, rows: rankings?.streaks ?? [], unit: 'days' }].map((section) => (
              <div key={section.title} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: 16, background: 'rgba(15, 23, 42, 0.35)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{section.title}</h3>
                {section.rows.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>{t.noRankingData}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {section.rows.map((row) => (
                      <div key={section.title + row.rank + row.user_code_suffix} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>#{row.rank}</span>
                        <span style={{ flex: 1 }}>{row.name}</span>
                        <strong>
                          {section.unit === 'minutes'
                            ? formatMessage(t.minutesUnit, { minutes: row.monthly_usage_minutes })
                            : formatMessage(t.daysUnit, { days: row.consecutive_days })}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={handleReset}>
            <ArrowLeft size={18} />
            {t.btnBack}
          </button>
        </div>
      )}

      {screen === 'checkin-confirm' && (
        <div className="section" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
            {t.welcomeIn}
          </h2>
          <p className="success-name">{formatDisplayName(name, t.personSuffix)}</p>
          {userType === 'student' && (
            <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
              {department} / {GRADE_LABEL_KEYS[grade] ? t[GRADE_LABEL_KEYS[grade]] : grade} / {className}
            </p>
          )}
          <p style={{ fontSize: '1.1rem', marginBottom: '32px' }}>
            {t.welcomeMessage}
          </p>
          <div className="btn-group">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleReset} disabled={loading}>
              {t.btnCancel}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleCheckInOrOut()} disabled={loading}>
              {loading ? <Loader2 className="spinner" size={20} /> : t.btnCheckin}
            </button>
          </div>
        </div>
      )}

      {/* 2. 手続きフォーム画面 */}
      {screen === 'form' && (
        <div className="section" style={{ justifyContent: 'flex-start' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {t.btnIn}{userType ? '(' : ''}{userType === 'student' ? t.student : userType === 'staff' ? t.staff : ''}{userType ? ')' : ''}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {t.welcomeIn}
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
                  onChange={(e) => handleStudentIdChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && detectUserType(studentId) !== 'unknown') {
                      lookupUserStatus(studentId);
                    }
                  }}
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => detectUserType(studentId) !== 'unknown' && lookupUserStatus(studentId)}
                  disabled={detectUserType(studentId) === 'unknown' || loading}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: detectUserType(studentId) !== 'unknown' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: detectUserType(studentId) !== 'unknown' ? 'pointer' : 'not-allowed',
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

            {userType === 'student' && (
              <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '480px', flexWrap: 'wrap' }}>
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
                        <option key={index} value={g}>{t[GRADE_LABEL_KEYS[g]]}</option>
                      ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: '1 1 120px' }}>
                  <label className="label">{t.labelClass}</label>
                  <select
                    className="select-box"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    disabled={!department || !grade}
                  >
                    <option value="">{t.selectDefault}</option>
                    {(() => {
                      const gradeNum = parseInt(grade?.charAt(0) || '0', 10);
                      const allClasses = deptToClassesMap[department] || [];
                      const filtered = allClasses.filter(c => c.grade === gradeNum);
                      return filtered.length > 0
                        ? filtered.map(c => (
                            <option key={String(c.grade) + '-' + c.class_name} value={c.class_name}>
                              {c.class_name}
                            </option>
                          ))
                        : <option value="" disabled>{t.classUnregistered}</option>;
                    })()}
                  </select>
                </div>
              </div>
            )}
            <div className="btn-group" style={{ marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleReset} disabled={loading}>
                {t.btnCancel}
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? <Loader2 className="spinner" size={20} /> : t.btnCheckin}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 画面 */}
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
          <p className="success-name">{formatDisplayName(scannedName, t.personSuffix)}</p>
          <p style={{ color: 'var(--text-muted)' }}>
            {successMessage || (successType === 'checkout' ? t.msgCheckout : t.msgCheckin)}
          </p>
          {successType === 'checkin' && successStats && (
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {formatMessage(t.monthlyUsageSummary, { minutes: successStats.monthly_usage_minutes })}
            </p>
          )}
          {successType === 'checkout' && successDuration !== null && (
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {formatMessage(t.usageDuration, { minutes: successDuration })}
            </p>
          )}
          {successType === 'checkout' && successStats && (
            <p style={{ color: 'var(--primary)', marginTop: 8, fontWeight: 700 }}>
              {formatMessage(t.streakSummary, { days: successStats.consecutive_days })}
            </p>
          )}
          {checkoutNotice && (
            <p style={{ marginTop: 12, color: '#ffb86b', fontWeight: 600 }}>
              {checkoutNotice}
            </p>
          )}
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
            ? t.statusOnline
            : `${t.statusOffline} (${formatMessage(t.statusUnsent, { count: offlineCount })})`
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
            title={t.retryTitle}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
