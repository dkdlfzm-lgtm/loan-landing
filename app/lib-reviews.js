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
  const value = String(name || "").trim();
  if (!value) return "익명";
  if (value.length <= 1) return value;
  if (value.length == 2) return `${value[0]}*`;
  return `${value[0]}*${value[value.length - 1]}`;
}
