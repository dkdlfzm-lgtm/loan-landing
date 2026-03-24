import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isSupabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function mapReview(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    views: row.view_count || 0,
    status: row.status,
    commentCount: row.comment_count || 0,
  };
}

export async function GET(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, reviews: [], source: "missing-supabase" });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || 20);
  const queryText = searchParams.get("q") || "";

  try {
    const rows = await supabaseRest("/reviews", {
      query: {
        select: "id,name,email,title,content,created_at,view_count,status",
        status: "eq.published",
        order: "created_at.desc",
        limit,
      },
    });

    let filtered = Array.isArray(rows) ? rows : [];
    if (queryText.trim()) {
      const keyword = queryText.trim().toLowerCase();
      filtered = filtered.filter((row) =>
        [row.title, row.content, row.name].some((field) => String(field || "").toLowerCase().includes(keyword))
      );
    }

    const comments = await supabaseRest("/review_comments", {
      query: { select: "review_id" },
    }).catch(() => []);
    const commentCountMap = {};
    for (const item of comments || []) {
      commentCountMap[item.review_id] = (commentCountMap[item.review_id] || 0) + 1;
    }

    const reviews = filtered.map((row) => mapReview({ ...row, comment_count: commentCountMap[row.id] || 0 }));
    return NextResponse.json({ ok: true, reviews });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "이용후기를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { name, email, password, title, content } = body || {};

    if (![name, email, password, title, content].every((value) => String(value || "").trim())) {
      return NextResponse.json({ ok: false, message: "모든 항목을 입력해주세요." }, { status: 400 });
    }

    const inserted = await supabaseRest("/reviews", {
      method: "POST",
      prefer: "return=representation",
      body: [{
        name: String(name).trim(),
        email: String(email).trim(),
        password_hash: hashPassword(password),
        title: String(title).trim(),
        content: String(content).trim(),
        status: "published",
      }],
    });

    const row = Array.isArray(inserted) ? inserted[0] : inserted;
    return NextResponse.json({ ok: true, review: mapReview(row) });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error.message || "이용후기를 등록하지 못했습니다." }, { status: 500 });
  }
}
