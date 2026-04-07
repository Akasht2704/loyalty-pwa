import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
    try {
    const { qrcode } = await request.json();
    const [result] = await db.execute("SELECT * FROM coupons WHERE qr_code = ?", [qrcode]);
    return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}