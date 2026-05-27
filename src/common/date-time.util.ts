const DEFAULT_BUSINESS_TIME_ZONE = 'America/Lima';

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function getDateTimeParts(
  date: Date,
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE,
): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((item) => item.type === type)?.value;
    if (!part) {
      throw new Error(`Could not resolve ${type} for timezone ${timeZone}`);
    }
    return part;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

export function getBusinessDateTime(
  date: Date = new Date(),
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE,
): { issueDate: string; issueTime: string } {
  const parts = getDateTimeParts(date, timeZone);
  return {
    issueDate: `${parts.year}-${parts.month}-${parts.day}`,
    issueTime: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function getBusinessIsoDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_BUSINESS_TIME_ZONE,
): string {
  return getBusinessDateTime(date, timeZone).issueDate;
}
