'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  type AdminNotification,
} from '@/app/admin/actions';

export default function NotificationBell() {
  const [unreadNotifications, setUnreadNotifications] = useState<AdminNotification[]>([]);
  const [readNotifications, setReadNotifications] = useState<AdminNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = unreadNotifications.length;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const splitNotifications = useCallback((notifications: AdminNotification[]) => {
    setUnreadNotifications(notifications.filter((notification) => !notification.is_read));
    setReadNotifications(notifications.filter((notification) => notification.is_read));
  }, []);

  const refreshNotifications = useCallback(async () => {
    const notifications = await getNotifications();
    splitNotifications(notifications);
  }, [splitNotifications]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const notifications = await getNotifications();
        if (!cancelled) splitNotifications(notifications);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    const intervalId = window.setInterval(() => {
      refreshNotifications().catch((error) => {
        console.error('Failed to refresh notifications:', error);
      });
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshNotifications, splitNotifications]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleMarkRead = async (notification: AdminNotification) => {
    if (notification.is_read || confirmingId !== null) return;

    setConfirmingId(notification.id);
    try {
      await markNotificationRead(notification.id);
      const readAt = new Date().toISOString();
      const updated = { ...notification, is_read: true, read_at: readAt };
      setUnreadNotifications((current) => current.filter((item) => item.id !== notification.id));
      setReadNotifications((current) => [updated, ...current]);
    } finally {
      setConfirmingId(null);
    }
  };

  const sections = useMemo(
    () => [
      { title: '未読', notifications: unreadNotifications, unread: true },
      { title: '既読', notifications: readNotifications, unread: false },
    ],
    [readNotifications, unreadNotifications]
  );

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="notification-bell-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="通知を開く"
        aria-expanded={isOpen}
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="notification-badge">{badgeLabel}</span>}
      </button>

      {isOpen && (
        <div className="notification-popover">
          <div className="notification-popover-header">
            <span>自動退室通知</span>
            <span>{unreadCount}件未読</span>
          </div>

          {isLoading ? (
            <div className="notification-empty">
              <Loader2 className="spinner" size={18} />
              <span>読み込み中...</span>
            </div>
          ) : unreadNotifications.length + readNotifications.length === 0 ? (
            <div className="notification-empty">通知はありません</div>
          ) : (
            <div className="notification-list">
              {sections.map((section) => (
                <div className="notification-section" key={section.title}>
                  <div className="notification-section-title">{section.title}</div>
                  {section.notifications.length === 0 ? (
                    <div className="notification-section-empty">該当なし</div>
                  ) : (
                    section.notifications.map((notification) => (
                      <div
                        className={`notification-row ${section.unread ? 'unread' : 'read'}`}
                        key={notification.id}
                      >
                        <div className="notification-row-main">
                          <span className="notification-student-number">{notification.student_number}</span>
                          <span>{notification.department}</span>
                          <span>{notification.grade}</span>
                          <span>{notification.name}</span>
                        </div>
                        <button
                          type="button"
                          className="notification-confirm-button"
                          onClick={() => handleMarkRead(notification)}
                          disabled={!section.unread || confirmingId === notification.id}
                        >
                          {confirmingId === notification.id ? (
                            <Loader2 className="spinner" size={14} />
                          ) : (
                            <Check size={14} />
                          )}
                          {section.unread ? '確認' : '確認済み'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
