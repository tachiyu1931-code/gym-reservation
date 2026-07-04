import { supabase } from '@/lib/supabase';
import { isUseMock, mockCache, mockDepartments, mockLogs } from '@/lib/mockDb';

const PURGE_AFTER_DAYS = 30;

function isOlderThanPurgeWindow(deletedAt?: string | null) {
  if (!deletedAt) return false;
  return new Date(deletedAt).getTime() < Date.now() - PURGE_AFTER_DAYS * 86400000;
}

export async function purgeOldDeletedRecords() {
  if (isUseMock()) {
    for (let i = mockLogs.length - 1; i >= 0; i -= 1) {
      if (isOlderThanPurgeWindow(mockLogs[i].deleted_at)) mockLogs.splice(i, 1);
    }
    for (let i = mockCache.length - 1; i >= 0; i -= 1) {
      if (isOlderThanPurgeWindow(mockCache[i].deleted_at)) mockCache.splice(i, 1);
    }
    for (let i = mockDepartments.length - 1; i >= 0; i -= 1) {
      if (isOlderThanPurgeWindow(mockDepartments[i].deleted_at)) mockDepartments.splice(i, 1);
    }
    return;
  }

  const { error } = await supabase.rpc('purge_old_deleted_records');
  if (error) throw error;
}
