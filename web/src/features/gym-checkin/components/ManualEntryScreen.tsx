/* eslint-disable @typescript-eslint/no-explicit-any */
import { Keyboard, Loader2 } from 'lucide-react';
import { cleanName } from '@/utils/cleansing';
import { detectUserType } from '@/utils/detectUserType';

export function ManualEntryScreen(props: any) {
  const {
    t, userType, studentId, name, department, grade, className, dynamicDepartments, deptToClassesMap,
    loading, handleCheckInOrOut, handleStudentIdChange, lookupUserStatus, setName, handleDepartmentChange,
    setGrade, setClassName, getAvailableGradesForDepartment, gradeLabelKeys, handleReset,
  } = props;
  const canLookup = detectUserType(studentId) !== 'unknown';

  return (
    <div className="section manual-entry-section">
      <div className="manual-entry-heading">
        <h2 className="manual-entry-title">
          {t.btnIn}{userType ? '(' : ''}{userType === 'student' ? t.student : userType === 'staff' ? t.staff : ''}{userType ? ')' : ''}
        </h2>
        <p className="manual-entry-caption">{t.welcomeIn}</p>
      </div>

      <form onSubmit={handleCheckInOrOut} className="manual-entry-form">
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
                if (e.key === 'Enter' && canLookup) lookupUserStatus(studentId);
              }}
            />
            <button
              type="button"
              className={`lookup-icon-button ${canLookup ? 'is-active' : 'is-disabled'}`}
              onClick={() => canLookup && lookupUserStatus(studentId)}
              disabled={!canLookup || loading}
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
          <div className="manual-entry-fields-row">
            <div className="form-group manual-entry-department-field">
              <label className="label">{t.labelDept}</label>
              <select className="select-box" value={department} onChange={(e) => handleDepartmentChange(e.target.value)}>
                <option value="">{t.selectDefault}</option>
                {dynamicDepartments.map((dept: string, index: number) => (
                  <option key={index} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="form-group manual-entry-grade-field">
              <label className="label">{t.labelGrade}</label>
              <select className="select-box" value={grade} onChange={(e) => { setGrade(e.target.value); setClassName(''); }} disabled={!department}>
                <option value="">{t.selectDefault}</option>
                {getAvailableGradesForDepartment(department).map((g: string, index: number) => (
                  <option key={index} value={g}>{t[gradeLabelKeys[g]] ?? g}</option>
                ))}
              </select>
            </div>

            <div className="form-group manual-entry-class-field">
              <label className="label">{t.labelClass}</label>
              <select className="select-box" value={className} onChange={(e) => setClassName(e.target.value)} disabled={!department || !grade}>
                <option value="">{t.selectDefault}</option>
                {(() => {
                  const gradeNum = parseInt(grade?.charAt(0) || '0', 10);
                  const allClasses = deptToClassesMap[department] || [];
                  const filtered = allClasses.filter((c: any) => c.grade === gradeNum);
                  return filtered.length > 0
                    ? filtered.map((c: any) => (
                        <option key={String(c.grade) + '-' + c.class_name} value={c.class_name}>{c.class_name}</option>
                      ))
                    : <option value="" disabled>{t.classUnregistered}</option>;
                })()}
              </select>
            </div>
          </div>
        )}
        <div className="btn-group manual-entry-actions">
          <button type="button" className="btn btn-secondary button-fill" onClick={handleReset} disabled={loading}>{t.btnCancel}</button>
          <button type="submit" className="btn btn-primary button-fill" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : t.btnCheckin}
          </button>
        </div>
      </form>
    </div>
  );
}
