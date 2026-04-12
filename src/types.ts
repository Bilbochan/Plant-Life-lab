export type GrowthStage = 'Seed' | 'Sprout' | 'Seedling' | 'Vegetative' | 'Flowering' | 'Fruit';

export interface GameState {
  day: number;
  health: number;
  stage: GrowthStage;
  glucose: number;
  waterLevel: number;
  isDayTime: boolean;
  sunlightIntensity: number; // 0 to 100
  temperature: number; // in Celsius
  pestInfestation: number; // 0 to 100
  missedRespiration: number;
  missedPhotosynthesis: number;
  photoDoneToday: boolean;
  calvinDoneToday: boolean;
  respDoneToday: boolean;
  weather: 'Sunny' | 'Cloudy' | 'Rainy';
  // Resource tracking for particles
  waterConsumed: number;
  lightConsumed: number;
  co2Consumed: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  color: string;
  size: number;
}
