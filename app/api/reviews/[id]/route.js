import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    views: row.view_count || 0,
    status: row.status,
  };
}

export async function GET(request, { params }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const incrementView = searchParams.get("incrementView") === "1";

    let rows = await supabaseRest("/reviews", {
      query: {
        select: "id,name,email,title,content,created_at,view_count,status",
        id: `eq.${params.id}`,
        status: "eq.published",
        limit: 1,
      },
    });

    let row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ ok: false, message: "후기를 찾을 수 없습니다." }, { status: 404 });
    }

    if (incrementView) {
      const updated = await supabaseRest(`/reviews?id=eq.${params.id}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: { view_count: Number(row.view_count || 0) + 1 },
      });
      row = Array.isArray(updated) ? updated[0] : row;
    }

    const comments = await supabaseRest("/review_comments", {
      query: {
        select: "id,name,content,created_at,review_id",
        review_id: `eq.${params.id}`,
        order: "created_at.asc",
      },
    }).catch(() => []);

    return NextResponse.json({ ok: true, review: mapReview(row), comments: Array.isArray(comments) ? comments : [] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "후기 상세를 불러오지 못했습니다." }, { status: 500 });
  }
}
