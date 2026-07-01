/* eslint-disable @typescript-eslint/no-explicit-any */
import { BarChart3, Camera, Keyboard, Loader2 } from 'lucide-react';
import { detectUserType } from '@/utils/detectUserType';

export function WelcomeScreen(props: any) {
  const { t, studentId, loading, rankingsLoading, handleStudentIdChange, lookupUserStatus, handleScanStudentId, loadRankings } = props;
  const canLookup = detectUserType(studentId) !== 'unknown';

  return (
    <div className="section checkin-welcome-section">
      <p className="checkin-hero-prompt">{t.heroPrompt}</p>

      <div className="checkin-form-panel">
        <div className="form-group">
          <label className="label">{t.labelStudentId}</label>
          <div className="input-with-action">
            <input
              type="text"
              className="input-text input-with-action-control"
              placeholder={t.placeholderId}
              value={studentId}
              onChange={(e) => handleStudentIdChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookupUserStatus(studentId);
              }}
            />
            <button
              type="button"
              className={`lookup-icon-button ${canLookup ? 'is-active' : 'is-disabled'}`}
              onClick={() => lookupUserStatus(studentId)}
              disabled={loading || !canLookup}
            >
              {loading ? <Loader2 className="spinner" size={20} /> : <Keyboard size={20} />}
            </button>
          </div>
        </div>

        <div className="checkin-divider">
          <div className="checkin-divider-line" />
          <span className="checkin-divider-label">{t.or}</span>
          <div className="checkin-divider-line" />
        </div>

        <div className="btn-group checkin-main-actions">
          <button className="btn btn-primary button-fill" onClick={handleScanStudentId} disabled={loading}>
            <Camera size={24} />
            {t.btnScan}
          </button>
          <button className="btn btn-secondary button-fill" onClick={loadRankings} disabled={rankingsLoading}>
            {rankingsLoading ? <Loader2 className="spinner" size={20} /> : <BarChart3 size={22} />}
            {t.btnRankings}
          </button>
        </div>
      </div>
    </div>
  );
}
