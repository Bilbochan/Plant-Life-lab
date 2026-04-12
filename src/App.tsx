/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  Droplets, 
  Sun, 
  Moon, 
  Thermometer, 
  Bug, 
  Zap, 
  Wind, 
  Cloud, 
  CloudRain,
  Play,
  Info,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GameState, GrowthStage, Particle } from './types';

// --- Sound Service ---
const playSound = (type: 'water' | 'photo' | 'calvin' | 'resp' | 'death' | 'catch') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'catch':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'water':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'photo':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;
    case 'calvin':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    case 'resp':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'death':
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, now); // A2
      osc.frequency.linearRampToValueAtTime(55, now + 1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 1);
      osc.start(now);
      osc.stop(now + 1);
      break;
  }
};

const INITIAL_STATE: GameState = {
  day: 1,
  health: 100.0,
  stage: 'Seed',
  glucose: 30,
  waterLevel: 50,
  isDayTime: true,
  sunlightIntensity: 80,
  temperature: 22,
  pestInfestation: 0,
  missedRespiration: 0,
  missedPhotosynthesis: 0,
  photoDoneToday: false,
  calvinDoneToday: false,
  respDoneToday: false,
  weather: 'Sunny',
  waterConsumed: 0,
  lightConsumed: 0,
  co2Consumed: 0,
};

