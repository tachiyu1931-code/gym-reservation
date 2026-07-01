/* eslint-disable @typescript-eslint/no-explicit-any */
﻿import { CheckCircle, Loader2 } from 'lucide-react';

export function SuccessScreen(props: any) {
  const { t, successType, scannedName, successMessage, successStats, successDuration, checkoutNotice, formatMessage, formatDisplayName } = props;

  return (
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
      <p className="muted-text">{successMessage || (successType === 'checkout' ? t.msgCheckout : t.msgCheckin)}</p>
      {successType === 'checkin' && successStats && (
        <p className="success-detail-text">{formatMessage(t.monthlyUsageSummary, { minutes: successStats.monthly_usage_minutes })}</p>
      )}
      {successType === 'checkout' && successDuration !== null && (
        <p className="success-detail-text">{formatMessage(t.usageDuration, { minutes: successDuration })}</p>
      )}
      {successType === 'checkout' && successStats && (
        <p className="success-streak-text">{formatMessage(t.streakSummary, { days: successStats.consecutive_days })}</p>
      )}
      {checkoutNotice && <p className="checkout-notice-text">{checkoutNotice}</p>}
      <div className="success-auto-back">
        <Loader2 className="spinner" size={16} />
        <span>{t.autoBack}</span>
      </div>
    </div>
  );
}
