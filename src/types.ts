export type GrowthStage = 
  | 'Seed'
  | 'Sprout'
  | 'Bigger Sprout'
  | 'Sapling'
  | 'Small Tree'
  | 'Mature Tree'
  | 'Flowering Tree'
  | 'Fruiting Tree';

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
  growthPoints: number; // Progress towards next stage
  windSpeed: number; // 0 to 100
  treeSeed: number; // Seed for consistent random generation
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
  isCaught?: boolean;
}
