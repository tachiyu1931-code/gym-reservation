'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { ScanResult } from '@/lib/scanStudentId';
import { type SupportedLanguage, type TranslationMessages } from '@/lib/translations';


interface ScannerOverlayProps {
  lang: SupportedLanguage;
  t: TranslationMessages; // 親から翻訳メチE��ージを受け取めE
  onScanSuccess: (studentId: string) => void;
  onClose: () => void;
}

export function ScannerOverlay({ lang, t, onScanSuccess, onClose }: ScannerOverlayProps) {
  const [statusText, setStatusText] = useState<string>(t.scanning || '学籍番号を読み取ってぁE��す…');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ラズパイの映像エンドポイント
  const RASPI_HOST = '192.168.3.248';
  const RASPI_PORT = '5000';
  const videoStreamUrl = `http://${RASPI_HOST}:${RASPI_PORT}/scan`;

  const startScanning = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      // Next.jsのAPIルートを叩く。OCR実行
      const res = await fetch('/api/scan', { method: 'POST' });
      const data: ScanResult = await res.json();

      if (data.success && data.studentId) {
        setStatusText(lang === 'ja' ? '読み取り成功！' : 'Scan Successful!');
        onScanSuccess(data.studentId);
      } else {
        setErrorMessage(t.scanReadErr);
        setIsProcessing(false);
      }
    } catch (err) {
      setErrorMessage(t.raspiConnectionErr);
      setIsProcessing(false);
    }
  }, [isProcessing, lang, onScanSuccess, t.raspiConnectionErr, t.scanReadErr]);

  // マウント時に自動でOCRループを開姁E
  useEffect(() => {
    const timer = setTimeout(() => {
      startScanning();
    }, 1000);
    return () => clearTimeout(timer);
  }, [startScanning]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0F19]/95 p-4 text-white">
      {/* ヘッダーエリア */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <div className="text-xl font-black tracking-wider text-[#00E676] italic">
          GYM RESOLVATION
        </div>
        <div className="flex items-center gap-2 bg-[#1A2333] px-3 py-1 rounded-full text-xs">
          <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse"></span>
          <span>LIVE FEED</span>
        </div>
      </div>

      {/* 映像モニター */}
      <div className="relative w-full max-w-3xl aspect-[16/9] bg-black rounded-xl overflow-hidden border border-[#1E293B] shadow-2xl">
        {/* リアルタイムカメラ映僁E*/}
        <img 
          src={videoStreamUrl} 
          alt="Camera feed"
          className="w-full h-full object-cover"
          onError={() => {
            setErrorMessage(t.raspiConnectionErr);
          }}
        />

        {/* ガイド枠オーバーレイ */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* ガイド目安枠 */}
          <div className="relative w-[75%] aspect-[1.586] border-2 border-dashed border-white/20 rounded-xl">
            
            {/* 左上に学籍番号用 ターゲット枠 */}
            <div className="absolute top-[8%] left-[5%] w-[50%] h-[25%] border-2 border-[#00E676] bg-[#00E676]/10 rounded shadow-[0_0_15px_rgba(0,230,118,0.4)]">
              <div className="absolute -top-7 left-0 bg-[#00E676] text-black text-[10px] font-black px-2 py-0.5 rounded-sm whitespace-nowrap">
                学籍番号を合わせてください
              </div>
              {/* 四隅のコーナー */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#00E676]"></div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#00E676]"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#00E676]"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#00E676]"></div>
            </div>

          </div>
        </div>
      </div>

      {/* ステータスと操作ボタン */}
      <div className="mt-6 flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="flex items-center gap-3 text-sm text-gray-300 min-h-[24px]">
          {isProcessing && !errorMessage && <Loader2 className="animate-spin text-[#00E676]" size={18} />}
          <span>{errorMessage || statusText}</span>
        </div>

        <div className="flex gap-4 w-full">
          {errorMessage && (
            <button
              onClick={startScanning}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00E676] hover:bg-[#00C853] text-black font-bold py-2.5 px-4 rounded-xl text-sm transition-all"
            >
              <RefreshCw size={16} />
              {t.btnRetry}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-[#334155] text-gray-300 py-2.5 px-4 rounded-xl text-sm transition-colors border border-[#334155]"
          >
            <ArrowLeft size={16} />
            {t.btnBack}
          </button>
        </div>
      </div>
    </div>
  );
}