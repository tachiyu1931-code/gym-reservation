/** IndexedDB に一時保存するオフラインログのスキーマ */
export interface OfflineLog {
  id?: number;           // ローカル自動連番（主キー）
  student_id: string;   // 学籍番号
  name: string;          // 氏名
  department: string;    // 学科
  grade: string;         // 学年
  class_name: string;    // クラス名（例: A組）
  is_staff: boolean;     // 教職員フラグ
  checked_in_at: string; // チェックイン時刻 (ISO 8601)
  action: 'checkin' | 'checkout'; // 操作種別
}

const DB_NAME = 'JimReserveOfflineStore';
const STORE_NAME = 'offline_logs';
const DB_VERSION = 2; // class_name / action フィールド追加に伴いバージョンアップ

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // v1 → v2: オブジェクトストアを再作成して新フィールドに対応
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
  });
}

export async function saveOfflineLog(log: Omit<OfflineLog, 'id'>): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(log);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getOfflineLogs(): Promise<OfflineLog[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteOfflineLog(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
