/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function CheckInConfirmScreen(props: any) {
  const { t, name, userType, department, grade, className, gradeLabelKeys, loading, handleReset, handleCheckInOrOut, adjustedCheckoutNotice, formatDisplayName } = props;
  const checkinButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    checkinButtonRef.current?.focus();
  }, []);
  return (
    <div className="section confirm-section">
      <h2 className="confirm-subtitle">{t.messagesOfSupport}</h2>
      <p className="success-name">{formatDisplayName(name, t.personSuffix)}</p>
      {userType === 'student' && (
        <p className="confirm-meta">
          {department} / {gradeLabelKeys[grade] ? t[gradeLabelKeys[grade]] : grade} / {className}
        </p>
      )}
      {adjustedCheckoutNotice ? (
        <p className="confirm-message" style={{ color: 'var(--accent)', marginBottom: 12 }}>
          {adjustedCheckoutNotice}
        </p>
      ) : (
        <p className="confirm-message">{t.welcomeMessage}</p>
      )}
      <div className="btn-group">
        <button className="btn btn-secondary button-fill" onClick={handleReset} disabled={loading}>
          {t.btnCancel}
        </button>
        <button className="btn btn-primary button-fill" onClick={() => handleCheckInOrOut()} disabled={loading}>
          {loading ? <Loader2 className="spinner" size={20} /> : t.btnCheckin}
        </button>
      </div>
    </div>
  );
}
