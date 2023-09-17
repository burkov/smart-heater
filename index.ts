import {
  addDays,
  addHours,
  compareAsc,
  differenceInMinutes,
  endOfTomorrow,
  format,
  formatISO,
  getHours,
  isAfter,
  isEqual,
  parseISO,
  set,
  startOfHour,
  startOfToday,
} from 'date-fns';
import {z, ZodError, ZodString} from 'zod';

//@ts-ignore
import {GroveLCDRGB} from './grove-lcd';
import os from 'os'

const zodFetch = async <TData>(schema: { parse: (o: any) => TData }, url: string, params?: Record<string, string>) => {
  const urlWithParams = params ? url + '?' + new URLSearchParams(params) : url;
  const response = await fetch(urlWithParams);
  if (!response.ok) throw new Error(`Failed to fetch, status ${response.status}`);
  const data = await response.json();
  try {
    return schema.parse(data);
  } catch (e) {
    console.log(`Failed to parse data: ${JSON.stringify(data, null, ' ')}`);
    throw e;
  }
};

const priceSchema = z.object({
  startDate: z
    .preprocess<ZodString>((e) => `${e}:00+03:00`, z.string().datetime({offset: true}))
    .transform((e) => parseISO(e)),
  value: z.number(),
  unit: z.string(),
});

const responseSchema = z.object({
  error: z.boolean(),
  series: z.array(priceSchema),
});

type Price = z.infer<typeof priceSchema>;

const FORTUM_API_BASEURL = 'https://web.fortum.fi/api/v2';

/**
 * @param take number of hours to takeI
 * @param daysOffset days offset
 *
 * @throws {Error} on non-200 code or if {error: true}
 */
const fetchPrices = async (daysOffset: number = 0, take: number = 12) => {
  const startFrom = startOfHour(new Date());
  const data = await zodFetch(responseSchema, `${FORTUM_API_BASEURL}/spot-price-anonymous`, {
    priceListKey: '77',
    from: formatISO(addDays(startOfToday(), daysOffset)),
    to: formatISO(addDays(endOfTomorrow(), daysOffset)),
  });
  if (data.error) throw new Error(`Fortum response contains error: ${JSON.stringify(data)}`);
  const sorted = data.series.sort((a, b) => compareAsc(a.startDate, b.startDate));
  return sorted
    .filter(({startDate}) => isAfter(startDate, startFrom) || isEqual(startDate, startFrom))
    .slice(0, take);
};

const brightness = 0x08;

const color = (value: number): [number, number, number] => {
  if (value < 5) return [0x00, brightness, 0x00];
  if (value > 5 && value < 10) return [0x00, 0x00, brightness];
  return [brightness, 0x00, 0x00];
};

const withUnit = (p?: Price) => (p ? `${p.value.toFixed(2)} c` : '?.?? c');

const stats = (prices: Price[]) => {
  if (prices.length === 0) return undefined;
  const current = prices[0];
  return {
    now: withUnit(current),
    next: withUnit(prices[1]),
  };
};

const lcd = os.hostname() === 'malina' ? new GroveLCDRGB() : undefined;

const hourly = (func: () => void) => {
  const now = new Date();
  const nextHour = set(addHours(now, 1), {minutes: 0})
  const diff = differenceInMinutes(nextHour, now);
  console.log(`${formatISO(now)} :: Calling func(), next run in ${diff} minutes`);
  try {
    func();
  } catch (e) {
    console.error('Failed to exec', e);
  }
  setTimeout(() => hourly(func), diff * 60 * 1000);
};


hourly(async () => {
  const hour = getHours(new Date())
  const isDisplayEnabled = hour < 3 || hour > 8;
  isDisplayEnabled ? lcd?.on() : lcd?.off()
  try {
    const series = await fetchPrices();
    const data = stats(series);
    const ts1 = format(series[0].startDate, 'HH:mm')
    const ts2 = format(addHours(series[0].startDate, 1), 'HH:mm')
    if (data) {
      const {now, next} = data;
      const value = series[0].value;
      if (isDisplayEnabled) {
        lcd?.setRGB(...color(value));
        lcd?.setText(`${ts1}: ${now}\n${ts2}: ${next}`);
      }
    }
  } catch (e) {
    console.error(
      `Failed to fetch prices: ${e instanceof ZodError ? JSON.stringify(e.flatten().fieldErrors) : (e as any).message}`,
    );
    if (isDisplayEnabled) {
      lcd?.setRGB(brightness * 2, 0, 0);
      lcd?.setText(`ERROR!`);
    }
  }
});
