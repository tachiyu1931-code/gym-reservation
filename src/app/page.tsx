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
  Globe // 言語切り替え用のアイコンを追加
} from 'lucide-react';
import { saveOfflineLog, getOfflineLogs, deleteOfflineLog } from '@/utils/db';

// ==========================================
// 翻訳用の辞書データ（日・英）
// ==========================================
const TRANSLATIONS = {
  ja: {
    title: 'GYM RESERVE',
    subtitle: 'ジム利用記録システム',
    welcomeIn: '入室する方の学籍番号を入力してください',
    welcomeOut: '退室する方の学籍番号を入力してください',
    btnIn: '入室',
    btnOut: '退室',
    btnScan: '学生証をスキャンする',
    or: 'または',
    placeholderId: '学籍番号を入力',
    helpText: '学籍番号を入力してEnterキーを押してください',
    autoDetect: '※自動で入室・退室を判定します',
    scanGuide: '枠内に学生証の学籍番号を写してください',
    scanning: '画像を解析中...',
    waitingScan: 'スキャンを待機しています...',
    btnBack: '手動入力に戻る',
    statusActive: '現在ジムを利用中です',
    checkoutConfirm: 'チェックアウトしますか？',
    btnCancel: 'キャンセル',
    btnCheckout: 'チェックアウト',
    labelStudentId: '学籍番号',
    labelName: '氏名 (カタカナまたは漢字)',
    placeholderName: '例: ヤマダ タロウ',
    labelDept: '学科',
    labelGrade: '学年',
    labelClass: 'クラス名',
    placeholderClass: '例: 2C, 2I',
    selectDefault: '選択してください',
    btnCheckin: 'チェックイン',
    successCheckout: 'チェックアウト完了',
    successCheckin: 'チェックイン完了',
    msgCheckout: 'またのご利用をお待ちしています！',
    msgCheckin: 'ご利用いただけます。いってらっしゃい！',
    autoBack: '3秒後に自動で初期画面に戻ります...',
    requiredError: 'すべての必須項目を入力してください。',
    timeoutMsg: '一定時間操作がなかったため、初期画面に戻りました。',
    checkoutErr: 'チェックアウトに失敗しました。もう一度お試しください。',
    registerErr: '登録エラーが発生しました。インターネット接続およびブラウザの設定をご確認ください。',
    offlineReg: 'オフライン登録',
    offlineSave: 'オフライン保存',
    detectLabel: '検出'
  },
  en: {
    title: 'GYM RESERVE',
    subtitle: 'Gym Check-in System',
    welcomeIn: 'Please enter your Student ID to check in',
    welcomeOut: 'Please enter your Student ID to check out',
    btnIn: 'Check-in',
    btnOut: 'Check-out',
    btnScan: 'Scan Student ID',
    or: 'OR',
    placeholderId: 'Enter your ID',
    helpText: 'Enter your ID and press the Enter key',
    autoDetect: '*System will automatically detect Check-in/out',
    scanGuide: 'Place your student ID card inside the frame',
    scanning: 'Analyzing image...',
    waitingScan: 'Waiting for scan...',
    btnBack: 'Back to Manual Entry',
    statusActive: 'You are currently inside the gym',
    checkoutConfirm: 'Would you like to check out?',
    btnCancel: 'Cancel',
    btnCheckout: 'Check Out',
    labelStudentId: 'Student ID',
    labelName: 'Full Name',
    placeholderName: 'e.g. John Doe',
    labelDept: 'Department',
    labelGrade: 'Grade',
    labelClass: 'Class',
    placeholderClass: 'e.g. 2C, 2I',
    selectDefault: 'Please select',
    btnCheckin: 'Check In',
    successCheckout: 'Check Out Complete',
    successCheckin: 'Check In Complete',
    msgCheckout: 'Thank you! See you next time.',
    msgCheckin: 'Registration successful! Have a good workout.',
    autoBack: 'Returning to main screen in 3 seconds...',
    requiredError: 'Please fill in all required fields.',
    timeoutMsg: 'Returned to the main screen due to inactivity.',
    checkoutErr: 'Check out failed. Please try again.',
    registerErr: 'Registration error occurred. Please check your internet connection or browser settings.',
    offlineReg: 'Offline Registered',
    offlineSave: 'Offline Saved',
    detectLabel: 'Detected'
  }
};

