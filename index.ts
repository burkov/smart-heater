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
import { z, ZodError, ZodString } from 'zod';

//@ts-ignore
import { GroveLCDRGB } from './grove-lcd';
import os from 'os';




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

let errorCount = 0;

const hourly = async (func: () => Promise<void>) => {
  const now = new Date();
  const nextHour = set(addHours(now, 1), { minutes: 0 });
  const diff = differenceInMinutes(nextHour, now);
  console.log(`${formatISO(now)} :: Calling func(), next run in ${diff} minutes`);
  try {
    await func();
    errorCount = 0;
    setTimeout(() => hourly(func), diff * 60 * 1000);
  } catch (e) {
    errorCount++;
    console.error(`Failed to exec (${errorCount})`, e);
    setTimeout(() => hourly(func), 1 * 60 * 1000);
  }
  
};

hourly(async () => {
  const hour = getHours(new Date());
  const isDisplayEnabled = hour < 3 || hour > 8;
  isDisplayEnabled ? lcd?.on() : lcd?.off();
  try {
    const series = await fetchPrices();
    const data = stats(series);
    const ts1 = format(series[0].startDate, 'HH:mm');
    const ts2 = format(addHours(series[0].startDate, 1), 'HH:mm');
    if (data) {
      const { now, next } = data;
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
