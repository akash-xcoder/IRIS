import { PresetScenario } from '../types';

// Helper to render high-contrast realistic assistive navigation test frames onto Canvas
function createSceneDataUrl(type: string): string {
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background sky / indoor ceiling
  if (type === 'crosswalk_car' || type === 'sidewalk_pedestrian' || type === 'low_scaffolding') {
    // Outdoor sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 240);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(1, '#e0f2fe');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 640, 240);

    // City buildings in background
    ctx.fillStyle = '#64748b';
    ctx.fillRect(40, 80, 100, 160);
    ctx.fillRect(160, 60, 120, 180);
    ctx.fillRect(320, 90, 90, 150);
    ctx.fillRect(430, 50, 140, 190);

    // Building windows
    ctx.fillStyle = '#fef08a';
    for (let bx = 60; bx < 560; bx += 50) {
      for (let by = 80; by < 220; by += 35) {
        ctx.fillRect(bx, by, 16, 20);
      }
    }
  } else {
    // Indoor ceiling & lighting
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 640, 200);

    // Overhead linear lights
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(180, 20, 280, 12);
    ctx.fillRect(200, 70, 240, 10);
  }

  // Horizon & ground floor
  const groundGrad = ctx.createLinearGradient(0, 240, 0, 480);

  if (type === 'crosswalk_car') {
    // Asphalt street
    groundGrad.addColorStop(0, '#334155');
    groundGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 240, 640, 240);

    // Crosswalk zebra stripes (perspective)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      const x1 = 120 + i * 60;
      const x2 = 80 + i * 80;
      ctx.moveTo(x1, 330);
      ctx.lineTo(x1 + 35, 330);
      ctx.lineTo(x2 + 45, 470);
      ctx.lineTo(x2, 470);
      ctx.fill();
    }

    // Car (Red Sedan Approaching in Center-Left lane)
    // Car body
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(220, 230, 220, 110, 12);
    ctx.fill();

    // Car cabin / windshield
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(250, 230);
    ctx.lineTo(275, 175);
    ctx.lineTo(385, 175);
    ctx.lineTo(410, 230);
    ctx.closePath();
    ctx.fill();

    // Windshield glass
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.moveTo(278, 180);
    ctx.lineTo(382, 180);
    ctx.lineTo(402, 225);
    ctx.lineTo(258, 225);
    ctx.closePath();
    ctx.fill();

    // Headlights (glowing)
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(245, 275, 18, 0, Math.PI * 2);
    ctx.arc(415, 275, 18, 0, Math.PI * 2);
    ctx.fill();

    // Car license plate & bumper
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(300, 295, 60, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HAZARD', 305, 312);

    // Tires
    ctx.fillStyle = '#020617';
    ctx.fillRect(215, 315, 30, 45);
    ctx.fillRect(415, 315, 30, 45);
  } else if (type === 'sidewalk_pedestrian') {
    // Pavement sidewalk
    groundGrad.addColorStop(0, '#94a3b8');
    groundGrad.addColorStop(1, '#475569');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 240, 640, 240);

    // Sidewalk expansion lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    for (let y = 260; y < 480; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(640, y);
      ctx.stroke();
    }

    // Pedestrian approaching (center left: x ~ 180 - 290, y ~ 160 - 430)
    // Head
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(235, 185, 24, 0, Math.PI * 2);
    ctx.fill();

    // Dark Jacket / Torso
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(205, 215, 60, 95);

    // Jeans / Legs
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(212, 310, 20, 95);
    ctx.fillRect(238, 310, 20, 95);

    // Shoes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(208, 405, 26, 16);
    ctx.fillRect(238, 405, 26, 16);

    // Parked electric scooter on right (x ~ 450 - 540, y ~ 260 - 440)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(490, 270);
    ctx.lineTo(490, 410);
    ctx.lineTo(530, 415);
    ctx.stroke();

    // Handlebar
    ctx.beginPath();
    ctx.moveTo(470, 270);
    ctx.lineTo(510, 270);
    ctx.stroke();

    // Scooter wheels
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(490, 420, 16, 0, Math.PI * 2);
    ctx.arc(535, 420, 16, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'metro_stairs_down') {
    // Concrete metro transit floor
    groundGrad.addColorStop(0, '#64748b');
    groundGrad.addColorStop(1, '#334155');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 200, 640, 280);

    // Yellow tactile warning edge tiles
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 290, 640, 30);
    // Tactile bump dots
    ctx.fillStyle = '#ca8a04';
    for (let x = 10; x < 640; x += 22) {
      ctx.beginPath();
      ctx.arc(x, 300, 4, 0, Math.PI * 2);
      ctx.arc(x, 312, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Descending Stairwell opening on right (x: 320 to 600, y: 320 to 480)
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(330, 320);
    ctx.lineTo(620, 320);
    ctx.lineTo(620, 480);
    ctx.lineTo(290, 480);
    ctx.closePath();
    ctx.fill();

    // Stair treads going down
    ctx.fillStyle = '#475569';
    for (let s = 1; s <= 5; s++) {
      const sy = 320 + s * 28;
      ctx.fillRect(320 - s * 6, sy, 300, 10);
    }

    // Warning barrier rail
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(320, 240);
    ctx.lineTo(320, 320);
    ctx.stroke();
  } else if (type === 'low_scaffolding') {
    // Sidewalk with low-hanging metal pipe scaffolding
    groundGrad.addColorStop(0, '#64748b');
    groundGrad.addColorStop(1, '#475569');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 220, 640, 260);

    // Metal vertical scaffolding pole (x ~ 140 to 170)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(145, 60, 22, 400);

    // Low horizontal steel beam right across head level! (y ~ 120 to 160)
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(80, 130, 480, 30);

    // Diagonal hazard stripes on beam
    ctx.fillStyle = '#eab308';
    for (let sx = 90; sx < 550; sx += 40) {
      ctx.beginPath();
      ctx.moveTo(sx, 130);
      ctx.lineTo(sx + 20, 130);
      ctx.lineTo(sx, 160);
      ctx.lineTo(sx - 20, 160);
      ctx.closePath();
      ctx.fill();
    }

    // Yellow warning sign hanging
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(300, 165);
    ctx.lineTo(350, 165);
    ctx.lineTo(325, 210);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('!', 320, 198);
  } else if (type === 'hallway_clear') {
    // Indoor clean corridor with clear straight perspective
    groundGrad.addColorStop(0, '#cbd5e1');
    groundGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = groundGrad;
    ctx.beginPath();
    ctx.moveTo(260, 200);
    ctx.lineTo(380, 200);
    ctx.lineTo(600, 480);
    ctx.lineTo(40, 480);
    ctx.closePath();
    ctx.fill();

    // Side walls
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(260, 200);
    ctx.lineTo(40, 480);
    ctx.lineTo(0, 480);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(640, 0);
    ctx.lineTo(380, 200);
    ctx.lineTo(600, 480);
    ctx.lineTo(640, 480);
    ctx.fill();

    // Clear green guide navigation arrow on the floor
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.beginPath();
    ctx.moveTo(320, 290);
    ctx.lineTo(350, 360);
    ctx.lineTo(335, 360);
    ctx.lineTo(335, 430);
    ctx.lineTo(305, 430);
    ctx.lineTo(305, 360);
    ctx.lineTo(290, 360);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'supermarket_cart') {
    // Supermarket tiled floor
    groundGrad.addColorStop(0, '#e2e8f0');
    groundGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 200, 640, 280);

    // Shelves on right side
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(450, 120, 190, 340);
    ctx.fillStyle = '#f8fafc';
    for (let sy = 160; sy < 440; sy += 50) {
      ctx.fillRect(450, sy, 190, 8);
    }

    // Metal shopping cart blocking left-center path (x: 160 to 330, y: 220 to 420)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    // Basket grid
    ctx.strokeRect(170, 240, 150, 110);
    for (let gx = 190; gx < 320; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, 240);
      ctx.lineTo(gx, 350);
      ctx.stroke();
    }
    // Handle
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(150, 240);
    ctx.lineTo(170, 260);
    ctx.stroke();

    // Wheels
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(180, 395, 14, 0, Math.PI * 2);
    ctx.arc(305, 395, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tactical watermark / camera timestamp
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '13px monospace';
  ctx.fillText(`CAM-01 [${type.toUpperCase()}] AUTO-FPS: 30`, 16, 24);

  return canvas.toDataURL('image/jpeg', 0.9);
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'crosswalk_car',
    title: 'Crosswalk Hazard - Approaching Vehicle',
    category: 'hazard',
    description: 'Pedestrian crosswalk with oncoming red automobile approaching center path.',
    expectedUrgency: 'critical',
    expectedGuidance: 'Stop immediately. Vehicle approaching directly in front of crosswalk.',
    imageDataUrl: '',
  },
  {
    id: 'sidewalk_pedestrian',
    title: 'Busy Sidewalk - Pedestrian & Parked Scooter',
    category: 'outdoor',
    description: 'Urban sidewalk with an oncoming pedestrian on left and parked e-scooter on right.',
    expectedUrgency: 'caution',
    expectedGuidance: 'Caution, person approaching three steps ahead on your left. Veer slightly right.',
    imageDataUrl: '',
  },
  {
    id: 'metro_stairs_down',
    title: 'Transit Hub - Platform Edge & Descending Stairs',
    category: 'transit',
    description: 'Metro subway platform with yellow tactile edge and downward stairwell on right.',
    expectedUrgency: 'critical',
    expectedGuidance: 'Caution, descending staircase on your right. Keep left and slow down.',
    imageDataUrl: '',
  },
  {
    id: 'low_scaffolding',
    title: 'Construction Scaffolding - Head-Height Hazard',
    category: 'hazard',
    description: 'City sidewalk with low metal scaffolding bar across head clearance level.',
    expectedUrgency: 'critical',
    expectedGuidance: 'Danger, low-hanging metal beam at head height. Duck or step right.',
    imageDataUrl: '',
  },
  {
    id: 'hallway_clear',
    title: 'Indoor Corridor - Path Clear Straight',
    category: 'indoor',
    description: 'Open, unobstructed hallway with no obstacles or floor hazards.',
    expectedUrgency: 'normal',
    expectedGuidance: 'Path is clear, continue straight forward.',
    imageDataUrl: '',
  },
  {
    id: 'supermarket_cart',
    title: 'Supermarket Aisle - Protruding Cart',
    category: 'indoor',
    description: 'Grocery aisle with shopping cart obstructing the left walking lane.',
    expectedUrgency: 'caution',
    expectedGuidance: 'Caution, shopping cart ahead on your left. Sidestep right to pass.',
    imageDataUrl: '',
  },
];

// Lazy initialize images in browser
let initialized = false;
export function getPresetScenarios(): PresetScenario[] {
  if (!initialized && typeof document !== 'undefined') {
    PRESET_SCENARIOS.forEach((scenario) => {
      scenario.imageDataUrl = createSceneDataUrl(scenario.id);
    });
    initialized = true;
  }
  return PRESET_SCENARIOS;
}
