export function formatReviewDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function formatReviewDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${formatReviewDate(value)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function maskEmail(email) {
  if (!email) return "-";
  const [id, domain] = String(email).split("@");
  if (!domain) return email;
  const masked = id.length <= 2 ? `${id[0] || ""}*` : `${id.slice(0, 2)}***`;
  return `${masked}@${domain}`;
}

export function maskName(name) {
  const text = String(name || "").trim();
  if (!text) return "고객님";
  if (text.length === 1) return `${text}*`;
  if (text.length === 2) return `${text[0]}*`;
  return `${text[0]}${"*".repeat(Math.max(1, text.length - 2))}${text[text.length - 1]}`;
}
