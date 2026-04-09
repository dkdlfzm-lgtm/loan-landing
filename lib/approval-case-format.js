export function buildApprovalCaseContent(currentLoans, approvalResult) {
  const current = String(currentLoans || "").trim();
  const approval = String(approvalResult || "").trim();
  return [`이용중: ${current}`, `승인: ${approval}`].filter((v) => !v.endsWith(': ')).join("\n");
}

export function parseApprovalCase(review) {
  const rawName = String(review?.name || review?.title || "").trim();
  const rawContent = String(review?.content || "").replace(/\r/g, "");
  const lines = rawContent.split("\n").map((line) => line.trim()).filter(Boolean);

  let currentLoan = "";
  let approvalResult = "";

  for (const line of lines) {
    if (!currentLoan && /^이용중\s*:/i.test(line)) {
      currentLoan = line.replace(/^이용중\s*:/i, "").trim();
      continue;
    }
    if (!approvalResult && /^승인\s*:/i.test(line)) {
      approvalResult = line.replace(/^승인\s*:/i, "").trim();
      continue;
    }
  }

  if (!currentLoan && lines.length >= 1) currentLoan = lines[0].replace(/^이용중\s*:/i, "").trim();
  if (!approvalResult && lines.length >= 2) approvalResult = lines.slice(1).join(" ").replace(/^승인\s*:/i, "").trim();

  return {
    id: review?.id,
    customerName: rawName,
    currentLoan,
    approvalResult,
    status: review?.status,
    createdAt: review?.created_at || review?.createdAt,
    viewCount: Number(review?.view_count || review?.views || 0),
  };
}

export function mapReviewToApprovalCard(review) {
  const parsed = parseApprovalCase(review);
  return {
    id: parsed.id,
    title: parsed.customerName,
    content: [parsed.currentLoan, parsed.approvalResult].filter(Boolean).join("\n"),
    customerName: parsed.customerName,
    currentLoan: parsed.currentLoan,
    approvalResult: parsed.approvalResult,
    name: parsed.customerName,
    lines: [parsed.currentLoan, parsed.approvalResult].filter(Boolean),
  };
}
