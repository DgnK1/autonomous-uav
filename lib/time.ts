const PH_LOCALE = "en-PH";
const PH_TIME_ZONE = "Asia/Manila";

const dateTimeFormatter = new Intl.DateTimeFormat(PH_LOCALE, {
  timeZone: PH_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(PH_LOCALE, {
  timeZone: PH_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(PH_LOCALE, {
  timeZone: PH_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const phDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function normalizeDate(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    const parsed = new Date(value.getTime());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTimePH(value: unknown): string {
  const parsed = normalizeDate(value);
  return parsed ? dateTimeFormatter.format(parsed) : "-";
}

export function formatDatePH(value: unknown): string {
  const parsed = normalizeDate(value);
  return parsed ? dateFormatter.format(parsed) : "-";
}

export function formatTimePH(value: unknown): string {
  const parsed = normalizeDate(value);
  return parsed ? timeFormatter.format(parsed) : "-";
}

export function formatRelativeDateTimeLabelPH(value: unknown): string {
  const parsed = normalizeDate(value);
  if (!parsed) {
    return "-";
  }

  const todayKey = phDateKeyFormatter.format(new Date());
  const valueKey = phDateKeyFormatter.format(parsed);

  return todayKey === valueKey ? formatTimePH(parsed) : formatDateTimePH(parsed);
}
