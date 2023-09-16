import { endOfTomorrow, formatISO, set, startOfToday } from 'date-fns';

interface Response {
  error: boolean;
  series: DataPoint[];
}

interface DataPoint {
  startDate: string;
  value: number;
  unit: string;
}

let FORTUM_API_BASEURL = 'https://web.fortum.fi/api/v2';

const fetchPrices = async (): Promise<DataPoint[] | null> => {
  const now = formatNoTz(nearestHour);
  const response = await fetch(
    FORTUM_API_BASEURL +
      '/spot-price-anonymous?' +
      new URLSearchParams({
        priceListKey: '77',
        from: formatNoTz(startOfToday()),
        to: formatNoTz(endOfTomorrow()),
      }).toString(),
  );
  if (response.status !== 200) {
    console.error(`Failed to fetch: ${response.status}: ${response.statusText}`);
    return null;
  }
  const data = await response.json<Response>();
  if (data.error) {
    console.error(`API reported and error`);
    console.error(JSON.stringify(data));
    return null;
  }
  // if ('series' in data && Array.isArray(series))
  return data.series.sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const series = await fetchPrices();

// series?.forEach(({ startDate, value, unit }) => {
//   console.log(`${startDate} ${value.toFixed(2)} ${unit}`);
// });

const formatNoTz = (date: Date) => formatISO(date).substring(0, 19);

const nearestHour = set(new Date(), { minutes: 0, seconds: 0, milliseconds: 0 });
