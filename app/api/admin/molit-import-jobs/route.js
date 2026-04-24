import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../lib/admin-auth";
import { isSupabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validateMonth(value, label) {
  const v = normalizeText(value);
  if (!/^\d{6}$/.test(v)) throw new Error(`${label}은 YYYYMM 형식이어야 합니다.`);
  const month = Number(v.slice(4, 6));
  if (month < 1 || month > 12) throw new Error(`${label}의 월은 01~12 사이여야 합니다.`);
  return v;
}

function githubConfig() {
  return {
    token: process.env.GITHUB_ACTIONS_TOKEN || process.env.GH_ACTIONS_TOKEN || "",
    owner: process.env.GITHUB_ACTIONS_OWNER || process.env.GITHUB_OWNER || "dkdlfzm-lgtm",
    repo: process.env.GITHUB_ACTIONS_REPO || process.env.GITHUB_REPO || "loan-landing",
    ref: process.env.GITHUB_ACTIONS_REF || process.env.GITHUB_REF_NAME || "main",
    workflow: process.env.GITHUB_ACTIONS_WORKFLOW || "molit-import.yml",
  };
}

async function dispatchGithubAction(job) {
  const cfg = githubConfig();
  if (!cfg.token) {
    throw new Error("GITHUB_ACTIONS_TOKEN 환경변수가 없습니다. Vercel 환경변수에 GitHub 토큰을 추가해야 합니다.");
  }

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/actions/workflows/${cfg.workflow}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: cfg.ref,
      inputs: {
        job_id: job.id,
        city: job.city || "ALL",
        district: job.district || "ALL",
        start_month: job.start_month,
        end_month: job.end_month,
        refresh_options: "true",
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Actions 실행 요청 실패: HTTP ${response.status} ${text.slice(0, 500)}`);
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const jobs = await supabaseRest("/molit_import_jobs", {
      query: {
        select: "id,status,city,district,start_month,end_month,total_jobs,processed_jobs,success_jobs,failed_jobs,inserted_rows,skipped_rows,error_count,progress_pct,current_label,last_error,summary,started_at,finished_at,created_at,updated_at",
        order: "created_at.desc",
        limit: "10",
      },
    });

    const jobList = Array.isArray(jobs) ? jobs : [];
    let regions = [];
    if (jobList[0]?.id) {
      regions = await supabaseRest("/molit_import_job_regions", {
        query: {
          select: "id,job_id,no,month,city,district,status,result_label,inserted_rows,skipped_rows,error_count,message,created_at",
          job_id: `eq.${jobList[0].id}`,
          order: "no.asc",
          limit: "500",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      jobs: jobList,
      regions: Array.isArray(regions) ? regions : [],
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message || "적재 작업 상태를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, message: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, message: "Supabase 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  let createdJob = null;

  try {
    const body = await request.json().catch(() => ({}));
    const city = normalizeText(body.city || "ALL") || "ALL";
    const district = normalizeText(body.district || "ALL") || "ALL";
    const startMonth = validateMonth(body.startMonth, "시작월");
    const endMonth = validateMonth(body.endMonth, "종료월");

    if (Number(startMonth) > Number(endMonth)) {
      throw new Error("시작월은 종료월보다 늦을 수 없습니다.");
    }

    const inserted = await supabaseRest("/molit_import_jobs", {
      method: "POST",
      prefer: "return=representation",
      body: [
        {
          status: "queued",
          city,
          district,
          start_month: startMonth,
          end_month: endMonth,
          current_label: "GitHub Actions 실행 대기 중",
          summary: { requested_from: "admin_page" },
        },
      ],
    });

    createdJob = Array.isArray(inserted) ? inserted[0] : inserted;
    if (!createdJob?.id) throw new Error("작업 ID 생성에 실패했습니다.");

    await dispatchGithubAction(createdJob);

    return NextResponse.json({
      ok: true,
      message: "최신 업데이트 작업을 시작했습니다.",
      job: createdJob,
    });
  } catch (error) {
    if (createdJob?.id) {
      try {
        await supabaseRest("/molit_import_jobs", {
          method: "PATCH",
          query: { id: `eq.${createdJob.id}` },
          prefer: "return=minimal",
          body: {
            status: "failed",
            last_error: error?.message || "GitHub Actions 실행 요청 실패",
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      } catch {}
    }

    return NextResponse.json(
      { ok: false, message: error?.message || "최신 업데이트 실행에 실패했습니다." },
      { status: 500 }
    );
  }
}
