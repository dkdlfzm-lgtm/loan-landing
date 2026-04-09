export function parseApprovalCase(review) {
  const title = String(review?.title || review?.name || "").trim();
  const rawContent = String(review?.content || "").replace(/\r/g, "").trim();
  const lines = rawContent
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  return {
    id: review?.id || `case-${Math.random().toString(36).slice(2, 9)}`,
    title,
    content: rawContent,
    lines,
  };
}

export function mapReviewToApprovalCard(review) {
  const parsed = parseApprovalCase(review);
  return {
    id: parsed.id,
    title: parsed.title,
    content: parsed.content,
    lines: parsed.lines,
  };
}
