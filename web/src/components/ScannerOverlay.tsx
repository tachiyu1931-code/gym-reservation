'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  ArrowLeft,
  RefreshCw,
  Camera,
  CheckCircle2,
  XCircle,
  WifiOff,
} from 'lucide-react';
import { type SupportedLanguage, type TranslationMessages } from '@/lib/translations';
import styles from './ScannerOverlay.module.css';

interface ScannerOverlayProps {
  lang: SupportedLanguage;
  t: TranslationMessages;
  onScanSuccess: (studentId: string) => void;
  onClose: () => void;
}

const CAMERA_SIZE = { width: 4608, height: 2592 };
const CROP_BOX = { x: 2800, y: 3, w: 1800, h: 500 };

const cropPercent = {
  left: (CROP_BOX.x / CAMERA_SIZE.width) * 100,
  top: (CROP_BOX.y / CAMERA_SIZE.height) * 100,
  width: (CROP_BOX.w / CAMERA_SIZE.width) * 100,
  height: (CROP_BOX.h / CAMERA_SIZE.height) * 100,
};

type ScanPhase = 'live' | 'capturing' | 'success' | 'error';

export function ScannerOverlay({ lang, t, onScanSuccess, onClose }: ScannerOverlayProps) {
  const [phase, setPhase] = useState<ScanPhase>('live');
  const [errorMessage, setErrorMessage] = useState('');
  const [streamOk, setStreamOk] = useState(true);
  const [streamKey, setStreamKey] = useState(0);

  const videoStreamUrl = `/api/camera-stream?ts=${streamKey}`;

  // Poll /api/scan/status (proxy to raspi /status) to reflect state machine
  const didReportSuccessRef = useRef(false);
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/status', { cache: 'no-store' });
      if (!res.ok) {
        setPhase('error');
        setErrorMessage(t.raspiConnectionErr);
        return;
      }
      const data = await res.json();
      const state = data.state as string;

      if (state === 'processing' || state === 'detected') {
        setPhase('capturing');
        setErrorMessage('');
      } else if (state === 'idle') {
        setPhase('live');
        setErrorMessage('');
      } else if (state === 'success') {
        setPhase('success');
        setErrorMessage('');
        const sid = data.studentId as string | undefined;
        if (sid && !didReportSuccessRef.current) {
          didReportSuccessRef.current = true;
          setTimeout(() => onScanSuccess(sid), 400);
        }
      } else if (state === 'error') {
        setPhase('error');
        setErrorMessage(data.message || t.scanReadErr);
      } else if (state === 'cooldown') {
        setPhase('live');
        setErrorMessage('');
      } else {
        setPhase('live');
        setErrorMessage('');
      }
    } catch (err) {
      setPhase('error');
      setErrorMessage(t.raspiConnectionErr);
    }
  }, [onScanSuccess, t.raspiConnectionErr, t.scanReadErr]);

  useEffect(() => {
    // start polling immediately
    pollStatus();
    const iv = setInterval(() => pollStatus(), 500);
    return () => clearInterval(iv);
  }, [pollStatus]);

  const statusLabel = (() => {
    switch (phase) {
      case 'live':
        return t.scanGuide;
      case 'capturing':
        return t.scanning;
      case 'success':
        return lang === 'ja' ? 'Scan OK' : 'Scan successful';
      case 'error':
        return errorMessage || t.scanReadErr;
    }
  })();

  const phaseColor =
    phase === 'success' ? '#00E676' : phase === 'error' ? '#FF5252' : phase === 'capturing' ? '#FFD600' : '#00E676';

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.brand}>
          GYM RESERVATION
        </div>
        <div className={styles.feedStatus}>
          {streamOk ? (
            <>
              <span className={styles.liveDot}></span>
              <span>LIVE FEED</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className={styles.errorText} />
              <span className={styles.errorText}>NO SIGNAL</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.cameraFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- MJPEG streams require a plain img element. */}
        <img
          key={streamKey}
          src={videoStreamUrl}
          alt="Camera feed"
          className={styles.cameraImage}
          onLoad={() => setStreamOk(true)}
          onError={() => setStreamOk(false)}
        />

        {!streamOk && (
          <div className={styles.noSignalOverlay}>
            <WifiOff size={32} className={styles.errorText} />
            <span className={styles.noSignalMessage}>{t.raspiConnectionErr}</span>
            <button
              onClick={() => setStreamKey((k) => k + 1)}
              className={styles.reconnectButton}
            >
              <RefreshCw size={14} />
              {lang === 'ja' ? 'Reconnect' : 'Reconnect feed'}
            </button>
          </div>
        )}

        {phase === 'capturing' && (
          <div className={styles.flashOverlay} />
        )}

        <div
          className={styles.cropGuide}
          style={{
            left: `${cropPercent.left}%`,
            top: `${cropPercent.top}%`,
            width: `${cropPercent.width}%`,
            height: `${cropPercent.height}%`,
            borderRadius: '16px',
            border: `2px solid ${phaseColor}`,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.65), 0 0 16px ${phaseColor}66`,
          }}
        >
          <div
            className={styles.cropLabel}
            style={{ backgroundColor: phaseColor }}
          >
            {phase === 'capturing' && <Camera size={10} />}
            {phase === 'success' && <CheckCircle2 size={10} />}
            {phase === 'error' && <XCircle size={10} />}
            {phase === 'live' && (lang === 'ja' ? 'ID area' : 'Align ID here')}
            {phase === 'capturing' && (lang === 'ja' ? 'Capturing' : 'Capturing')}
            {phase === 'success' && (lang === 'ja' ? 'Success' : 'Success')}
            {phase === 'error' && (lang === 'ja' ? 'Retrying' : 'Retrying')}
          </div>

          <div className={`${styles.corner} ${styles.cornerTopLeft}`} style={{ borderColor: phaseColor }} />
          <div className={`${styles.corner} ${styles.cornerTopRight}`} style={{ borderColor: phaseColor }} />
          <div className={`${styles.corner} ${styles.cornerBottomLeft}`} style={{ borderColor: phaseColor }} />
          <div className={`${styles.corner} ${styles.cornerBottomRight}`} style={{ borderColor: phaseColor }} />
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.statusMessage}>
          {phase === 'capturing' && <Loader2 className={`${styles.spin} ${styles.warningText}`} size={18} />}
          {phase === 'success' && <CheckCircle2 className={styles.successText} size={18} />}
          {phase === 'error' && <XCircle className={styles.errorText} size={18} />}
          <span>{statusLabel}</span>
        </div>

        <div className={styles.actionRow}>
          {phase === 'error' && (
            <button
              onClick={() => { didReportSuccessRef.current = false; pollStatus(); }}
              className={styles.retryButton}
            >
              <RefreshCw size={16} />
              {t.btnRetry}
            </button>
          )}
          <button
            onClick={onClose}
            className={styles.backButton}
          >
            <ArrowLeft size={16} />
            {t.btnBack}
          </button>
        </div>
      </div>
    </div>
  );
}
