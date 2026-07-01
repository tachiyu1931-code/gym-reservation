'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/immutability */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Globe, RefreshCw } from 'lucide-react';
import { saveOfflineLog, getOfflineLogs, deleteOfflineLog } from '@/utils/db';
import { DEPARTMENTS } from '@/constants/departments';
import { cleanStudentId, cleanName } from '@/utils/cleansing';
import { detectUserType } from '@/utils/detectUserType';
import { DEFAULT_LANGUAGE, TRANSLATIONS, type SupportedLanguage, type TranslationMessages } from '@/lib/translations';
import { ScannerOverlay } from '@/components/ScannerOverlay';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RankingsScreen } from './components/RankingsScreen';
import { CheckInConfirmScreen } from './components/CheckInConfirmScreen';
import { CheckOutConfirmScreen } from './components/CheckOutConfirmScreen';
import { ManualEntryScreen } from './components/ManualEntryScreen';
import { SuccessScreen } from './components/SuccessScreen';

const GRADES = ['1年', '2年', '3年', '4年', '教職員'];
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
  const [lang, setLang] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState<TranslationMessages>(() => TRANSLATIONS[DEFAULT_LANGUAGE]);
  const [translationError, setTranslationError] = useState('');

  useEffect(() => {
    const savedLang = localStorage.getItem('gym_lang');
    if (savedLang === 'ja' || savedLang === 'en') {
      setLang(savedLang);
      setTranslations(TRANSLATIONS[savedLang]);
    }
  }, []);

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
  const checkoutMessages = [t.msgCheckout, t.btnBack];

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

  const getAvailableGradesForDepartment = (deptValue: string) => {
    const classGrades = deptToClassesMap[deptValue]?.map((c) => c.grade) ?? [];
    const uniqueGrades = Array.from(new Set(classGrades)).sort((a, b) => a - b);
    if (uniqueGrades.length > 0) {
      return uniqueGrades.map((gradeNum) => `${gradeNum}年`);
    }

    const yearsCount = deptToYearsMap[deptValue] ?? 4;
    return GRADES.slice(0, yearsCount);
  };

  const handleDepartmentChange = (deptValue: string) => {
    setDepartment(deptValue);

    const availableGrades = getAvailableGradesForDepartment(deptValue);
    if (grade && !availableGrades.includes(grade)) {
      setGrade('');
    }
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
        setScreen('checkout-confirm');
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
      if (detectedType === 'student') await loadDepartmentMaster();
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
          const result = await res.json() as {
            status?: 'checked_in' | 'active';
            log?: UsageLogLike;
            data?: Partial<UsageLogLike>;
          };

          if (result.status === 'active' && result.log) {
            const log = result.log;
            setCheckoutLog(log);
            setName(log.name || '');
            setDepartment(log.department || '');
            setGrade(log.grade || '');
            setClassName(log.class_name || '');
            setUserType(log.is_staff ? 'staff' : detectedType);
            setScreen('checkout-confirm');
            return;
          }

          setScannedName(result.data?.name || cleanN);
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
    await loadDepartmentMaster();
    setScreen('scan');
    setErrorMessage('');
    setOcrResult('');
  };

  return (
    <div className="app-container" onClick={resetTimeoutTimer}>
      {/* 言語切り替えトグル: 小規模な共通部品のため親ファイルに残す */}
      <div className="language-switcher">
        <Globe size={16} className="language-switcher-icon" />
        <button
          className={'btn ' + (lang === 'ja' ? 'btn-primary' : 'btn-secondary') + ' language-button'}
          onClick={() => handleLanguageChange('ja')}
        >
          日本語
        </button>
        <button
          className={'btn ' + (lang === 'en' ? 'btn-primary' : 'btn-secondary') + ' language-button'}
          onClick={() => handleLanguageChange('en')}
        >
          English
        </button>
      </div>

      {/* ヘッダー: 小規模な共通部品のため親ファイルに残す */}
      <div className="header">
        <h1 className="title">{t.title}</h1>
        <p className="subtitle">{t.subtitle}</p>
      </div>

      {(translationError || errorMessage) && (
        <div className="alert-box">
          <AlertCircle size={20} />
          <span>{translationError || errorMessage}</span>
        </div>
      )}

      {screen === 'welcome' && (
        <WelcomeScreen
          t={t}
          studentId={studentId}
          loading={loading}
          rankingsLoading={rankingsLoading}
          handleStudentIdChange={handleStudentIdChange}
          lookupUserStatus={lookupUserStatus}
          handleScanStudentId={handleScanStudentId}
          loadRankings={loadRankings}
        />
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

      {screen === 'rankings' && (
        <RankingsScreen t={t} rankings={rankings} formatMessage={formatMessage} handleReset={handleReset} />
      )}

      {screen === 'checkin-confirm' && (
        <CheckInConfirmScreen
          t={t}
          name={name}
          userType={userType}
          department={department}
          grade={grade}
          className={className}
          gradeLabelKeys={GRADE_LABEL_KEYS}
          loading={loading}
          handleReset={handleReset}
          handleCheckInOrOut={handleCheckInOrOut}
          formatDisplayName={formatDisplayName}
        />
      )}

      {screen === 'checkout-confirm' && checkoutLog && (
        <CheckOutConfirmScreen
          t={t}
          lang={lang}
          checkoutLog={checkoutLog}
          name={name}
          loading={loading}
          handleReset={handleReset}
          executeCheckOut={executeCheckOut}
          formatDisplayName={formatDisplayName}
        />
      )}

      {screen === 'form' && (
        <ManualEntryScreen
          t={t}
          userType={userType}
          studentId={studentId}
          name={name}
          department={department}
          grade={grade}
          className={className}
          dynamicDepartments={dynamicDepartments}
          deptToClassesMap={deptToClassesMap}
          loading={loading}
          handleCheckInOrOut={handleCheckInOrOut}
          handleStudentIdChange={handleStudentIdChange}
          lookupUserStatus={lookupUserStatus}
          setName={setName}
          handleDepartmentChange={handleDepartmentChange}
          setGrade={setGrade}
          setClassName={setClassName}
          getAvailableGradesForDepartment={getAvailableGradesForDepartment}
          gradeLabelKeys={GRADE_LABEL_KEYS}
          handleReset={handleReset}
        />
      )}

      {screen === 'success' && (
        <SuccessScreen
          t={t}
          successType={successType}
          scannedName={scannedName}
          successMessage={successMessage}
          successStats={successStats}
          successDuration={successDuration}
          checkoutNotice={checkoutNotice}
          formatMessage={formatMessage}
          formatDisplayName={formatDisplayName}
        />
      )}

      {/* ステータスバッジ: 小規模な共通部品のため親ファイルに残す */}
      <div className={'status-badge ' + (isOnline ? 'status-online' : 'status-offline')}>
        <div className="status-dot"></div>
        <span>
          {isOnline
            ? t.statusOnline
            : t.statusOffline + ' (' + formatMessage(t.statusUnsent, { count: offlineCount }) + ')'
          }
        </span>
        {!isOnline && offlineCount > 0 && (
          <button className="status-retry-button" onClick={updateOnlineStatus} title={t.retryTitle}>
            <RefreshCw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

