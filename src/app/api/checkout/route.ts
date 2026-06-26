import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isUseMock, mockLogs } from '@/lib/mockDb';

const AUTO_CHECKOUT_HOURS = 15; // 自動チェックアウトの基準時間（15時間）

// GET: 学籍番号で「在室中（checked_out_at IS NULL）」の最新ログを取得
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const student_id = searchParams.get('student_id');

    if (!student_id) {
        return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
    }
    if (isUseMock()) {

        // モック環境の自動チェックアウト
        const now = Date.now();
        mockLogs.forEach(l => {
            if (!l.checked_out_at && (now - new Date(l.checked_in_at).getTime()) > AUTO_CHECKOUT_HOURS * 3600000) {
                // 退室時間を「入室時間 + 15時間」に設定
                l.checked_out_at = new Date(new Date(l.checked_in_at).getTime() + AUTO_CHECKOUT_HOURS * 3600000).toISOString();
            }
        });
    } else {
        // Supabaseの自動チェックアウト
        try {
            // 15時間前の基準時刻を計算
            const autoCheckoutTime = new Date(Date.now() - AUTO_CHECKOUT_HOURS * 3600000).toISOString();

            // 15時間以上経過した未退室レコードを一括更新
            await supabase.rpc('auto_checkout_old_logs', {
                auto_checkout_time_threshold: autoCheckoutTime
            });
        } catch (err: any) {
            console.error('Auto-checkout background error:', err);
            //自動チェックアウトの失敗時はログ出力のみにして処理を続行
        }
    }

    //データ取得
    if (isUseMock()) {
        const activeLog = mockLogs.find(
            l => l.student_id === student_id && !l.checked_out_at
        );
        return NextResponse.json({ found: !!activeLog, log: activeLog || null });
    }

    try {
        const { data, error } = await supabase
            .from('usage_logs')
            .select('*')
            .eq('student_id', student_id)
            .is('checked_out_at', null)
            .is('deleted_at', null)   // 論理削除済みを除外
            .order('checked_in_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = 0件は正常
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ found: !!data, log: data || null });
    } catch (error: any) {
        console.error('Database error in /api/checkout:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}

// POST: checked_out_at を更新
export async function POST(request: Request) {
    try {
        const { log_id, checked_out_at } = await request.json();

        if (!log_id || !checked_out_at) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (isUseMock()) {
            const index = mockLogs.findIndex(l => l.id === log_id);
            if (index === -1) {
                return NextResponse.json({ error: 'Log not found' }, { status: 404 });
            }
            mockLogs[index].checked_out_at = checked_out_at;
            return NextResponse.json({ success: true });
        }

        const { error } = await supabase
            .from('usage_logs')
            .update({ checked_out_at })
            .eq('id', log_id)
            .is('checked_out_at', null)  // 二重チェックアウト防止
            .is('deleted_at', null);     // 論理削除済みは対象外

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Database error in /api/checkout:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}