const DEPARTMENTS = [
  'ITスペシャリスト科',
  '高度情報処理科・ITエンジニア科',
  '情報システム科',
  'ゲームクリエイター科',
  '総合デザイン科・Web・CGデザイン科',
  '建築設計科',
  'インテリアデザイン科',
  '建築士専攻科',
  '国際ITビジネス科',
  '教職員'
];

const GRADES = ['1年', '2年', '3年', '4年', '教職員'];

export default function GymCheckIn() {
  // 1. 言語管理用のState（初期値は日本語 'ja'）
  const [lang, setLang] = useState<'ja' | 'en'>('ja');

  // クライアント側で保存された言語設定を読み込む（画面遷移/リロード対策）
  useEffect(() => {
    const savedLang = localStorage.getItem('gym_lang') as 'ja' | 'en';
    if (savedLang && (savedLang === 'ja' || savedLang === 'en')) {
      setLang(savedLang);
    }
  }, []);

  // 言語を切り替える関数
  const handleLanguageChange = (selectedLang: 'ja' | 'en') => {
    setLang(selectedLang);
    localStorage.setItem('gym_lang', selectedLang);
  };

  // 選択中の翻訳オブジェクトをショートカット化
  const t = TRANSLATIONS[lang];

  const [screen, setScreen] = useState<'welcome' | 'scan' | 'form' | 'checkout-confirm' | 'success'>('welcome');

  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

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
            checked_in_at: log.checked_in_at
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
      timeoutTimerRef.current = setTimeout(() => {
        handleReset();
        setErrorMessage(t.timeoutMsg); // 翻訳を適用
        setTimeout(() => setErrorMessage(''), 5000);
      }, 60000);
    }
  }, [screen, t.timeoutMsg]);

  useEffect(() => {
    resetTimeoutTimer();
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [screen, studentId, name, department, grade, className, resetTimeoutTimer]);

  const handleReset = () => {
    stopCamera();
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
      setErrorMessage(t.checkoutErr); // 翻訳を適用
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !name || !department || !grade || !className) {
      setErrorMessage(t.requiredError); // 翻訳を適用
      return;
    }

    setLoading(true);
    setErrorMessage('');
    const checkInTime = new Date().toISOString();

    const logData = {
      student_id: studentId,
      name: name,
      department: department,
      grade: grade,
      class_name: className,
      checked_in_at: checkInTime
    };

    try {
      if (isOnline) {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData)
        });

        if (res.ok) {
          setScannedName(name);
          setScreen('success');
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Server registration failed');
        }
      } else {
        await saveOfflineLog(logData);
        setOfflineCount(prev => prev + 1);
        setScannedName(`${name} (${t.offlineReg})`); // 翻訳を適用
        setScreen('success');
      }
    } catch (err: any) {
      console.error('Check-in failed:', err);
      try {
        await saveOfflineLog(logData);
        setOfflineCount(prev => prev + 1);
        setScannedName(`${name} (${t.offlineSave})`); // 翻訳を適用
        setScreen('success');
      } catch (dbErr) {
        setErrorMessage(t.registerErr); // 翻訳を適用
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (screen === 'success') {
      const timer = setTimeout(() => {
        handleReset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  const startCamera = async () => {
    setScreen('scan');
    setErrorMessage('');
    setOcrLoading(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startAutoScan();
    } catch (err) {
      console.error('Camera access failed:', err);
      setErrorMessage('カメラの起動に失敗しました。カメラのアクセス許可を確認してください。');
      setScreen('welcome');
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startAutoScan = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || ocrLoading) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        setOcrLoading(true);
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');

        await worker.setParameters({
          tessedit_char_whitelist: '0123456789',
        });

        const cropX = canvas.width * 0.1;
        const cropY = canvas.height * 0.25;
        const cropW = canvas.width * 0.8;
        const cropH = canvas.height * 0.5;

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropW;
        croppedCanvas.height = cropH;
        const croppedCtx = croppedCanvas.getContext('2d');
        if (croppedCtx) {
          croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const dataUrl = croppedCanvas.toDataURL('image/jpeg');

          const { data: { text } } = await worker.recognize(dataUrl);
          await worker.terminate();

          const match = text.replace(/\s/g, '').match(/\d{7}/);
          if (match) {
            const foundId = match[0];
            console.log('Detected Student ID:', foundId);
            setOcrResult(`${t.detectLabel}: ${foundId}`); // 翻訳を適用

            stopCamera();
            setStudentId(foundId);
            await lookupCache(foundId);
          }
        }
      } catch (ocrErr) {
        console.error('OCR processing error:', ocrErr);
      } finally {
        setOcrLoading(false);
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="app-container" onClick={resetTimeoutTimer}>
      {/* 言語切り替えトグル（ヘッダーの右上に追加） */}
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
      {errorMessage && (
        <div className="alert-box">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 待受（Welcome）画面 */}
      {screen === 'welcome' && (
        <div className="section">
          <div className="form-group" style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>

              {/* 入室／退室切り替えボタン */}
              <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '320px' }}>
                <button
                  className={`btn ${welcomeMode === 'checkin' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setWelcomeMode('checkin')}
                >
                  {t.btnIn}
                </button>
                <button
                  className={`btn ${welcomeMode === 'checkout' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setWelcomeMode('checkout')}
                >
                  {t.btnOut}
                </button>
              </div>

              <h2 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                {welcomeMode === 'checkin' ? t.welcomeIn : t.welcomeOut}
              </h2>

              <button className="btn btn-primary" style={{ width: '100%', maxWidth: '320px' }} onClick={startCamera}>
                <Camera size={22} />
                {t.btnScan}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '320px', margin: '4px 0' }}>
                <hr style={{ flexGrow: 1, border: 'none', borderTop: '1px solid var(--card-border)' }} />
                <span style={{ padding: '0 10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t.or}</span>
                <hr style={{ flexGrow: 1, border: 'none', borderTop: '1px solid var(--card-border)' }} />
              </div>

              <div style={{ width: '100%', maxWidth: '320px', position: 'relative' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder={t.placeholderId}
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && studentId.length >= 4) {
                      lookupCache(studentId);
                    }
                  }}
                  style={{ paddingRight: '50px', textAlign: 'center' }}
                />
                <button
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
              <p className="help-text">{t.helpText}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
                {t.autoDetect}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* カメラスキャン（Scan）画面 */}
      {screen === 'scan' && (
        <div className="section">
          <div className="camera-wrapper">
            <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
            <div className="scan-overlay">
              <div className="scan-laser"></div>
              <div className="scan-target-box"></div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>
              {t.scanGuide}
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px', minHeight: '20px' }}>
              {ocrLoading ? t.scanning : ocrResult || t.waitingScan}
            </p>
          </div>

          <div className="btn-group">
            <button className="btn btn-secondary" style={{ flexGrow: 1 }} onClick={handleReset}>
              <ArrowLeft size={18} />
              {t.btnBack}
            </button>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
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

      {/* 手動入力フォーム（Form）画面 */}
      {screen === 'form' && (
        <div className="section" style={{ justifyContent: 'flex-start' }}>
          <form onSubmit={handleCheckIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="form-group">
              <label className="label">{t.labelStudentId}</label>
              <input
                type="text"
                className="input-text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            <div className="form-group">
              <label className="label">{t.labelName}</label>
              <input
                type="text"
                className="input-text"
                placeholder={t.placeholderName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '480px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">{t.labelDept}</label>
                <select
                  className="select-box"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                >
                  <option value="">{t.selectDefault}</option>
                  {DEPARTMENTS.map((dept, index) => (
                    <option key={index} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">{t.labelGrade}</label>
                <select
                  className="select-box"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                >
                  <option value="">{t.selectDefault}</option>
                  {GRADES.map((g, index) => (
                    <option key={index} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="label">{t.labelClass}</label>
              <input
                type="text"
                className="input-text"
                placeholder={t.placeholderClass}
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
              />
            </div>

            <div className="btn-group">
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