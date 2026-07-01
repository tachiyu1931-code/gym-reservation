/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, Trophy } from 'lucide-react';

export function RankingsScreen(props: any) {
  const { t, rankings, formatMessage, handleReset } = props;
  const rankingSections = [
    { title: t.monthlyRanking, rows: rankings?.monthly ?? [], unit: 'minutes' },
    { title: t.streakRanking, rows: rankings?.streaks ?? [], unit: 'days' },
  ];

  return (
    <div className="section rankings-section">
      <h2 className="screen-title-with-icon">
        <Trophy size={24} />
        {t.rankingsTitle}
      </h2>
      <div className="ranking-grid">
        {rankingSections.map((section) => (
          <div key={section.title} className="ranking-card">
            <h3 className="ranking-card-title">{section.title}</h3>
            {section.rows.length === 0 ? (
              <p className="muted-text">{t.noRankingData}</p>
            ) : (
              <div className="ranking-list">
                {section.rows.map((row: any) => (
                  <div key={section.title + row.rank + row.user_code_suffix} className="ranking-row">
                    <span className="muted-text">#{row.rank}</span>
                    <span className="ranking-name">{row.name}</span>
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
      <button className="btn btn-secondary rankings-back-button" onClick={handleReset}>
        <ArrowLeft size={18} />
        {t.btnBack}
      </button>
    </div>
  );
}
