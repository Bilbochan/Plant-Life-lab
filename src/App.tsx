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
  AlertTriangle,
  Music,
  Music2
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
  stage: 'Dormant',
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
  growthPoints: 0,
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
  const [processState, setProcessState] = useState<'collecting' | 'animating'>('collecting');
  const [animationStep, setAnimationStep] = useState(0);
  const processStateRef = useRef<'collecting' | 'animating'>('collecting');
  const animationStepRef = useRef(0);
  const activeProcessRef = useRef<'photo' | 'calvin' | 'resp' | null>(null);
  const [builtEquation, setBuiltEquation] = useState<string[]>([]);
  const [wateringMode, setWateringMode] = useState(false);
  const [sprayingMode, setSprayingMode] = useState(false);

  useEffect(() => {
    processStateRef.current = processState;
  }, [processState]);

  useEffect(() => {
    animationStepRef.current = animationStep;
  }, [animationStep]);

  useEffect(() => {
    activeProcessRef.current = activeProcess;
  }, [activeProcess]);

  const [isWatering, setIsWatering] = useState(false);
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);

  const toggleMusic = () => {
    if (!isMusicEnabled) {
      startMusic();
    } else {
      stopMusic();
    }
    setIsMusicEnabled(!isMusicEnabled);
  };

  const startMusic = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // Create a simple ambient drone
    const createDrone = (freq: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      return { osc, gain };
    };

    musicNodesRef.current = [
      createDrone(110, 0.05), // A2
      createDrone(164.81, 0.03), // E3
      createDrone(220, 0.02), // A3
    ];
  };

  const stopMusic = () => {
    musicNodesRef.current.forEach(({ osc, gain }) => {
      if (audioContextRef.current) {
        gain.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 1);
        setTimeout(() => {
          try {
            osc.stop();
          } catch (e) {}
        }, 1000);
      }
    });
    musicNodesRef.current = [];
  };

  useEffect(() => {
    return () => {
      musicNodesRef.current.forEach(({ osc }) => {
        try {
          osc.stop();
        } catch (e) {}
      });
    };
  }, []);

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

        // Growth logic: Growth depends on health and glucose, plus a base daily growth
        let growthGain = 2; // Base growth per day
        if (nextHealth > 50 && prev.glucose > 20) {
          growthGain += 3 + Math.floor(nextHealth / 20);
        } else if (nextHealth > 20) {
          growthGain += 1;
        }

        const nextStage = getStage(nextDay);
        
        if (nextStage !== prev.stage) {
          toast.success(`🌱 STAGE UP: Your plant is now a ${nextStage}!`, {
            icon: '🚀',
            duration: 5000,
          });
        }

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
          growthPoints: prev.growthPoints + growthGain,
          stage: nextStage
        };

        checkDeath(newState);
        return newState;
      }

      return { ...prev, isDayTime: !prev.isDayTime };
    });
  }, [checkDeath]);

  const phaseStartTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const handleSkipPhase = () => {
    elapsedRef.current = 0;
    updateEnvironment();
    toast.info(`Skipped to ${gameState.isDayTime ? 'Night' : 'Morning'}!`);
  };

  const getStage = (day: number): GrowthStage => {
    if (day < 5) return 'Dormant';
    if (day < 10) return 'Silver Tip';
    if (day < 15) return 'Green Tip';
    if (day < 20) return 'Half-inch Green';
    if (day < 25) return 'Tight Cluster';
    if (day < 30) return 'First Pink';
    if (day < 35) return 'First Bloom';
    if (day < 40) return 'Full Bloom';
    if (day < 45) return 'Petal Fall';
    if (day < 50) return 'Fruit Set';
    if (day < 55) return 'Cell Division';
    if (day < 60) return 'Cell Enlargement';
    return 'Maturation';
  };

  useEffect(() => {
    if (!gameStarted) return;

    if (activeProcess !== null) {
      // Paused
      return;
    }

    phaseStartTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const currentElapsed = elapsedRef.current + (now - phaseStartTimeRef.current);
      if (currentElapsed >= 35000) {
        updateEnvironment();
        elapsedRef.current = 0;
        phaseStartTimeRef.current = Date.now();
      }
    }, 1000);

    return () => {
      elapsedRef.current += Date.now() - phaseStartTimeRef.current;
      clearInterval(interval);
    };
  }, [gameStarted, updateEnvironment, activeProcess, gameState.isDayTime]);

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
    
    const now = Date.now();
    let currentElapsed = elapsedRef.current;
    if (activeProcessRef.current === null && gameStarted) {
      currentElapsed += (now - phaseStartTimeRef.current);
    }
    const progress = Math.min(1, currentElapsed / 35000);

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

    // Sun/Moon Arc
    const arcX = w * progress;
    const arcY = groundY - Math.sin(progress * Math.PI) * (h - 100);

    ctx.fillStyle = isDayTime ? (weather === 'Sunny' ? '#facc15' : '#eab308') : '#f1f5f9';
    ctx.beginPath();
    ctx.arc(arcX, arcY, 40, 0, Math.PI * 2);
    ctx.fill();
    if (isDayTime && weather === 'Sunny') {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#facc15';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Clouds
    if (weather === 'Cloudy' || weather === 'Rainy') {
      ctx.fillStyle = weather === 'Rainy' ? '#64748b' : '#f8fafc';
      const drawCloud = (cx: number, cy: number, scale: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 30 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 25 * scale, cy - 15 * scale, 35 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 50 * scale, cy, 25 * scale, 0, Math.PI * 2);
        ctx.fill();
      };
      const cloudOffset = (now / 50) % (w + 200);
      drawCloud(cloudOffset - 100, 100, 1);
      drawCloud((cloudOffset + w / 2) % (w + 200) - 100, 150, 0.8);
      drawCloud((cloudOffset + w * 0.8) % (w + 200) - 100, 80, 1.2);
    }

    // Rain
    if (weather === 'Rainy') {
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      const dropOffset = (now / 5) % h;
      for (let i = 0; i < 50; i++) {
        const rx = (i * 37) % w;
        const ry = (dropOffset + (i * 43) % h) % h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 5, ry + 15);
        ctx.stroke();
      }
    }

    // Watering Animation
    if (isWatering) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      const waterTime = Date.now() / 1000;
      const cx = w / 2;
      for (let i = 0; i < 40; i++) {
        const dropX = cx + (Math.sin(i * 123.45) * 120);
        const dropY = ((waterTime * 600 + i * 25) % 500);
        if (dropY < groundY + 20) {
          ctx.beginPath();
          ctx.moveTo(dropX, dropY);
          ctx.lineTo(dropX - 3, dropY + 12);
          ctx.stroke();
        }
      }
      ctx.restore();
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

    // Growth factor based on growthPoints for "step by step" change
    const height = Math.min(400, 40 + (gameState.growthPoints * 1.8)); 
    
    // Apple tree characteristics
    const isWoody = gameState.day >= 5; // Dormant stage and up are woody
    const trunkColor = isWoody ? (isWilted ? '#451a03' : '#78350f') : plantColor;
    
    // Stem with gradient and highlights
    const stemGrad = ctx.createLinearGradient(cx - 10, groundY, cx + 10, groundY);
    stemGrad.addColorStop(0, isWilted ? '#290f02' : (isWoody ? '#451a03' : '#064e3b'));
    stemGrad.addColorStop(0.5, trunkColor);
    stemGrad.addColorStop(1, isWilted ? '#290f02' : (isWoody ? '#451a03' : '#064e3b'));
    
    ctx.strokeStyle = stemGrad;
    // Stem thickness grows with points
    ctx.lineWidth = Math.min(25, 6 + (gameState.growthPoints / 12));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(cx, groundY);
    const curveOffset = isWilted ? 40 : 15;
    const swayAmount = sway * (height / 100); 
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

    // Helper to get position on stem
    const getStemPos = (t: number) => {
      const invT = 1 - t;
      const x = invT * invT * invT * cx + 
                3 * invT * invT * t * (cx - curveOffset + swayAmount * 0.3) + 
                3 * invT * t * t * (cx + curveOffset + swayAmount * 0.6) + 
                t * t * t * (cx + swayAmount);
      const y = invT * invT * invT * groundY + 
                3 * invT * invT * t * (groundY - height / 3) + 
                3 * invT * t * t * (groundY - (height * 2) / 3) + 
                t * t * t * (groundY - height);
      return { x, y };
    };

    // Draw Buds / Leaves / Flowers / Fruit based on stage
    const drawBud = (x: number, y: number, rotation: number, scale: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      
      if (stage === 'Dormant') {
        ctx.fillStyle = '#451a03'; // Brown tight buds
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (stage === 'Silver Tip') {
        ctx.fillStyle = '#94a3b8'; // Light gray tissue
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (stage === 'Green Tip') {
        ctx.fillStyle = '#22c55e'; // Green tissue
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.ellipse(-2, 0, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (stage === 'Half-inch Green' || stage === 'Tight Cluster' || stage === 'First Pink' || stage === 'First Bloom' || stage === 'Full Bloom' || stage === 'Petal Fall' || stage === 'Fruit Set' || stage === 'Cell Division' || stage === 'Cell Enlargement' || stage === 'Maturation') {
        // Draw Leaves
        const leafSize = Math.min(50, 15 + (gameState.growthPoints / 4));
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

        // Draw Flowers / Fruit on top of leaves if applicable
        if (stage === 'Tight Cluster') {
          ctx.fillStyle = '#166534'; // Green grouped buds
          for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.arc(5 + i*4, -2, 3, 0, Math.PI*2);
            ctx.fill();
          }
        } else if (stage === 'First Pink') {
          ctx.fillStyle = '#f472b6'; // Pink buds
          for(let i=0; i<3; i++) {
            ctx.beginPath();
            ctx.arc(5 + i*5, -3, 4, 0, Math.PI*2);
            ctx.fill();
          }
        } else if (stage === 'First Bloom' || stage === 'Full Bloom') {
          const isKing = stage === 'First Bloom';
          const flowerCount = isKing ? 1 : 3;
          ctx.fillStyle = '#ffffff';
          for(let i=0; i<flowerCount; i++) {
            ctx.save();
            ctx.translate(10 + i*8, -5);
            for(let p=0; p<5; p++) {
              ctx.rotate(Math.PI*2/5);
              ctx.beginPath();
              ctx.ellipse(6, 0, 5, 3, 0, 0, Math.PI*2);
              ctx.fill();
            }
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.restore();
          }
        } else if (stage === 'Petal Fall') {
          ctx.fillStyle = '#facc15'; // Only centers left
          ctx.beginPath();
          ctx.arc(10, -5, 4, 0, Math.PI*2);
          ctx.fill();
        } else if (stage === 'Fruit Set' || stage === 'Cell Division' || stage === 'Cell Enlargement' || stage === 'Maturation') {
          const fruitSize = stage === 'Fruit Set' ? 4 : (stage === 'Cell Division' ? 8 : (stage === 'Cell Enlargement' ? 15 : 25));
          const fruitColor = stage === 'Maturation' ? '#ef4444' : '#4ade80';
          
          ctx.strokeStyle = '#3f6212';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(5, 10);
          ctx.stroke();
          
          const fruitGrad = ctx.createRadialGradient(5, 10, fruitSize * 0.2, 5, 10, fruitSize);
          fruitGrad.addColorStop(0, stage === 'Maturation' ? '#f87171' : '#86efac');
          fruitGrad.addColorStop(1, fruitColor);
          ctx.fillStyle = fruitGrad;
          ctx.beginPath();
          ctx.arc(5, 10, fruitSize, 0, Math.PI*2);
          ctx.fill();
        }
      }
      
      ctx.restore();
    };

    const nodeCount = Math.min(24, 4 + Math.floor(gameState.growthPoints / 6));
    for (let i = 0; i < nodeCount; i++) {
      const t = (i + 1) / (nodeCount + 1);
      const pos = getStemPos(t);
      const rotation = (i % 2 === 0 ? 0.6 : -0.6) + (isWilted ? 0.5 : 0) + (sway * 0.02);
      drawBud(pos.x, pos.y, rotation, 1);
    }

    // Top bud
    const topPos = getStemPos(1);
    drawBud(topPos.x, topPos.y, sway * 0.05, 1.2);

    // Pests (only if sprouted)
    if (gameState.pestInfestation > 0) {
      ctx.fillStyle = '#1c1917';
      for (let i = 0; i < Math.floor(gameState.pestInfestation / 5); i++) {
        ctx.beginPath();
        ctx.arc(cx + (Math.random() - 0.5) * 100, groundY - Math.random() * height, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [gameState, isWatering]);

  useEffect(() => {
    let frameId: number;
    const render = () => {
      drawPlant();
      frameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameId);
  }, [drawPlant]);

  const drawRealisticMolecule = (ctx: CanvasRenderingContext2D, x: number, y: number, type: string, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    
    const createSphereGradient = (color: string, r: number, highlight = '#fff') => {
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      // Slightly more transparent colors as requested
      const alpha = 0.7;
      const toRGBA = (hex: string, a: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      };

      grad.addColorStop(0, highlight);
      grad.addColorStop(0.4, toRGBA(color, alpha));
      grad.addColorStop(1, toRGBA(color, alpha));
      return grad;
    };

    const drawRing = (rx: number, ry: number, sides: number, r: number, color: string) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; // Slightly transparent white bonds
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (i * Math.PI * 2) / sides;
        const px = rx + Math.cos(angle) * r;
        const py = ry + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      for (let i = 0; i < sides; i++) {
        const angle = (i * Math.PI * 2) / sides;
        const px = rx + Math.cos(angle) * r;
        const py = ry + Math.sin(angle) * r;
        // Bright atom colors: C/N (Blue), O (Red)
        let atomColor = '#3b82f6'; // Bright Blue
        if (i % 3 === 2) atomColor = '#ff0000'; // Bright Red
        
        // Smaller atoms as requested
        ctx.fillStyle = createSphereGradient(atomColor, r * 0.3);
        ctx.beginPath(); ctx.arc(px, py, r * 0.3, 0, Math.PI * 2); ctx.fill();
        
        // Small Hydrogen attached (White)
        const hx = px + Math.cos(angle) * r * 0.4;
        const hy = py + Math.sin(angle) * r * 0.4;
        ctx.fillStyle = createSphereGradient('#ffffff', r * 0.15);
        ctx.beginPath(); ctx.arc(hx, hy, r * 0.15, 0, Math.PI * 2); ctx.fill();
      }
    };

    if (type === 'H2O') {
      // Oxygen (Red)
      ctx.fillStyle = createSphereGradient('#ff0000', size * 0.8);
      ctx.beginPath(); ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
      
      // Hydrogens (White)
      ctx.fillStyle = createSphereGradient('#ffffff', size * 0.8);
      ctx.beginPath(); ctx.arc(-size * 1.0, size * 0.6, size * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 1.0, size * 0.6, size * 0.8, 0, Math.PI * 2); ctx.fill();
      
      // Bonds (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = size * 0.2;
      ctx.beginPath(); ctx.moveTo(-size * 0.6, size * 0.4); ctx.lineTo(-size * 0.2, size * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 0.6, size * 0.4); ctx.lineTo(size * 0.2, size * 0.1); ctx.stroke();
    } else if (type === 'CO2') {
      // Carbon (Blue)
      ctx.fillStyle = createSphereGradient('#3b82f6', size * 0.8);
      ctx.beginPath(); ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
      
      // Oxygens (Red)
      ctx.fillStyle = createSphereGradient('#ff0000', size * 0.8);
      ctx.beginPath(); ctx.arc(-size * 1.5, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 1.5, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
      
      // Double Bonds (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = size * 0.15;
      ctx.beginPath(); ctx.moveTo(-size * 1.0, -size * 0.2); ctx.lineTo(-size * 0.4, -size * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size * 1.0, size * 0.2); ctx.lineTo(-size * 0.4, size * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 1.0, -size * 0.2); ctx.lineTo(size * 0.4, -size * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size * 1.0, size * 0.2); ctx.lineTo(size * 0.4, size * 0.2); ctx.stroke();
    } else if (type === 'O2') {
      // Oxygens (Red)
      ctx.fillStyle = createSphereGradient('#ff0000', size * 0.8);
      ctx.beginPath(); ctx.arc(-size * 0.8, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.8, 0, size * 0.8, 0, Math.PI * 2); ctx.fill();
      
      // Double Bond (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = size * 0.2;
      ctx.beginPath(); ctx.moveTo(-size * 0.3, -size * 0.2); ctx.lineTo(size * 0.3, -size * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size * 0.3, size * 0.2); ctx.lineTo(size * 0.3, size * 0.2); ctx.stroke();
    } else if (type === 'Glucose') {
      // Glucose 3D ball-and-stick model
      const r = size * 0.7;
      // Carbon ring (5 carbons + 1 oxygen)
      const ringAtoms = [
        { x: -r, y: -r, type: 'C' },
        { x: r, y: -r, type: 'O' },
        { x: r * 1.5, y: r, type: 'C' },
        { x: 0, y: r * 1.5, type: 'C' },
        { x: -r * 1.5, y: r, type: 'C' }
      ];
      
      // Draw bonds first (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ringAtoms[0].x, ringAtoms[0].y);
      for(let i=1; i<ringAtoms.length; i++) ctx.lineTo(ringAtoms[i].x, ringAtoms[i].y);
      ctx.closePath();
      ctx.stroke();

      // Draw atoms (Uniform size, smaller)
      ringAtoms.forEach(atom => {
        const atomColor = atom.type === 'O' ? '#ff0000' : '#3b82f6'; 
        ctx.fillStyle = createSphereGradient(atomColor, size * 0.3);
        ctx.beginPath(); ctx.arc(atom.x, atom.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
      });

      // Add hydroxyl groups (-OH) and CH2OH tail
      const attachments = [
        { x: r * 1.8, y: -r * 1.2, type: 'OH' },
        { x: r * 2.2, y: r * 1.5, type: 'OH' },
        { x: 0, y: r * 2.5, type: 'OH' },
        { x: -r * 2.2, y: r * 1.5, type: 'OH' },
        { x: -r * 1.5, y: -r * 2.0, type: 'CH2OH' }
      ];
      attachments.forEach(group => {
        if (group.type === 'OH') {
          // Oxygen (Red)
          ctx.fillStyle = createSphereGradient('#ff0000', size * 0.3);
          ctx.beginPath(); ctx.arc(group.x, group.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
          // Hydrogen (White)
          ctx.fillStyle = createSphereGradient('#ffffff', size * 0.3);
          ctx.beginPath(); ctx.arc(group.x + size * 0.2, group.y - size * 0.2, size * 0.3, 0, Math.PI * 2); ctx.fill();
        } else {
          // Carbon (Blue)
          ctx.fillStyle = createSphereGradient('#3b82f6', size * 0.3);
          ctx.beginPath(); ctx.arc(group.x, group.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
          // Oxygen (Red)
          ctx.fillStyle = createSphereGradient('#ff0000', size * 0.3);
          ctx.beginPath(); ctx.arc(group.x - size * 0.4, group.y - size * 0.2, size * 0.3, 0, Math.PI * 2); ctx.fill();
          // Hydrogens (White)
          ctx.fillStyle = createSphereGradient('#ffffff', size * 0.3);
          ctx.beginPath(); ctx.arc(group.x + size * 0.3, group.y + size * 0.2, size * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(group.x - size * 0.5, group.y - size * 0.3, size * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      });
    } else if (type === 'ATP') {
      // Realistic ATP: Adenine + Ribose + Triphosphate
      const r = size * 0.6;
      
      // 1. Adenine (Double Ring)
      ctx.save();
      ctx.translate(-r * 1.5, r * 1.2);
      drawRing(0, 0, 6, r, '#3b82f6');
      drawRing(r * 0.9, 0, 5, r, '#3b82f6');
      ctx.restore();

      // 2. Ribose (Pentagon)
      ctx.save();
      ctx.translate(0, 0);
      drawRing(0, 0, 5, r, '#3b82f6');
      // Ribose Oxygen
      ctx.fillStyle = createSphereGradient('#ff0000', r * 0.6);
      ctx.beginPath(); ctx.arc(0, -r, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // 3. Triphosphate (Curved Chain)
      const pColor = '#f59e0b';
      const pPositions = [
        { x: r * 1.5, y: -r * 0.5 },
        { x: r * 2.5, y: -r * 1.2 },
        { x: r * 3.5, y: -r * 0.8 }
      ];
      
      pPositions.forEach((pos, i) => {
        // Phosphorus
        ctx.fillStyle = createSphereGradient(pColor, r * 0.6);
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2); ctx.fill();
        
        // Oxygens around Phosphorus
        const oOffsets = [{dx:0, dy:r}, {dx:0, dy:-r}, {dx:r, dy:0}];
        oOffsets.forEach(off => {
          ctx.fillStyle = createSphereGradient('#ff0000', r * 0.6);
          ctx.beginPath(); ctx.arc(pos.x + off.dx, pos.y + off.dy, r * 0.6, 0, Math.PI * 2); ctx.fill();
        });

        // Bonds between Phosphates (White)
        if (i > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pPositions[i-1].x, pPositions[i-1].y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      });

      // Bond Ribose to Phosphate (White)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.5); ctx.lineTo(pPositions[0].x, pPositions[0].y); ctx.stroke();

    } else if (type === 'NADPH') {
      // Complex multi-ring structure with consistent colors
      const r = size * 0.5;
      drawRing(-r * 3, -r, 6, r, '#3b82f6');
      drawRing(-r * 3, r, 5, r, '#3b82f6');
      drawRing(0, 0, 5, r, '#3b82f6');
      drawRing(r * 3, -r, 6, r, '#3b82f6');
      drawRing(r * 3, r, 5, r, '#3b82f6');
      // Phosphates
      ctx.fillStyle = createSphereGradient('#f59e0b', r * 0.6);
      ctx.beginPath(); ctx.arc(r * 1.5, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 1.5, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
      // Oxygens
      ctx.fillStyle = createSphereGradient('#ff0000', r * 0.6);
      ctx.beginPath(); ctx.arc(r * 1.5, -r * 0.8, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 1.5, r * 0.8, r * 0.6, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'Light') {
      // Pure yellow light sphere with glow, less white highlight
      ctx.shadowBlur = size * 2;
      ctx.shadowColor = '#facc15';
      ctx.fillStyle = createSphereGradient('#facc15', size, '#ffeb3b');
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Default fallback
      ctx.fillStyle = createSphereGradient('#94a3b8', size);
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
    }

    // Add Label (Always visible as requested)
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.font = `bold ${Math.max(12, size * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'black';
    ctx.fillText(type, 0, size * 1.5);
    ctx.shadowBlur = 0;
    
    ctx.restore();
  };

  const spawnParticles = useCallback((mode: 'photo' | 'calvin' | 'resp') => {
    const labels = {
      photo: ['CO2', 'H2O', 'Light', 'O2', 'Glucose'],
      calvin: ['CO2', 'ATP', 'NADPH', 'Glucose', 'RuBP'],
      resp: ['Glucose', 'O2', 'CO2', 'H2O', 'Energy']
    };
    
    const newParticles: Particle[] = [];
    
    // Realistic spawning based on availability
    const addParticle = (label: string, color: string, count: number, behavior: 'fall' | 'rise' | 'float' = 'float') => {
      for (let i = 0; i < count; i++) {
        let vx = (Math.random() - 0.5) * 1.0;
        let vy = (Math.random() - 0.5) * 1.0;
        let x = 50 + Math.random() * 500;
        let y = 50 + Math.random() * 300;

        if (behavior === 'fall') {
          vy = 1 + Math.random();
          vx = (Math.random() - 0.5) * 0.5;
          y = Math.random() * 100 - 50;
        } else if (behavior === 'rise') {
          vy = -(1 + Math.random());
          vx = (Math.random() - 0.5) * 0.5;
          y = 300 + Math.random() * 100;
        }

        newParticles.push({
          id: Math.random().toString(36).substr(2, 9),
          x, y, vx, vy, label, color,
          size: 30 + Math.random() * 10
        });
      }
    };

    if (mode === 'photo') {
      addParticle('CO2', '#94a3b8', 12, 'float'); // Need 6
      addParticle('H2O', '#3b82f6', 12, 'rise'); // Need 6
      addParticle('Light', '#facc15', 8, 'fall'); // Need 1
    } else if (mode === 'calvin') {
      addParticle('CO2', '#94a3b8', 8, 'float'); // Need 3
      addParticle('ATP', '#a78bfa', 15, 'float'); // Need 9
      addParticle('NADPH', '#f472b6', 10, 'float'); // Need 6
    } else if (mode === 'resp') {
      addParticle('Glucose', '#f59e0b', 6, 'float'); // Need 1
      addParticle('O2', '#67e8f9', 12, 'float'); // Need 6
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
    const type = activeProcessRef.current;

    if (processStateRef.current === 'animating') {
      ctx.fillStyle = 'rgba(15, 23, 42, 1)';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const time = Date.now() / 1000;
      const step = animationStepRef.current;

      const drawMolecule = (x: number, y: number, type: string, size = 15) => {
        drawRealisticMolecule(ctx, x, y, type, size);
      };

      const drawMoleculeGroup = (x: number, y: number, type: string, count: number, size = 15) => {
        for (let i = 0; i < count; i++) {
          const offsetX = Math.cos((i / count) * Math.PI * 2) * size * 2.0;
          const offsetY = Math.sin((i / count) * Math.PI * 2) * size * 2.0;
          drawMolecule(x + offsetX, y + offsetY, type, size);
        }
      };

      if (type === 'photo') {
        // Thylakoid Membrane
        ctx.fillStyle = '#166534';
        ctx.fillRect(50, cy - 20, w - 100, 40);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("Thylakoid Membrane", cx, cy - 30);
        ctx.fillText("Stroma (Outside)", cx, cy - 80);
        ctx.fillText("Lumen (Inside)", cx, cy + 80);

        // PSII
        ctx.fillStyle = '#047857';
        ctx.fillRect(150, cy - 40, 60, 80);
        ctx.fillStyle = 'white'; ctx.fillText("PSII", 180, cy);

        // Cytochrome b6f
        ctx.fillStyle = '#0f766e';
        ctx.fillRect(300, cy - 30, 50, 60);
        ctx.fillStyle = 'white'; ctx.fillText("Cyt", 325, cy);

        // PSI
        ctx.fillStyle = '#047857';
        ctx.fillRect(450, cy - 40, 60, 80);
        ctx.fillStyle = 'white'; ctx.fillText("PSI", 480, cy);

        // ATP Synthase
        ctx.fillStyle = '#b45309';
        ctx.fillRect(600, cy - 30, 60, 100);
        ctx.fillStyle = 'white'; ctx.fillText("ATP Syn", 630, cy + 20);

        if (step >= 0) {
          // Light hitting PSII
          const lx = 180 + Math.sin(time * 5) * 10;
          const ly = cy - 100 + Math.cos(time * 5) * 10;
          drawMolecule(lx, ly, 'Light', 20);
          ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(180, cy - 40); ctx.stroke();
        }
        if (step >= 1) {
          // H2O splitting
          drawMolecule(180, cy + 100, 'H2O', 15);
          ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(180, cy + 85); ctx.lineTo(180, cy + 40); ctx.stroke();
          drawMolecule(140, cy + 60, 'O2', 15);
          drawMolecule(220, cy + 60, 'H+', 12);
        }
        if (step >= 2) {
          // Electrons moving
          const ex = 180 + ((time * 100) % 270);
          const ey = cy - 20 + Math.sin(time * 10) * 10;
          drawMolecule(ex, ey, 'e-', 10);
          // Protons pumping
          const px = 325;
          const py = cy - 60 + ((time * 50) % 120);
          drawMolecule(px, py, 'H+', 12);
        }
        if (step >= 3) {
          // Protons through ATP Synthase
          const px2 = 630;
          const py2 = cy + 60 - ((time * 50) % 120);
          drawMolecule(px2, py2, 'H+', 12);
          drawMolecule(680, cy - 60, 'ATP', 18);
        }
        if (step >= 4) {
          // NADPH production
          drawMolecule(480, cy - 80, 'NADPH', 20);
        }

        return;
      } else if (type === 'calvin') {
        // Calvin Cycle Diagram
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI*2); ctx.stroke();
        
        ctx.fillStyle = 'white'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText("Calvin Cycle", cx, cy);

        // Nodes
        const fixX = cx; const fixY = cy - 150;
        const redX = cx + 130; const redY = cy + 75;
        const regX = cx - 130; const regY = cy + 75;

        ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(fixX, fixY, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = '14px sans-serif'; ctx.fillText("Fixation", fixX, fixY - 30);

        ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(redX, redY, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText("Reduction", redX + 40, redY);

        ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(regX, regY, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText("Regeneration", regX - 50, regY);

        if (step >= 0) {
          drawMoleculeGroup(fixX - 100, fixY - 60, 'CO2', 3, 15);
          drawMoleculeGroup(fixX + 100, fixY - 60, 'RuBP', 3, 15);
          ctx.fillText("Rubisco enzyme combines them", cx, fixY + 30);
        }
        if (step >= 1) {
          drawMoleculeGroup(redX + 100, redY - 60, 'ATP', 6, 12);
          drawMoleculeGroup(redX + 100, redY + 60, 'NADPH', 6, 15);
          drawMoleculeGroup(cx + 100, cy, '3-PGA', 6, 15);
        }
        if (step >= 2) {
          drawMolecule(cx, cy + 200, 'Glucose', 25);
          ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(redX - 20, redY + 20); ctx.lineTo(cx, cy + 170); ctx.stroke();
        }
        if (step >= 3) {
          drawMoleculeGroup(cx - 100, cy, 'G3P', 5, 15);
          drawMoleculeGroup(regX - 100, regY, 'ATP', 3, 12);
        }

        return;
      } else if (type === 'resp') {
        // Cell structure
        ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, w, h); // Cytoplasm
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '20px sans-serif'; ctx.fillText("Cytoplasm", 100, 50);

        // Mitochondrion
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath(); ctx.ellipse(cx + 100, cy, 250, 150, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = 'white'; ctx.font = 'bold 24px sans-serif'; ctx.fillText("Mitochondrion", cx + 100, cy - 100);

        if (step >= 0) {
          // Glycolysis
          drawMolecule(100, cy, 'Glucose', 25);
          ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(130, cy); ctx.lineTo(200, cy); ctx.stroke();
          drawMolecule(230, cy, 'Pyruvate', 20);
          drawMoleculeGroup(165, cy - 60, 'ATP', 2, 15);
          ctx.fillText("Glycolysis", 165, cy + 30);
        }
        if (step >= 1) {
          // Krebs Cycle
          ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(cx + 50, cy + 50, 40, 0, Math.PI*2); ctx.stroke();
          ctx.fillText("Krebs Cycle", cx + 50, cy + 110);
          
          ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(250, cy); ctx.lineTo(cx + 20, cy + 30); ctx.stroke();
          
          drawMolecule(cx + 50, cy - 20, 'CO2', 15);
          drawMoleculeGroup(cx - 30, cy + 50, 'ATP', 2, 15);
          drawMolecule(cx + 110, cy + 50, 'NADH/FADH2', 25);
        }
        if (step >= 2) {
          // ETC
          ctx.fillStyle = '#ea580c'; ctx.fillRect(cx + 200, cy - 80, 40, 160);
          ctx.fillText("Electron Transport Chain", cx + 220, cy - 100);
          
          ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(cx + 140, cy + 50); ctx.lineTo(cx + 190, cy + 50); ctx.stroke();
          
          drawMolecule(cx + 220, cy + 120, 'O2', 18);
          drawMolecule(cx + 280, cy + 120, 'H2O', 18);
          ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(cx + 240, cy + 120); ctx.lineTo(cx + 260, cy + 120); ctx.stroke();

          drawMoleculeGroup(cx + 320, cy, 'ATP', 32, 10);
        }
        return;
      }
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 1)'; // Solid background
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // --- Draw Organelles based on process ---
    if (type === 'photo') {
      // Chloroplast
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 220, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Thylakoids
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 2;
      for(let i=-2; i<=2; i++) {
        for(let j=-2; j<=2; j++) {
          ctx.beginPath();
          ctx.ellipse(cx + i*50, cy + j*20, 20, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("Chloroplast: Thylakoids", cx, cy + 180);
    } else if (type === 'calvin') {
      // Chloroplast Stroma
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 220, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Calvin Cycle Diagram
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, 70, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("Calvin Cycle", cx, cy + 5);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '24px sans-serif';
      ctx.fillText("Chloroplast: Stroma", cx, cy + 180);
    } else if (type === 'resp') {
      // Mitochondrion
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 200, 120, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Cristae
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 160, cy);
      for(let x = -120; x <= 120; x += 40) {
        ctx.lineTo(cx + x, cy - 70);
        ctx.lineTo(cx + x + 20, cy + 70);
      }
      ctx.lineTo(cx + 160, cy);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("Mitochondrion", cx, cy + 160);
    }

    particlesRef.current.forEach(p => {
      if (p.isCaught) {
        p.x += (cx - p.x) * 0.15;
        p.y += (cy - p.y) * 0.15;
        p.size *= 0.85;
      } else {
        p.x += p.vx;
        p.y += p.vy;

        if (p.label === 'Light') {
          if (p.y > h + 50) p.y = -50;
        } else if (p.label === 'H2O') {
          if (p.y < -50) p.y = h + 50;
        } else {
          if (p.x < 20 || p.x > canvas.width - 20) p.vx *= -1;
          if (p.y < 20 || p.y > canvas.height - 20) p.vy *= -1;
        }
      }

      if (p.size > 2) {
        // Draw Highlight if targeted
        if (mousePosRef.current && !p.isCaught) {
          const dx = p.x - mousePosRef.current.x;
          const dy = p.y - mousePosRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < p.size + 80) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
          }
        }

        drawRealisticMolecule(ctx, p.x, p.y, p.label, p.size * 0.6);
      }
    });
  }, []);

  const handleModalMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleModalClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = modalCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let closestIdx = -1;
    let minDistance = Infinity;

    particlesRef.current.forEach((p, idx) => {
      if (p.isCaught) return;
      const dx = p.x - x;
      const dy = p.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < p.size * 1.5 && distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1) {
      const p = particlesRef.current[closestIdx];
      playSound('catch');
      setBuiltEquation(prev => [...prev, p.label]);
      p.isCaught = true;
    }
  };

  const startProcess = (mode: 'photo' | 'calvin' | 'resp') => {
    setActiveProcess(mode);
    setProcessState('collecting');
    setAnimationStep(0);
    setBuiltEquation([]);
    spawnParticles(mode);
  };

  const handleSkipCollection = () => {
    setGameState(prev => ({
      ...prev,
      health: parseFloat(Math.max(0, prev.health - 15).toFixed(1))
    }));
    setProcessState('animating');
    setAnimationStep(0);
    toast.warning("Skipped collection phase. -15% Health penalty applied.");
  };

  const submitEquation = () => {
    const eq = builtEquation.join(' ');
    let success = false;
    
    if (activeProcess === 'photo') {
      // Light Reactions: 6 H2O + 6 CO2 + 1 Light -> ATP + NADPH + 6 O2
      const counts = builtEquation.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      if (counts['H2O'] >= 6 && counts['CO2'] >= 6 && counts['Light'] >= 1) {
        success = true;
      }
    } else if (activeProcess === 'calvin') {
      // 3 CO2 + 9 ATP + 6 NADPH -> 1 G3P
      const counts = builtEquation.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      if (counts['CO2'] >= 3 && counts['ATP'] >= 9 && counts['NADPH'] >= 6) {
        success = true;
      }
    } else if (activeProcess === 'resp') {
      // 1 Glucose + 6 O2 -> 6 CO2 + 6 H2O + 32 ATP
      const counts = builtEquation.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      if (counts['Glucose'] >= 1 && counts['O2'] >= 6) {
        success = true;
      }
    }

    if (success) {
      setProcessState('animating');
      setAnimationStep(0);
      toast.success("Equation Complete! Starting Animation...");
    } else {
      toast.error("Not enough molecules yet! Keep collecting.");
    }
  };

  useEffect(() => {
    if (!activeProcess) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let frameId: number;
    const loop = () => {
      animateParticles();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    animationFrameRef.current = frameId;

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [activeProcess, animateParticles]);

  const getAnimationSteps = (process: 'photo' | 'calvin' | 'resp') => {
    if (process === 'photo') {
      return [
        "Step 1: Light energy hits Photosystem II in the Thylakoid membrane.",
        "Step 2: Water (H2O) is split into Oxygen (O2), Protons (H+), and Electrons (e-).",
        "Step 3: Electrons travel through the Electron Transport Chain, pumping Protons into the lumen.",
        "Step 4: Protons flow through ATP Synthase, generating ATP.",
        "Step 5: Electrons reach Photosystem I and are used to reduce NADP+ to NADPH."
      ];
    } else if (process === 'calvin') {
      return [
        "Step 1: Carbon Fixation - 3 CO2 molecules combine with 3 RuBP molecules using the enzyme Rubisco.",
        "Step 2: Reduction - 6 ATP and 6 NADPH are used to convert the molecules into 6 G3P.",
        "Step 3: Release - 1 G3P molecule exits the cycle to be used for making Glucose.",
        "Step 4: Regeneration - The remaining 5 G3P molecules use 3 ATP to regenerate 3 RuBP molecules."
      ];
    } else {
      return [
        "Step 1: Glycolysis - Glucose is broken down in the cytoplasm into Pyruvate, producing 2 ATP.",
        "Step 2: Krebs Cycle - Pyruvate enters the mitochondrion, releasing CO2 and producing 2 ATP, NADH, and FADH2.",
        "Step 3: Electron Transport Chain - NADH and FADH2 donate electrons. Oxygen acts as the final electron acceptor, combining with protons to form Water (H2O). This powers ATP Synthase to produce ~32 ATP."
      ];
    }
  };

  const finishProcess = () => {
    setGameState(prev => {
      let healthGain = 0.5;
      let glucoseGain = 0;
      
      if (activeProcess === 'photo') {
        healthGain = 1.0;
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
    setActiveProcess(null);
  };

  // --- Actions ---

  const handleWater = () => {
    if (gameState.waterLevel >= 100) {
      toast.info("Soil is already saturated!");
      return;
    }
    setIsWatering(true);
    setTimeout(() => setIsWatering(false), 2000);
    
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
                onClick={handleSkipPhase}
                className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-slate-300 font-bold text-sm"
              >
                {gameState.isDayTime ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                SKIP TO {gameState.isDayTime ? 'NIGHT' : 'MORNING'}
              </button>
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
                onClick={toggleMusic}
                className={cn(
                  "flex items-center gap-3 p-3 border rounded-xl transition-colors font-bold text-sm",
                  isMusicEnabled 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                )}
              >
                {isMusicEnabled ? <Music2 className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                {isMusicEnabled ? "MUSIC: ON" : "MUSIC: OFF"}
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
        <main className="flex-1 relative bg-slate-950 flex flex-col overflow-y-auto">
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
                    {processState === 'collecting' ? 'Phase 1: Collect Required Molecules' : 'Phase 2: Process Animation'}
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
                    onClick={processState === 'collecting' ? handleModalClick : undefined}
                    onMouseMove={processState === 'collecting' ? handleModalMouseMove : undefined}
                    onMouseLeave={() => { mousePosRef.current = null; }}
                    className={cn(
                      "w-full h-full",
                      processState === 'collecting' ? "cursor-crosshair" : ""
                    )}
                  />
                  {processState === 'collecting' && (
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                      <div className="bg-slate-900/80 backdrop-blur-sm p-3 rounded-xl border border-slate-700/50">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Target Equation</p>
                        <p className="text-xs font-mono text-emerald-400">
                          {activeProcess === 'photo' && "6 CO2 + 6 H2O + Light → ATP + NADPH + 6 O2"}
                          {activeProcess === 'calvin' && "3 CO2 + 9 ATP + 6 NADPH → 1 G3P (Glucose)"}
                          {activeProcess === 'resp' && "1 Glucose + 6 O2 → 6 CO2 + 6 H2O + 32 ATP"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {processState === 'collecting' ? (
                    <div className="space-y-4">
                      <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Collected Molecules</h4>
                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                          {builtEquation.length === 0 && <span className="text-slate-600 italic text-sm">Click molecules to collect...</span>}
                          {builtEquation.map((m, i) => (
                            <motion.span 
                              key={i}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="px-2 py-1 bg-slate-700 rounded-md text-[10px] font-bold text-emerald-400 border border-emerald-500/20"
                            >
                              {m}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={submitEquation}
                          className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                        >
                          <Zap className="w-5 h-5" />
                          SUBMIT EQUATION
                        </button>
                        <button 
                          onClick={handleSkipCollection}
                          className="px-6 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500 text-red-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                          title="Skip collection phase at the cost of 15% health"
                        >
                          SKIP (-15% HP)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl text-slate-200 text-sm">
                        <h4 className="font-bold text-emerald-400 mb-2">Animation Step {animationStep + 1} of {getAnimationSteps(activeProcess!).length}</h4>
                        <p>{getAnimationSteps(activeProcess!)[animationStep]}</p>
                      </div>
                      <div className="flex gap-3">
                        {animationStep < getAnimationSteps(activeProcess!).length - 1 ? (
                          <button 
                            onClick={() => setAnimationStep(prev => prev + 1)}
                            className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                          >
                            NEXT STEP
                          </button>
                        ) : (
                          <button 
                            onClick={finishProcess}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                          >
                            COLLECT REWARD & CLOSE
                          </button>
                        )}
                      </div>
                    </div>
                  )}
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
