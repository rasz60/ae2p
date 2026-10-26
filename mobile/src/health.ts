import {
  isHealthDataAvailable,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  type WorkoutProxyTyped,
} from '@kingstinct/react-native-healthkit';

// Apple 건강(HealthKit)에서 운동을 읽는다. 보내는 일은 웹(운동기록)이 자기 로그인으로 한다 — 앱은 읽기만.
// 형식은 운동기록 백엔드의 ingest 형식과 같다 (work-doubt app/src/types.ts 의 IngestWorkout).

export interface IngestWorkout {
  id: string;
  date: string;
  start?: string;
  type: string;
  title?: string;
  distance_m?: number;
  duration_sec?: number;
  calories_kcal?: number;
  avg_heart_rate?: number;
}

const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';

export const healthAvailable = (): boolean => {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
};

// 운동기록 서버는 type 으로 러닝 / 웨이트 / 기타를 나눈다. title 은 기록 목록에 보이는 이름
const TYPES: Partial<Record<WorkoutActivityType, { type: string; title: string }>> = {
  [WorkoutActivityType.running]: { type: 'running', title: '러닝' },
  [WorkoutActivityType.traditionalStrengthTraining]: { type: 'strength', title: '근력 운동' },
  [WorkoutActivityType.functionalStrengthTraining]: { type: 'strength', title: '기능성 근력 운동' },
  [WorkoutActivityType.walking]: { type: 'walking', title: '걷기' },
  [WorkoutActivityType.hiking]: { type: 'hiking', title: '하이킹' },
  [WorkoutActivityType.cycling]: { type: 'cycling', title: '사이클' },
  [WorkoutActivityType.swimming]: { type: 'swimming', title: '수영' },
  [WorkoutActivityType.yoga]: { type: 'yoga', title: '요가' },
  [WorkoutActivityType.highIntensityIntervalTraining]: { type: 'hiit', title: 'HIIT' },
  [WorkoutActivityType.crossTraining]: { type: 'cross_training', title: '크로스 트레이닝' },
};

const meters = (q?: { unit: string; quantity: number }): number | undefined => {
  if (!q || !(q.quantity > 0)) return undefined;
  if (q.unit === 'km') return q.quantity * 1000;
  if (q.unit === 'mi') return q.quantity * 1609.344;
  return q.quantity; // HealthKit 기본 단위 m
};

const kcal = (q?: { unit: string; quantity: number }): number | undefined => {
  if (!q || !(q.quantity > 0)) return undefined;
  return q.unit === 'kJ' ? q.quantity / 4.184 : q.quantity;
};

// 폰의 현지 날짜 (새벽 운동이 UTC 로 전날이 되지 않게)
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const avgHeartRate = async (w: WorkoutProxyTyped): Promise<number | undefined> => {
  try {
    const stat = await w.getStatistic(HEART_RATE, 'count/min');
    return stat?.averageQuantity?.quantity || undefined;
  } catch {
    return undefined; // 심박 권한이 없거나 기록이 없으면 빼고 보낸다
  }
};

const toIngest = async (w: WorkoutProxyTyped): Promise<IngestWorkout> => {
  const known = TYPES[w.workoutActivityType] ?? { type: 'other', title: '운동' };
  return {
    id: w.uuid,
    date: localDate(w.startDate),
    start: w.startDate.toISOString(),
    type: known.type,
    title: known.title,
    distance_m: meters(w.totalDistance),
    duration_sec: w.duration.quantity > 0 ? w.duration.quantity : undefined,
    calories_kcal: kcal(w.totalEnergyBurned),
    avg_heart_rate: await avgHeartRate(w),
  };
};

/** 읽기 권한을 묻는다. 거절해도 iOS 는 알려 주지 않는다 (거절하면 운동이 0개로 읽힌다) */
export const authorizeHealth = async (): Promise<void> => {
  await requestAuthorization({ toRead: ['HKWorkoutTypeIdentifier', HEART_RATE] });
};

/** since 부터의 운동 (오래된 것부터) */
export const readWorkouts = async (since: Date): Promise<IngestWorkout[]> => {
  const samples = await queryWorkoutSamples({ limit: 0, ascending: true, filter: { date: { startDate: since } } });
  return Promise.all(samples.map(toIngest));
};
