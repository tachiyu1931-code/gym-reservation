/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function CheckOutConfirmScreen(props: any) {
  const { t, lang, checkoutLog, name, loading, handleReset, executeCheckOut, formatDisplayName } = props;

  const checkoutButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    checkoutButtonRef.current?.focus();
  }, []);

  return (
    <div className="section confirm-section">
      <h2 className="confirm-subtitle">{t.statusActive}</h2>
      <p className="success-name">{formatDisplayName(checkoutLog.name || name, t.personSuffix)}</p>
      <p className="confirm-meta">{checkoutLog.student_id}</p>
      <p className="confirm-meta confirm-meta-spaced">
        {lang === 'ja' ? 'チェックイン時刻' : 'Checked in'}: {new Date(checkoutLog.checked_in_at).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}
      </p>
      <p className="confirm-message">{t.checkoutConfirm}</p>
      <div className="btn-group">
        <button className="btn btn-secondary button-fill" onClick={handleReset} disabled={loading}>
          {t.btnCancel}
        </button>
        <button
          ref={checkoutButtonRef}
          className="btn btn-primary button-fill"
          onClick={() => executeCheckOut()}
          disabled={loading}
        >
          {loading ? <Loader2 className="spinner" size={20} /> : t.btnCheckout}
        </button>
      </div>
    </div>
  );
}