export const maskEmail = (input) => {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed || !trimmed.includes("@")) {
    return null;
  }

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) {
    return null;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const visible = local.slice(0, Math.min(2, local.length));
  const masked = `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}${domain}`;
  return masked;
};