export default function App() {
  const [gameStarted, setGameStarted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plant-lab-started') === 'true';
    }
    return false;
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [activeProcess, setActiveProcess] = useState<'photo' | 'calvin' | 'resp' | null>(null);
  const [builtEquation, setBuiltEquation] = useState<string[]>([]);
  const [wateringMode, setWateringMode] = useState(false);
  const [sprayingMode, setSprayingMode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef<{x: number, y: number} | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // --- Game Logic ---

  const handleStartGame = () => {
    setGameStarted(true);
    localStorage.setItem('plant-lab-started', 'true');
  };

  const checkDeath = useCallback((state: GameState) => {
    if (state.health <= 0 || state.missedPhotosynthesis >= 5) {
      const reason = state.health <= 0 ? "Starvation / Dehydration" : 
                     "Photosynthetic Deficiency";
      toast.error(`💀 GAME OVER: ${reason}`);
      playSound('death');
      setGameStarted(false);
      localStorage.removeItem('plant-lab-started');
      setGameState(INITIAL_STATE);
      return true;
    }
    return false;
  }, []);

  const updateEnvironment = useCallback(() => {
    setGameState(prev => {
      const isNewDay = !prev.isDayTime;
      let nextDay = prev.day;
      let nextWeather = prev.weather;
      let nextSunlight = prev.sunlightIntensity;
      let nextTemp = prev.temperature;
      let nextPests = prev.pestInfestation;
      let nextHealth = prev.health;
      let nextMissedResp = prev.missedRespiration;
      let nextMissedPhoto = prev.missedPhotosynthesis;

      if (isNewDay) {
        nextDay += 1;
        
        // Random weather
        const rand = Math.random();
        if (rand < 0.6) nextWeather = 'Sunny';
        else if (rand < 0.9) nextWeather = 'Cloudy';
        else nextWeather = 'Rainy';

        // Sunlight intensity based on weather
        if (nextWeather === 'Sunny') nextSunlight = 80 + Math.random() * 20;
        else if (nextWeather === 'Cloudy') nextSunlight = 30 + Math.random() * 30;
        else nextSunlight = 10 + Math.random() * 20;

        // Temperature fluctuations
        nextTemp = 15 + Math.random() * 20; // Base temp
        if (nextWeather === 'Sunny') nextTemp += 5;
        if (!prev.isDayTime) nextTemp -= 5;

        // Pest events
        if (Math.random() < 0.15) {
          nextPests = Math.min(100, nextPests + 20 + Math.random() * 20);
        }

        // Daily penalties: 50% health drop if respiration missed
        if (!prev.respDoneToday) {
          nextMissedResp += 1;
          nextHealth -= (prev.health * 0.5); 
          toast.warning("Respiration missed! 50% health lost.");
        }
        if (!prev.photoDoneToday && prev.isDayTime) {
          nextMissedPhoto += 1;
          nextHealth -= (10 + Math.random() * 10);
        }
        if (!prev.calvinDoneToday && !prev.isDayTime) {
          nextHealth -= (5 + Math.random() * 10);
        }

        // Starvation check
        if (prev.glucose < 10) {
          nextHealth -= 5;
        }

        // Pest damage
        if (nextPests > 0) {
          nextHealth -= (nextPests / 15);
        }

        // Temperature stress
        if (nextTemp > 35 || nextTemp < 10) {
          nextHealth -= 2;
        }

        // Water consumption
        let waterLoss = 10;
        if (nextTemp > 30) waterLoss += 5;
        const nextWater = Math.max(0, prev.waterLevel - waterLoss);
        if (nextWater === 0) nextHealth -= 5;

        const newState = {
          ...prev,
          day: nextDay,
          isDayTime: !prev.isDayTime,
          weather: nextWeather,
          sunlightIntensity: nextSunlight,
          temperature: nextTemp,
          pestInfestation: nextPests,
          waterLevel: nextWater,
          health: parseFloat(Math.max(0, nextHealth).toFixed(1)),
          missedRespiration: nextMissedResp,
          missedPhotosynthesis: nextMissedPhoto,
          photoDoneToday: false,
          calvinDoneToday: false,
          respDoneToday: false,
          stage: getStage(nextDay)
        };

        checkDeath(newState);
        return newState;
      }

      return { ...prev, isDayTime: !prev.isDayTime };
    });
  }, [checkDeath]);

  const handleSkipDay = () => {
    updateEnvironment(); // Toggle to night or next day
    updateEnvironment(); // Toggle again to complete full cycle
    toast.info("Skipped to the next day!");
  };

  const getStage = (day: number): GrowthStage => {
    if (day < 4) return 'Seed';
    if (day < 8) return 'Sprout';
    if (day < 15) return 'Seedling';
    if (day < 25) return 'Vegetative';
    if (day < 35) return 'Flowering';
    return 'Fruit';
  };

  useEffect(() => {
    if (!gameStarted) return;
    const interval = setInterval(updateEnvironment, 30000); // 30s per half-cycle (1 min per day)
    return () => clearInterval(interval);
  }, [gameStarted, updateEnvironment]);

  // --- Rendering ---

  const drawPlant = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { day, isDayTime, weather, stage, health } = gameState;
    const w = canvas.width;
    const h = canvas.height;
    const groundY = h - 60;

    ctx.clearRect(0, 0, w, h);

    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
    if (isDayTime) {
      if (weather === 'Sunny') {
        skyGradient.addColorStop(0, '#7dd3fc');
        skyGradient.addColorStop(1, '#bae6fd');
      } else if (weather === 'Cloudy') {
        skyGradient.addColorStop(0, '#94a3b8');
        skyGradient.addColorStop(1, '#cbd5e1');
      } else {
        skyGradient.addColorStop(0, '#475569');
        skyGradient.addColorStop(1, '#94a3b8');
      }
    } else {
      skyGradient.addColorStop(0, '#0f172a');
      skyGradient.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, w, h);

    // Sun/Moon
    ctx.fillStyle = isDayTime ? (weather === 'Sunny' ? '#facc15' : '#eab308') : '#f1f5f9';
    ctx.beginPath();
    ctx.arc(isDayTime ? w - 80 : 80, 80, 40, 0, Math.PI * 2);
    ctx.fill();
    if (isDayTime && weather === 'Sunny') {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#facc15';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Ground
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, groundY, w, 60);

    // Plant
    const cx = w / 2;
    const isWilted = health < 40;
    const time = Date.now() / 1000;
    const sway = Math.sin(time) * (isWilted ? 2 : 5);
    
    const plantColor = isWilted ? '#713f12' : '#166534';
    const leafColor = isWilted ? '#451a03' : '#15803d';
    const leafHighlight = isWilted ? '#713f12' : '#22c55e';

    if (stage === 'Seed') {
      const seedGrad = ctx.createRadialGradient(cx - 2, groundY - 7, 1, cx, groundY - 5, 8);
      seedGrad.addColorStop(0, '#a16207');
      seedGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = seedGrad;
      ctx.beginPath();
      ctx.ellipse(cx, groundY - 5, 8 + Math.sin(time * 2) * 1, 5 + Math.cos(time * 2) * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Seed crack/sprout hint
      if (day >= 3) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, groundY - 10);
        ctx.lineTo(cx + Math.sin(time) * 2, groundY - 15);
        ctx.stroke();
      }
    } else {
      const growthFactor = (day - 3) * 12; // Faster visual growth
      const height = Math.min(350, 30 + growthFactor);
      
      // Stem with gradient and highlights
      const stemGrad = ctx.createLinearGradient(cx - 10, groundY, cx + 10, groundY);
      stemGrad.addColorStop(0, isWilted ? '#451a03' : '#064e3b');
      stemGrad.addColorStop(0.5, plantColor);
      stemGrad.addColorStop(1, isWilted ? '#451a03' : '#064e3b');
      
      ctx.strokeStyle = stemGrad;
      ctx.lineWidth = stage === 'Sprout' ? 6 : stage === 'Seedling' ? 10 : 16;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(cx, groundY);
      const curveOffset = isWilted ? 40 : 15;
      const swayAmount = sway * (height / 100); // More sway at the top
      ctx.bezierCurveTo(
        cx - curveOffset + swayAmount * 0.3, groundY - height / 3,
        cx + curveOffset + swayAmount * 0.6, groundY - (height * 2) / 3,
        cx + swayAmount, groundY - height
      );
      ctx.stroke();

      // Stem Highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = ctx.lineWidth / 3;
      ctx.beginPath();
      ctx.moveTo(cx + 2, groundY);
      ctx.bezierCurveTo(
        cx - curveOffset + swayAmount * 0.3 + 2, groundY - height / 3,
        cx + curveOffset + swayAmount * 0.6 + 2, groundY - (height * 2) / 3,
        cx + swayAmount + 2, groundY - height
      );
      ctx.stroke();

      // Leaves
      const leafCount = stage === 'Sprout' ? 2 : stage === 'Seedling' ? 4 : stage === 'Vegetative' ? 10 : 16;
      for (let i = 0; i < leafCount; i++) {
        ctx.save();
        const t = (i + 1) / (leafCount + 1);
        // Calculate position along the bezier curve
        const invT = 1 - t;
        const leafX = invT * invT * invT * cx + 
                     3 * invT * invT * t * (cx - curveOffset + swayAmount * 0.3) + 
                     3 * invT * t * t * (cx + curveOffset + swayAmount * 0.6) + 
                     t * t * t * (cx + swayAmount);
        const leafY = invT * invT * invT * groundY + 
                     3 * invT * invT * t * (groundY - height / 3) + 
                     3 * invT * t * t * (groundY - (height * 2) / 3) + 
                     t * t * t * (groundY - height);
        
        ctx.translate(leafX, leafY);
        const rotation = (i % 2 === 0 ? 0.6 : -0.6) + (isWilted ? 0.5 : 0) + (sway * 0.02);
        ctx.rotate(rotation);
        
        // Leaf shape with gradient
        const leafSize = stage === 'Sprout' ? 15 : stage === 'Seedling' ? 25 : 40;
        const leafGrad = ctx.createRadialGradient(0, 0, leafSize * 0.2, 0, 0, leafSize);
        leafGrad.addColorStop(0, leafHighlight);
        leafGrad.addColorStop(1, leafColor);
        ctx.fillStyle = leafGrad;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(leafSize * 0.4, -leafSize * 0.4, leafSize, 0);
        ctx.quadraticCurveTo(leafSize * 0.4, leafSize * 0.4, 0, 0);
        ctx.fill();
        
        // Vein
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(leafSize * 0.8, 0);
        ctx.stroke();
        
        ctx.restore();
      }

      if (stage === 'Flowering' || stage === 'Fruit') {
        const flowerY = groundY - height;
        const flowerX = cx + sway;
        
        // Flower petals
        ctx.fillStyle = isWilted ? '#9d174d' : '#f472b6';
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.translate(flowerX, flowerY);
          ctx.rotate((i * Math.PI * 2) / 5 + time);
          ctx.beginPath();
          ctx.ellipse(12, 0, 10, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        
        // Center
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(flowerX, flowerY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (stage === 'Fruit') {
        ctx.strokeStyle = isWilted ? '#451a03' : '#3f6212';
        ctx.lineWidth = 2;
        
        const drawFruit = (fx: number, fy: number, size: number) => {
          ctx.beginPath();
          ctx.moveTo(cx + sway * (fy/groundY), fy);
          ctx.quadraticCurveTo(cx + fx + sway, fy - 5, cx + fx + sway, fy + 10);
          ctx.stroke();
          
          const fruitGrad = ctx.createRadialGradient(cx + fx + sway - 3, fy + 7, 2, cx + fx + sway, fy + 10, size);
          fruitGrad.addColorStop(0, '#f87171');
          fruitGrad.addColorStop(1, isWilted ? '#7f1d1d' : '#ef4444');
          
          ctx.fillStyle = fruitGrad;
          ctx.beginPath();
          ctx.arc(cx + fx + sway, fy + 10, size, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.arc(cx + fx + sway - size/3, fy + 10 - size/3, size/4, 0, Math.PI * 2);
          ctx.fill();
        };

        drawFruit(-45, groundY - height + 80, 14);
        drawFruit(45, groundY - height + 120, 12);
        drawFruit(-25, groundY - height + 160, 15);
      }

      // Pests (only if sprouted)
      if (gameState.pestInfestation > 0) {
        ctx.fillStyle = '#1c1917';
        for (let i = 0; i < Math.floor(gameState.pestInfestation / 5); i++) {
          ctx.beginPath();
          ctx.arc(cx + (Math.random() - 0.5) * 100, groundY - Math.random() * height, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [gameState]);

  useEffect(() => {
    let frameId: number;
    const render = () => {
      drawPlant();
      frameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameId);
  }, [drawPlant]);

  // --- Mini-game Logic ---

  const spawnParticles = useCallback((mode: 'photo' | 'calvin' | 'resp') => {
    const labels = {
      photo: ['CO2', 'H2O', 'Light', 'O2', 'Glucose'],
      calvin: ['CO2', 'ATP', 'NADPH', 'Glucose', 'RuBP'],
      resp: ['Glucose', 'O2', 'CO2', 'H2O', 'Energy']
    };
    
    const newParticles: Particle[] = [];
    
    // Realistic spawning based on availability
    const addParticle = (label: string, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: Math.random().toString(36).substr(2, 9),
          x: 50 + Math.random() * 500,
          y: 50 + Math.random() * 300,
          vx: (Math.random() - 0.5) * 1.2, // Even slower for easier catching
          vy: (Math.random() - 0.5) * 1.2, 
          label,
          color,
          size: 30 + Math.random() * 10 // Slightly larger visually
        });
      }
    };

    if (mode === 'photo') {
      addParticle('CO2', '#94a3b8', 12); // More particles
      addParticle('H2O', '#3b82f6', Math.max(8, Math.floor(gameState.waterLevel / 8)));
      addParticle('Light', '#facc15', Math.max(8, Math.floor(gameState.sunlightIntensity / 8)));
      addParticle('O2', '#67e8f9', 4);
      addParticle('Glucose', '#f59e0b', 2);
    } else if (mode === 'calvin') {
      addParticle('CO2', '#94a3b8', 10);
      addParticle('ATP', '#a78bfa', gameState.photoDoneToday ? 12 : 4);
      addParticle('NADPH', '#f472b6', gameState.photoDoneToday ? 12 : 4);
      addParticle('Glucose', '#f59e0b', 4);
      addParticle('RuBP', '#10b981', 6);
    } else if (mode === 'resp') {
      addParticle('Glucose', '#f59e0b', Math.max(8, Math.floor(gameState.glucose / 4)));
      addParticle('O2', '#67e8f9', 12);
      addParticle('CO2', '#94a3b8', 4);
      addParticle('H2O', '#3b82f6', 4);
      addParticle('Energy', '#facc15', 4);
    }

    particlesRef.current = newParticles;
  }, [gameState.sunlightIntensity, gameState.waterLevel, gameState.glucose, gameState.photoDoneToday]);

  const animateParticles = useCallback(() => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const type = activeProcess;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(0, 0, w, h);

    // --- Draw Internal Plant View ---
    const cx = w / 2;
    const groundY = h - 40;
    const height = 150;
    
    // Simplified Plant Outline
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, groundY);
    ctx.lineTo(cx, groundY - height);
    ctx.stroke();
    
    // Draw leaves as targets
    ctx.fillStyle = 'rgba(22, 101, 52, 0.2)';
    ctx.beginPath();
    ctx.ellipse(cx - 30, groundY - 80, 25, 15, 0.5, 0, Math.PI * 2);
    ctx.ellipse(cx + 30, groundY - 100, 25, 15, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Internal Flows
    const time = Date.now() / 1000;
    if (type === 'photo') {
      // Water up from roots
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < 3; i++) {
        const y = groundY - ((time * 50 + i * 40) % height);
        ctx.beginPath();
        ctx.arc(cx, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Light into leaves
      ctx.fillStyle = '#facc15';
      const lx = cx + Math.sin(time * 2) * 40;
      const ly = groundY - 120 + Math.cos(time * 2) * 20;
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'calvin') {
      // CO2 into leaves
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i < 3; i++) {
        const x = cx + 60 - ((time * 30 + i * 20) % 40);
        const y = groundY - 100 + Math.sin(time + i) * 10;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Glucose appearing in leaves
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx - 30, groundY - 80, 4, 0, Math.PI * 2);
      ctx.arc(cx + 30, groundY - 100, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'resp') {
      // Glucose moving from leaves to stem
      ctx.fillStyle = '#fbbf24';
      const gy = groundY - height + ((time * 40) % height);
      ctx.beginPath();
      ctx.arc(cx, gy, 3, 0, Math.PI * 2);
      ctx.fill();
      // Energy sparkles
      ctx.fillStyle = '#fef08a';
      for (let i = 0; i < 5; i++) {
        const sx = cx + (Math.random() - 0.5) * 40;
        const sy = groundY - height/2 + (Math.random() - 0.5) * 60;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 20 || p.x > canvas.width - 20) p.vx *= -1;
      if (p.y < 20 || p.y > canvas.height - 20) p.vy *= -1;

      // Draw Highlight if targeted
      if (mousePosRef.current) {
        const dx = p.x - mousePosRef.current.x;
        const dy = p.y - mousePosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < p.size + 40) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + 10, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = 'white';
      ctx.font = `bold ${p.size * 0.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(p.label, p.x, p.y + p.size * 0.2);
    });

    animationFrameRef.current = requestAnimationFrame(animateParticles);
  }, []);

  const handleModalMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleModalClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let closestIdx = -1;
    let minDistance = Infinity;

    particlesRef.current.forEach((p, idx) => {
      const dx = p.x - x;
      const dy = p.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Very generous hit detection: radius + 40px padding
      // Also prioritizes the closest particle to the click
      if (distance < p.size + 40 && distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1) {
      const p = particlesRef.current[closestIdx];
      playSound('catch');
      setBuiltEquation(prev => [...prev, p.label]);
      particlesRef.current.splice(closestIdx, 1);
    }
  };

  const startProcess = (mode: 'photo' | 'calvin' | 'resp') => {
    setActiveProcess(mode);
    setBuiltEquation([]);
    spawnParticles(mode);
    setTimeout(() => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animateParticles();
    }, 100);
  };

  const submitEquation = () => {
    const eq = builtEquation.join(' ');
    let success = false;
    
    if (activeProcess === 'photo') {
      // 6CO2 + 6H2O + Light -> Glucose + 6O2
      const counts = builtEquation.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      if (counts['CO2'] >= 6 && counts['H2O'] >= 6 && counts['Light'] >= 1) {
        success = true;
      }
    } else if (activeProcess === 'calvin') {
      // 3CO2 + 9ATP + 6NADPH -> G3P (Simplified to Glucose for game)
      const counts = builtEquation.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      if (counts['CO2'] >= 3 && counts['ATP'] >= 9 && counts['NADPH'] >= 6) {
        success = true;
      }
    } else if (activeProcess === 'resp') {
      // Glucose + 6O2 -> 6CO2 + 6H2O + Energy
      const counts = builtEquation.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      if (counts['Glucose'] >= 1 && counts['O2'] >= 6) {
        success = true;
      }
    }

    if (success) {
      playSound(activeProcess!);
      setGameState(prev => {
        let healthGain = 0.5;
        let glucoseGain = 0;
        
        if (activeProcess === 'photo') {
          healthGain = 1.0;
          // Photosynthesis (Light Reaction) produces intermediates, not glucose directly in this sim
          // but user said "glucose is only made when photosynthesis is done"
          // We'll interpret "Photosynthesis" as the whole process or just the light part.
          // Let's make Calvin Cycle produce the glucose, but it requires Photo to be done.
        } else if (activeProcess === 'calvin') {
          glucoseGain = 25;
          healthGain = 1.5;
        } else if (activeProcess === 'resp') {
          healthGain = 2.0;
        }

        return {
          ...prev,
          health: parseFloat(Math.min(100, prev.health + healthGain).toFixed(1)),
          glucose: prev.glucose + glucoseGain,
          photoDoneToday: activeProcess === 'photo' ? true : prev.photoDoneToday,
          calvinDoneToday: activeProcess === 'calvin' ? true : prev.calvinDoneToday,
          respDoneToday: activeProcess === 'resp' ? true : prev.respDoneToday,
        };
      });
      toast.success(`${activeProcess?.toUpperCase()} Successful!`);
      setActiveProcess(null);
    } else {
      toast.error("Equation incomplete or incorrect!");
    }
  };

  // --- Actions ---

  const handleWater = () => {
    if (gameState.waterLevel >= 100) {
      toast.info("Soil is already saturated!");
      return;
    }
    setGameState(prev => ({
      ...prev,
      waterLevel: Math.min(100, prev.waterLevel + 25),
      health: parseFloat(Math.min(100, prev.health + 0.5).toFixed(1))
    }));
    playSound('water');
    toast.success("Watered the plant!");
  };

  const handleSpray = () => {
    if (gameState.pestInfestation === 0) {
      toast.info("No pests detected!");
      return;
    }
    setGameState(prev => ({
      ...prev,
      pestInfestation: 0,
      health: parseFloat(Math.min(100, prev.health + 0.2).toFixed(1))
    }));
    toast.success("Pests eliminated!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      <Toaster position="top-center" richColors theme="dark" />
      <AnimatePresence>
        {!gameStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4"
          >
            <div className="max-w-md w-full text-center space-y-8">
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <Sun className="w-16 h-16 text-emerald-400 animate-pulse" />
                </div>
                <h1 className="text-5xl font-black tracking-tighter text-emerald-400 uppercase italic">
                  Plant Life Lab
                </h1>
                <p className="text-slate-400 text-lg">
                  Master the complex cycles of nature. Photosynthesis, Respiration, and survival against the elements.
                </p>
              </motion.div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleStartGame}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  START SIMULATION
                </button>
                <button 
                  onClick={() => setShowTutorial(true)}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <Info className="w-5 h-5" />
                  HOW TO PLAY
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game UI */}
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Environment</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-1">
                <Thermometer className={cn("w-5 h-5", gameState.temperature > 30 ? "text-orange-400" : "text-blue-400")} />
                <span className="text-sm font-mono">{gameState.temperature.toFixed(1)}°C</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center gap-1">
                {gameState.weather === 'Sunny' && <Sun className="w-5 h-5 text-yellow-400" />}
                {gameState.weather === 'Cloudy' && <Cloud className="w-5 h-5 text-slate-400" />}
                {gameState.weather === 'Rainy' && <CloudRain className="w-5 h-5 text-blue-400" />}
                <span className="text-sm font-mono">{gameState.weather}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Vital Stats</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Health</span>
                  <span>{gameState.health.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${gameState.health}%` }}
                    className={cn("h-full transition-colors", gameState.health < 30 ? "bg-red-500" : "bg-emerald-500")}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Water Level</span>
                  <span>{gameState.waterLevel}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${gameState.waterLevel}%` }}
                    className="h-full bg-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Glucose (Energy)</span>
                  <span>{gameState.glucose}u</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${Math.min(100, gameState.glucose)}%` }}
                    className="h-full bg-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Actions</h2>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={handleWater}
                className="flex items-center gap-3 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-colors text-blue-400 font-bold text-sm"
              >
                <Droplets className="w-5 h-5" />
                WATER PLANT
              </button>
              <button 
                onClick={handleSpray}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm border",
                  gameState.pestInfestation > 0 
                    ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" 
                    : "bg-slate-800 border-slate-700 text-slate-500 opacity-50 cursor-not-allowed"
                )}
              >
                <Bug className="w-5 h-5" />
                PEST SPRAY
              </button>
              <button 
                onClick={handleSkipDay}
                className="flex items-center gap-3 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors text-emerald-400 font-bold text-sm"
              >
                <Zap className="w-5 h-5" />
                SKIP DAY
              </button>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-2">
                {gameState.isDayTime ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="text-sm font-bold uppercase tracking-tighter">Day {gameState.day}</span>
              </div>
              <span className="text-xs font-mono opacity-50">{gameState.stage}</span>
            </div>
          </div>
        </aside>

        {/* Main Simulation Area */}
        <main className="flex-1 relative bg-slate-950 flex flex-col">
          <header className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-start pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 pointer-events-auto">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Daily Checklist</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {gameState.photoDoneToday ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                  <span className={gameState.photoDoneToday ? "text-emerald-500" : "text-slate-400"}>Photosynthesis</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {gameState.calvinDoneToday ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                  <span className={gameState.calvinDoneToday ? "text-emerald-500" : "text-slate-400"}>Calvin Cycle</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {gameState.respDoneToday ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
                  <span className={gameState.respDoneToday ? "text-emerald-500" : "text-slate-400"}>Respiration</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pointer-events-auto">
              <button 
                onClick={() => setShowTutorial(true)}
                className="bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-emerald-400 hover:bg-slate-800 transition-colors"
              >
                <Info className="w-5 h-5" />
              </button>
              {gameState.pestInfestation > 0 && (
                <div className="bg-red-500/20 border border-red-500/40 p-3 rounded-xl flex items-center gap-2 text-red-400 text-xs font-bold animate-bounce">
                  <AlertTriangle className="w-4 h-4" />
                  PEST INFESTATION!
                </div>
              )}
              {gameState.sunlightIntensity < 40 && gameState.isDayTime && (
                <div className="bg-amber-500/20 border border-amber-500/40 p-3 rounded-xl flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <Cloud className="w-4 h-4" />
                  LOW LIGHT INTENSITY
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 flex items-center justify-center p-8">
            <div className="relative w-full max-w-3xl aspect-[4/3] bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden">
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={600} 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <footer className="p-6 bg-slate-900/50 border-t border-slate-800 flex justify-center gap-4">
            <button 
              disabled={!gameState.isDayTime || gameState.photoDoneToday}
              onClick={() => startProcess('photo')}
              className={cn(
                "px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                gameState.isDayTime && !gameState.photoDoneToday
                  ? "bg-emerald-500 text-slate-950 hover:scale-105"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              <Sun className="w-4 h-4" />
              PHOTOSYNTHESIS
            </button>
            <button 
              disabled={gameState.isDayTime || gameState.calvinDoneToday}
              onClick={() => startProcess('calvin')}
              className={cn(
                "px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                !gameState.isDayTime && !gameState.calvinDoneToday
                  ? "bg-amber-500 text-slate-950 hover:scale-105"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              <Moon className="w-4 h-4" />
              CALVIN CYCLE
            </button>
            <button 
              disabled={gameState.respDoneToday}
              onClick={() => startProcess('resp')}
              className={cn(
                "px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2",
                !gameState.respDoneToday
                  ? "bg-blue-500 text-slate-950 hover:scale-105"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              <Zap className="w-4 h-4" />
              RESPIRATION
            </button>
          </footer>
        </main>
      </div>

      {/* Process Modal */}
      <AnimatePresence>
        {activeProcess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/95 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 w-full max-w-3xl rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter text-emerald-400">
                    {activeProcess === 'photo' ? 'Photosynthesis' : activeProcess === 'calvin' ? 'Calvin Cycle' : 'Cellular Respiration'}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    {activeProcess === 'photo' ? 'Collect: 6 CO2 + 6 H2O + 1 Light' : 
                     activeProcess === 'calvin' ? 'Collect: 3 CO2 + 9 ATP + 6 NADPH' : 
                     'Collect: 1 Glucose + 6 O2'}
                  </p>
                </div>
                <button 
                  onClick={() => setActiveProcess(null)}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="relative aspect-video bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                  <canvas 
                    ref={modalCanvasRef}
                    width={600}
                    height={400}
                    onClick={handleModalClick}
                    onMouseMove={handleModalMouseMove}
                    onMouseLeave={() => { mousePosRef.current = null; }}
                    className="w-full h-full cursor-crosshair"
                  />
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 min-h-[4rem] flex flex-wrap gap-2 items-center">
                    {builtEquation.map((item, i) => (
                      <motion.span 
                        key={i}
                        initial={{ scale: 0, x: -10 }}
                        animate={{ scale: 1, x: 0 }}
                        className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg font-mono font-bold"
                      >
                        {item}
                      </motion.span>
                    ))}
                    {builtEquation.length === 0 && (
                      <span className="text-slate-600 font-mono italic">Equation will appear here...</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setBuiltEquation([])}
                        className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all"
                      >
                        CLEAR
                      </button>
                      <button 
                        onClick={submitEquation}
                        className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                      >
                        ACTIVATE PROCESS
                      </button>
                    </div>
                    <button 
                      onClick={() => {
                        setGameState(prev => ({
                          ...prev,
                          health: parseFloat(Math.max(0, prev.health - 15).toFixed(1)),
                          [activeProcess === 'photo' ? 'photoDoneToday' : activeProcess === 'calvin' ? 'calvinDoneToday' : 'respDoneToday']: true
                        }));
                        setActiveProcess(null);
                        toast.success("Process skipped at health cost.");
                      }}
                      className="w-full py-3 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 font-bold rounded-xl border border-amber-500/20 transition-all text-sm"
                    >
                      FAST-TRACK PROCESS ( -15 HEALTH )
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutorial Modal */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/95 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-slate-900 w-full max-w-lg rounded-[2rem] border border-slate-800 p-8 space-y-6"
            >
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-emerald-400">Lab Manual</h2>
                <div className="space-y-4 text-slate-400 leading-relaxed">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 font-bold">1</div>
                    <p><strong>Photosynthesis:</strong> Collect 6 CO2, 6 H2O, and 1 Light. Produces Oxygen and Glucose precursors. Only possible during the day.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 font-bold">2</div>
                    <p><strong>Calvin Cycle:</strong> Collect 3 CO2, 9 ATP, and 6 NADPH. This converts precursors into Glucose!</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 font-bold">3</div>
                    <p><strong>Respiration:</strong> Collect 1 Glucose and 6 O2. Essential for survival! Health drops 50% if missed.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 font-bold">4</div>
                    <p><strong>Growth:</strong> Your plant grows through 6 stages: Seed, Sprout, Seedling, Vegetative, Flowering, and Fruit.</p>
                  </div>
                </div>
              <button 
                onClick={() => setShowTutorial(false)}
                className="w-full py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl"
              >
                UNDERSTOOD
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
