const canvas = document.getElementById("gameCanvas"); // Get the canvas element
const ctx = canvas.getContext("2d"); // Get the 2D drawing context

let ball = {
  x: canvas.width / 2,
  y: 500, // start at a fixed ground-level position (startingY)
  radius: 20,
  dx: 0, // horizontal velocity
  dy: 0, // vertical velocity
  speed: 4, // slightly increased for responsive control
  gravity: 0.5, // a bit lighter gravity for smoother falls and jumps
  canJump: false, // flag to allow jump only when touching ground/platform
  hp: 3,
  poisoned: false,
  poisonTimer: 0,
  bounceEffectTimer: 0, // visual bounce effect timer, keep as is
  startingY: 500, // keep starting Y here for reset reference
  invulnerableTimer: 0, // <<< ADD THIS and initialize to 0
  windblastActive: false,
  windblastDuration: 0,
  isFloating: false, // NEW: Boolean to indicate if the ball is currently floating
  floatDuration: 0, // NEW: Timer for how long the ball floats
};

// Game constants

let keys = { left: false, right: false };

const jumpForceBase = -7; // Base jump force
const jumpForceMax = -7.5; // Maximum jump force after holding
let jumpForceCurrent = jumpForceBase;
const jumpForceStep = -0.9; // Force increase per frame while holding jump

let platforms = [];
let coins = [];
let score = 0;
let isGameOver = false;
let gameStarted = false;

// Example: How to make a fragile platform break on click
canvas.addEventListener("click", (event) => {
  const mouseX = event.clientX - canvas.offsetLeft;
  const mouseY = event.clientY - canvas.offsetTop;

  platforms.forEach((platform) => {
    if (
      platform.type === "fragile" &&
      mouseX > platform.x &&
      mouseX < platform.x + platform.width &&
      mouseY > platform.y &&
      mouseY < platform.y + platform.height
    ) {
      platform.breakTemporarily();
    }
  });
});

// Platform coin class definition
class Coin {
  constructor(x, y, type = "normal") {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type === "gold" ? 10 : 7;
    this.value = type === "gold" ? 50 : 10;
    this.collected = false;
    this.pulse = Math.random() * Math.PI * 2;
  }

  draw() {
    if (this.collected) return;

    // Pulse animation
    this.pulse += 0.07;
    const scale = 1 + 0.15 * Math.sin(this.pulse);

    // Coin gradient
    ctx.beginPath();
    const grad = ctx.createRadialGradient(
      this.x,
      this.y,
      this.radius * 0.4,
      this.x,
      this.y,
      this.radius * scale
    );

    if (this.type === "gold") {
      grad.addColorStop(0, "#fff6cc");
      grad.addColorStop(1, "#ffd700");
      ctx.shadowColor = "#ffd700";
    } else {
      grad.addColorStop(0, "yellow");
      grad.addColorStop(1, "orange");
      ctx.shadowColor = "yellow";
    }

    ctx.fillStyle = grad;
    ctx.shadowBlur = 15;
    ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
  }
}

function generateInitialPlatforms() {
  platforms = [];
  coins = [];
  score = 0;

  const generationMode = "circularStair";

  const groundHeight = 40;
  // Ground platform fixed at bottom, full width
  platforms.push(
    new Platform(
      0,
      canvas.height - groundHeight,
      canvas.width,
      groundHeight,
      "spikes"
    )
  );

  const startWidth = 100;
  const startHeight = 12;
  const startX = (canvas.width - startWidth) / 2;
  // Start platform slightly above ground (avoid going outside canvas)
  const startY = canvas.height - groundHeight - 60;
  platforms.push(
    new Platform(startX, startY, startWidth, startHeight, "static")
  );

  const usedRects = [
    { x: startX, y: startY, width: startWidth, height: startHeight },
  ];

  const platformCount = 20; // This is local to this function
  const minGap = 100;
  const maxGap = 140;
  let lastY = startY;

  for (let i = 0; i < platformCount; i++) {
    const verticalGap = minGap + Math.floor(Math.random() * (maxGap - minGap));
    lastY -= verticalGap;

    // Stop generating platforms if above the top canvas limit, add some margin
    if (lastY < 50) break;

    let width = 80 + Math.floor(Math.random() * 60);
    const height = 10;
    let x;

    if (generationMode === "circularStair") {
      const centerX = canvas.width / 2;
      const radius = 120 + i * 5;
      const angle = i * (0.4 + Math.random() * 0.2); // slight variation in rotation step
      x = centerX + Math.cos(angle) * radius - width / 2;
    } else {
      // fallback: random x within canvas bounds
      x = Math.random() * (canvas.width - width);
    }

    // Clamp x to keep platform fully inside canvas horizontally
    x = Math.min(Math.max(0, x), canvas.width - width);

    const newRect = { x, y: lastY, width, height };
    const pad = 40;
    const overlaps = usedRects.some(
      (r) =>
        !(
          r.x + r.width + pad < x ||
          x + width + pad < r.x ||
          r.y + r.height + pad < lastY ||
          lastY + height + pad < r.y
        )
    );
    if (overlaps) continue;

    // --- Platform type assignment ---
    let type = "static";
    const rand = Math.random();
    if (lastY < canvas.height / 2) {
      if (rand < 0.12) type = "bouncy";
      else if (rand < 0.22) type = "moving";
      else if (rand < 0.3) type = "fragile";
      else if (rand < 0.4) type = "ice";
      else if (rand < 0.48) type = "soap";
      else if (rand < 0.55) type = "slip";
      else if (rand < 0.62) type = "gravity";
      else if (rand < 0.7) type = "windblast"; // Added windblast here
    } else {
      if (rand < 0.1) type = "bouncy";
      else if (rand < 0.18) type = "moving";
      else if (rand < 0.26) type = "fragile";
      else if (rand < 0.34) type = "ice";
      else if (rand < 0.42) type = "soap";
      else if (rand < 0.5) type = "slip";
      else if (rand < 0.58) type = "gravity";
      else if (rand < 0.65) type = "windblast"; // Added windblast here
      else if (rand < 0.68 && i >= 2) type = "spikes";
      else if (rand < 0.75 && i >= 2) type = "grassspikes";
    }

    const platform = new Platform(x, lastY, width, height, type);

    // Add glow or visual tweak
    if (["bouncy", "ice", "soap", "windblast"].includes(type)) {
      // Added windblast to glow condition
      platform.glow = true;
      platform.hue = (i * 30) % 360; // rainbow-style hue for spiral
    }

    platforms.push(platform);
    usedRects.push(newRect);

    // --- Coin placement ---
    if (!["spikes", "grassspikes"].includes(type)) {
      const coinChance = Math.min(0.5, width / 140);
      const numCoins = Math.random() < coinChance ? 2 : 1;
      for (let c = 0; c < numCoins; c++) {
        const coinX = x + 20 + (c * (width - 40)) / Math.max(1, numCoins - 1);
        const coinY = lastY - 15;
        const coinType = Math.random() < 0.12 ? "gold" : "normal";
        coins.push(new Coin(Math.floor(coinX), Math.floor(coinY), coinType));
      }
    }

    // --- Bonus star on rare high platform ---
    if (lastY < canvas.height / 3 && Math.random() < 0.1) {
      coins.push(new Coin(x + width / 2, lastY - 25, "star"));
    }
  }

  // --- Reset ball state on starting platform ---
  ball.x = startX + startWidth / 2;
  ball.y = startY - ball.radius;
  ball.dx = 0;
  ball.dy = 0;
  ball.hp = 3;
  ball.invulnerableTimer = 0; // <<< ADD THIS to reset timer on new game/level
  ball.poisoned = false; // Also good to reset these explicitly
  ball.poisonTimer = 0; // if this function serves as a full reset
}

// Platform class definition
// We'll keep a small array to store previous positions for the tail effect

const tailPositions = [];
let jumpPowerUpActive = false;
let lastJumpPowerUseTime = 0;
const JUMP_POWER_COOLDOWN = 5000; // 5 seconds
const JUMP_POWER_DURATION = 7000; // 7 seconds
const MAX_JUMP_HOLD_TIME = 500; // in milliseconds
let jumpHoldStartTime = null;

function drawBall() {
  const { x, y, radius: r, dy } = ball;
  const now = Date.now();

  // --- Manage tail positions ---
  // Tail is generally persistent, but you could disable it if needed
  tailPositions.push({ x, y });
  if (tailPositions.length > 10) tailPositions.shift();

  // --- Draw tail ---
  ctx.save();
  for (let i = 0; i < tailPositions.length; i++) {
    const pos = tailPositions[i];
    const alpha = ((i + 1) / tailPositions.length) * 0.3;
    const size = r * (0.6 - i * 0.04);
    ctx.beginPath();
    // Tail color: soft amber fading out
    ctx.fillStyle = `rgba(244, 196, 48, ${alpha})`; // warm golden-yellow
    ctx.shadowColor = `rgba(244, 196, 48, ${alpha * 0.6})`;
    ctx.shadowBlur = 10 * alpha;
    ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- Apply scaling effects based on ball state ---
  let scaleX = 1,
    scaleY = 1;
  // ONLY apply scaling if NOT floating.
  if (!ball.isFloating) {
    if (ball.bounceEffectTimer > 0) {
      scaleX = 1.2;
      scaleY = 0.7;
      ball.bounceEffectTimer--;
    } else if (ball.slipEffectTimer > 0) {
      scaleY = 1 + Math.min(Math.abs(dy) / 20, 0.15);
      scaleX = 1 - Math.min(Math.abs(dy) / 40, 0.05);
      ball.slipEffectTimer--;
    } else if (dy < -1) {
      scaleY = 1 + Math.min(Math.abs(dy) / 10, 0.4);
      scaleX = 1 - Math.min(Math.abs(dy) / 20, 0.15);
    } else if (dy > 1) {
      scaleY = 1 - Math.min(dy / 20, 0.1);
      scaleX = 1 + Math.min(dy / 10, 0.2);
    }
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, scaleY);

  // --- Glow and effects helper ---
  const applyGlow = (radiusMult, stops, shadowColor, shadowBlur) => {
    const glowRadius = r * radiusMult;
    const gradient = ctx.createRadialGradient(
      0,
      0,
      r * (stops.startRadius || 1),
      0,
      0,
      glowRadius
    );
    stops.stops.forEach(({ offset, color }) =>
      gradient.addColorStop(offset, color)
    );
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  // --- Normal glow when on ground ---
  // Disabled when floating
  if (ball.onGround && !keys.jumpHeld && !ball.isFloating) {
    const glowRadius = r * 1.5;
    const glowGradient = ctx.createRadialGradient(
      0,
      0,
      r * 0.5,
      0,
      0,
      glowRadius
    );
    glowGradient.addColorStop(0, "rgba(230, 230, 210, 0.25)"); // warm pale cream glow
    glowGradient.addColorStop(1, "rgba(230, 230, 210, 0)");
    ctx.beginPath();
    ctx.fillStyle = glowGradient;
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Jumping effects ---
  // Disabled when floating
  if (keys.jumpHeld && !ball.onGround && !ball.isFloating) {
    ctx.strokeStyle = "rgba(255, 140, 0, 0.3)"; // warm orange
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const offset = (i - 1) * 6;
      ctx.moveTo(offset, r);
      ctx.lineTo(offset, r + 20 + Math.random() * 5);
      ctx.stroke();
    }

    ctx.beginPath();
    const pulse = 1 + 0.1 * Math.sin(now / 80);
    ctx.strokeStyle = "rgba(255, 165, 79, 0.2)"; // softer orange glow
    ctx.lineWidth = 3;
    ctx.arc(0, 0, r * 1.8 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Power-up and status glows ---
  // Disabled when floating
  if (!ball.isFloating) {
    if (ball.slipEffectTimer > 0) {
      applyGlow(
        2.5,
        {
          startRadius: 1,
          stops: [
            { offset: 0, color: "rgba(173, 216, 230, 0.4)" }, // light sky blue
            { offset: 1, color: "rgba(173, 216, 230, 0)" },
          ],
        },
        "rgba(173, 216, 230, 0.5)",
        25
      );
    }

    if (ball.wasOnGrassSpikes || ball.poisoned) {
      applyGlow(
        2.5,
        {
          startRadius: 0.5,
          stops: [
            { offset: 0, color: "rgba(34, 139, 34, 0.7)" }, // forest green
            { offset: 1, color: "rgba(34, 139, 34, 0)" },
          ],
        },
        "rgba(34, 139, 34, 0.8)",
        25
      );
    }

    if (jumpPowerUpActive) {
      const pulse = 0.9 + 0.1 * Math.sin(now / 100);
      const auraRadius = r * 2 * pulse;
      const auraGradient = ctx.createRadialGradient(
        0,
        0,
        r * 0.7,
        0,
        0,
        auraRadius
      );
      auraGradient.addColorStop(0, "rgba(255, 140, 0, 0.5)"); // warm orange
      auraGradient.addColorStop(1, "rgba(255, 140, 0, 0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.fillStyle = auraGradient;
      ctx.shadowColor = "rgba(255, 140, 0, 0.7)";
      ctx.shadowBlur = 30;
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (ball.bounceEffectTimer > 0) {
      const bounceGlowRadius = r * 2.2;
      const bounceGlow = ctx.createRadialGradient(
        0,
        0,
        r,
        0,
        0,
        bounceGlowRadius
      );
      bounceGlow.addColorStop(0, "rgba(205, 92, 92, 0.6)"); // indian red (warm muted red)
      bounceGlow.addColorStop(1, "rgba(205, 92, 92, 0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.fillStyle = bounceGlow;
      ctx.shadowColor = "rgba(205, 92, 92, 0.7)";
      ctx.shadowBlur = 35;
      ctx.arc(0, 0, bounceGlowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (speedBoostActive) {
      // Pulsing orange-yellow glow for speed boost
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150);
      const auraRadius = r * (2 + pulse);
      const auraGradient = ctx.createRadialGradient(
        0,
        0,
        r * 0.8,
        0,
        0,
        auraRadius
      );
      auraGradient.addColorStop(0, `rgba(255, 223, 0, ${0.5 * pulse})`); // bright yellow
      auraGradient.addColorStop(1, `rgba(255, 140, 0, 0)`); // warm orange fade

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.fillStyle = auraGradient;
      ctx.shadowColor = `rgba(255, 223, 0, ${0.7 * pulse})`;
      ctx.shadowBlur = 40 * pulse;
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Optional: Slight color tint on ball itself during boost
      ctx.fillStyle = `rgba(255, 200, 0, ${0.15 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Windblast Floating Aura (Always active if ball.isFloating) ---
  if (ball.isFloating) {
    const pulse = 0.8 + 0.2 * Math.sin(now / 120); // Gentle pulse
    const auraRadius = r * (2 + pulse * 0.5); // Slightly larger, pulsing aura
    const auraGradient = ctx.createRadialGradient(
      0,
      0,
      r * 0.6,
      0,
      0,
      auraRadius
    );
    // Complementary colors: cool blue/cyan fading out
    auraGradient.addColorStop(0, `rgba(135, 206, 250, ${0.6 * pulse})`); // SkyBlue
    auraGradient.addColorStop(0.5, `rgba(0, 191, 255, ${0.3 * pulse})`); // Deep Sky Blue
    auraGradient.addColorStop(1, `rgba(0, 191, 255, 0)`); // Fade to transparent

    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // Blends well for glows
    ctx.beginPath();
    ctx.fillStyle = auraGradient;
    ctx.shadowColor = `rgba(0, 191, 255, ${0.8 * pulse})`; // Stronger blue shadow
    ctx.shadowBlur = 30 * pulse; // Pulsing blur
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Optional: Subtle inner tint on ball itself
    ctx.fillStyle = `rgba(135, 206, 250, ${0.1 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Main ball body ---
  const gradient = ctx.createRadialGradient(
    -r * 0.3,
    -r * 0.3,
    r * 0.3,
    0,
    0,
    r
  );
  gradient.addColorStop(0, "#E97451"); // burnt sienna (warm orange-brown)
  gradient.addColorStop(0.5, "#C1440E"); // dark pumpkin orange
  gradient.addColorStop(1, "#6E260E"); // deep chestnut brown

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 8;
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Reflective highlight
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.shadowBlur = 0;
  ctx.arc(-r * 0.3, -r * 0.3, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // --- Transparent overlay colored by effect ---
  // Only apply if NOT floating or if it's the floating overlay itself
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  if (ball.isFloating) {
    // Floating overlay takes precedence
    ctx.fillStyle = "rgba(135, 206, 250, 0.7)"; // SkyBlue
  } else if (jumpPowerUpActive) {
    ctx.fillStyle = "rgba(255, 140, 0, 0.7)"; // orange
  } else if (ball.slipEffectTimer > 0) {
    ctx.fillStyle = "rgba(173, 216, 230, 0.7)"; // light blue
  } else if (ball.bounceEffectTimer > 0) {
    ctx.fillStyle = "rgba(205, 92, 92, 0.7)"; // muted red
  } else {
    ctx.fillStyle = null;
  }

  if (ctx.fillStyle) {
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Gravity attraction visual from platforms ---
  // Disabled when floating
  if (ball.gravityAffectedBy && !ball.isFloating) {
    const gravitySource = ball.gravityAffectedBy;
    const dx = gravitySource.x + gravitySource.width / 2 - ball.x;
    const dy = gravitySource.y + gravitySource.height / 2 - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(angle);

    // Draw a few motion arcs pointing toward the platform
    for (let i = 0; i < 3; i++) {
      const offsetY = (i - 1) * 5;
      const length = Math.min(50, distance * 0.3 + i * 5);
      const opacity = 0.15 + i * 0.05;

      ctx.beginPath();
      ctx.moveTo(0, offsetY);
      ctx.lineTo(length, offsetY);
      ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`; // cool blue tones for gravity
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Optional: subtle orbit circle around ball
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius * 1.4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100, 200, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  ctx.globalAlpha = 1;

  ball.wasOnGrassSpikes = false;

  // Speed Boost Aura - Disabled when floating
  if (speedBoostActive && !ball.isFloating) {
    // Pulsing orange-yellow glow for speed boost
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150);
    const auraRadius = r * (2 + pulse);
    const auraGradient = ctx.createRadialGradient(
      0,
      0,
      r * 0.8,
      0,
      0,
      auraRadius
    );
    auraGradient.addColorStop(0, `rgba(255, 223, 0, ${0.5 * pulse})`); // bright yellow
    auraGradient.addColorStop(1, `rgba(255, 140, 0, 0)`); // warm orange fade

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.fillStyle = auraGradient;
    ctx.shadowColor = `rgba(255, 223, 0, ${0.7 * pulse})`;
    ctx.shadowBlur = 40 * pulse;
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Optional: Slight color tint on ball itself during boost
    ctx.fillStyle = `rgba(255, 200, 0, ${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

const bouncySound = new Audio("spring.mp3");
bouncySound.volume = 0.5; // adjust volume as needed
function handleCollisions() {
  ball.canJump = false;
  let hitSpikes = false;
  let shouldEndGame = false; // New flag to track if game should end

  // Invulnerability timer for spikes reduces each frame
  if (ball.invulnerableTimer > 0) {
    ball.invulnerableTimer--;
  }

  // --- WINDBLAST with LIMITED PUSH ---
  if (ball.windblastActive) {
    ball.windblastDuration--;
    ball.isFloating = true; // Reduce gravity during windblast

    // --- Windblast Core Logic ---
    const screenCenterX = canvas.width / 2;
    const windFieldWidth = canvas.width * 0.75;
    const windFieldEdge = (canvas.width - windFieldWidth) / 2;

    if (ball.x > windFieldEdge && ball.x < canvas.width - windFieldEdge) {
      const distFromCenter = ball.x - screenCenterX;
      const maxDist = windFieldWidth / 2;

      // --- 1. Time-based Gust Factor ---
      const timeFactor = Math.sin(Date.now() / 300);
      const gustMultiplier = 0.8 + 0.4 * timeFactor;

      // --- 2. Directional Push (X-axis) ---
      const pushStrengthRatio = Math.max(
        -1,
        Math.min(1, distFromCenter / maxDist)
      );
      const horizontalForce = 0.35;
      const pushAmount = -pushStrengthRatio * horizontalForce * gustMultiplier;
      const windblastMaxPushSpeed = 4.5;

      if (pushAmount > 0 && ball.dx < windblastMaxPushSpeed) {
        ball.dx = Math.min(ball.dx + pushAmount, windblastMaxPushSpeed);
      } else if (pushAmount < 0 && ball.dx > -windblastMaxPushSpeed) {
        ball.dx = Math.max(ball.dx + pushAmount, -windblastMaxPushSpeed);
      }

      // --- 3. Upward Lift (Y-axis) ---
      const maxHeight = canvas.height * 0.2; // Rise only up to top 20%
      if (ball.y > maxHeight) {
        const liftStrengthRatio = 1 - Math.abs(pushStrengthRatio); // Strongest at center
        const upwardLift = 0.55 * liftStrengthRatio * gustMultiplier;

        const verticalSlowFactor =
          (ball.y - maxHeight) / (canvas.height - maxHeight);
        const verticalDampenedLift =
          upwardLift * (1 - Math.min(verticalSlowFactor, 1));

        ball.dy -= verticalDampenedLift;
      }

      // --- 4. Smooth Micro Turbulence ---
      const microTurbulence = 0.15;
      const t = Date.now() / 100;
      ball.dx += Math.sin(t + ball.y) * 0.5 * microTurbulence;
      ball.dy += Math.cos(t + ball.x) * 0.5 * microTurbulence;

      // --- 5. Optional Air Drag ---
      ball.dx *= 0.985;
      ball.dy *= 0.985;
    } else {
      ball.isFloating = false;
    }

    // --- 6. Final Speed Cap ---
    const maxUpwardSpeed = -7.5;
    const maxHorizontalSpeed = 7.0;
    ball.dy = Math.max(ball.dy, maxUpwardSpeed);
    ball.dx = Math.max(
      Math.min(ball.dx, maxHorizontalSpeed),
      -maxHorizontalSpeed
    );

    // --- 7. End windblast effect ---
    if (ball.windblastDuration <= 0) {
      ball.windblastActive = false;
      ball.isFloating = false;
    }
  }

  // --- END WIND BLAST EFFECT ---

  for (const p of platforms) {
    if (p.broken && p.opacity <= 0) continue;

    const isGravity = p.type === "gravity";
    const isFalling = ball.dy >= 0;
    const inXRange =
      ball.x + ball.radius > p.x && ball.x - ball.radius < p.x + p.width;
    const hittingTop =
      ball.y + ball.radius <= p.y + 1.5 &&
      ball.y + ball.radius + ball.dy >= p.y;

    // === LANDING ON TOP OF GRAVITY PLATFORM ===
    if (isGravity && isFalling && inXRange && hittingTop) {
      ball.y = p.y - ball.radius;
      ball.dy = 0;
      ball.canJump = true;
      continue;
    }

    // === GRAVITY FIELD AROUND PLATFORM (Smooth Reversal) ===
    if (isGravity) {
      const centerX = p.x + p.width / 2;
      const centerY = p.y + p.height / 2;

      if (ball.y >= centerY + 50) continue;

      const dx = centerX - ball.x;
      const dy = centerY - ball.y;
      const distance = Math.hypot(dx, dy);
      const gravityRadius = 60;

      if (distance < gravityRadius) {
        const gravityStrength = 0.12;
        const falloff = 1 - Math.pow(distance / gravityRadius, 2);

        const nx = dx / distance;
        const ny = dy / distance;

        let pushX, pushY;
        const innerRadius = 15;

        if (distance < innerRadius) {
          const reverseFactor = (innerRadius - distance) / innerRadius;
          pushY = ny * gravityStrength * falloff * (1 - 2 * reverseFactor);
          pushX = nx * gravityStrength * falloff * (1 - reverseFactor * 0.7);
        } else {
          pushX = nx * gravityStrength * falloff;
          pushY = ny * gravityStrength * falloff;
        }

        ball.dx += pushX;
        ball.dy += pushY;

        const maxSpeed = 5.5;
        const speed = Math.hypot(ball.dx, ball.dy);
        if (speed > maxSpeed) {
          ball.dx = (ball.dx / speed) * maxSpeed;
          ball.dy = (ball.dy / speed) * maxSpeed;
        }

        if (distance < 6) {
          const easing = 0.12;
          ball.x += dx * easing;
          ball.y += dy * easing;
          ball.dx *= 0.6;
          ball.dy *= 0.6;
        }
      } else {
        ball.dx *= 0.7;
        ball.dy *= 0.7;
      }

      continue;
    }

    // === SPIKES & GRASS SPIKES with Invulnerability Frames ===
    if (p.type === "spikes" || p.type === "grassspikes") {
      const circleX = ball.x;
      const circleY = ball.y;
      const radius = ball.radius;

      const rectX = p.x;
      const rectY = p.y;
      const rectW = p.width;
      const rectH = p.height;

      const closestX = Math.max(rectX, Math.min(circleX, rectX + rectW));
      const closestY = Math.max(rectY, Math.min(circleY, rectY + rectH));

      const dx = circleX - closestX;
      const dy = circleY - closestY;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= radius * radius) {
        if (ball.invulnerableTimer <= 0) {
          if (p.type === "spikes") {
            ball.hp = Math.max(0, ball.hp - 0.5);
          } else if (p.type === "grassspikes") {
            ball.hp = Math.max(0, ball.hp - 0.3);
          }
          ball.invulnerableTimer = 60;
        }
        hitSpikes = true;
        if (ball.dy >= 0) {
          ball.y = rectY - ball.radius;
          if (p.type === "grassspikes") {
            ball.dy = -Math.abs(jumpForceBase * 1.1);
            ball.canJump = true;
          } else {
            ball.dy = 0;
          }
        }
      }
    }

    // === NORMAL PLATFORM COLLISION + Fragile Platform ===
    else if (isFalling && inXRange && hittingTop) {
      ball.y = p.y - ball.radius;
      ball.dy = 0;

      switch (p.type) {
        case "bouncy":
          let bouncyForce = jumpForceBase * 1.4;
          if (jumpPowerUpActive) {
            bouncyForce += jumpForceBase * 0.4;
            jumpPowerUpActive = false;
          }
          ball.dy = -Math.abs(bouncyForce);
          ball.bounceEffectTimer = 10;
          ball.canJump = true;
          if (bouncySound) {
            bouncySound.currentTime = 0;
            bouncySound.play();
          }
          break;

        case "slip":
          if (p.isSoap) {
            ball.dx *= 1.1;
            ball.dy = -Math.abs(jumpForceBase * 1.1);
            ball.soapEffectTimer = Math.max(ball.soapEffectTimer, 10);
            ball.slipEffectTimer = Math.max(ball.slipEffectTimer, 15);
          } else {
            const slipperiness = 0.88 + Math.random() * 0.1;
            ball.dx *= slipperiness;
            ball.dy = 0;
            ball.slipEffectTimer = slipperiness > 0.97 ? 15 : 10;
          }
          break;

        case "ice":
          ball.dy = 0;
          if (ball.dx === 0) {
            ball.dx = Math.random() < 0.5 ? -1.8 : 1.8;
          } else {
            ball.dx *= 1.03;
            ball.dx = Math.max(Math.min(ball.dx, 4.5), -4.5);
          }
          if (ball.slipEffectTimer <= 0) ball.slipEffectTimer = 18;
          ball.slowTimer = 0;
          ball.originalDx = null;
          break;

        case "windblast":
          ball.windblastActive = true;
          ball.windblastDuration = 240;
          p.collected = true;
          ball.dy = -4;
          break;

        default:
          ball.dy = 0;
          if (!ball.slowTimer || ball.slowTimer <= 0) {
            ball.slowTimer = 100;
            ball.originalDx = ball.dx;
          }
          if (ball.slowTimer > 0) {
            const brakingProgress = (100 - ball.slowTimer) / 100;
            ball.dx = ball.originalDx * (1 - brakingProgress);
            ball.slowTimer--;
            if (ball.slowTimer <= 0) {
              ball.dx = 0;
              ball.originalDx = null;
            }
          }
          break;
      }

      ball.canJump = true;

      if (p.type === "fragile") {
        if (!p.warningTimer || p.warningTimer <= 0) {
          p.warningTimer = 30;
        } else if (p.warningTimer > 0) {
          p.warningTimer--;
          if (p.warningTimer === 0) {
            p.breakTemporarily();
          }
        }
      }

      break;
    }
  }

  // === POISON TICK WITH SCALING DAMAGE ===
  if (ball.poisoned) {
    if (ball.poisonTimer > 0) {
      ball.poisonTimer--;
      if (ball.poisonTimer % 30 === 0) {
        let poisonDamage = 0.01 + 0.015 * (ball.hp / 3);
        ball.hp = Math.max(0, ball.hp - poisonDamage);
      }
    } else {
      ball.poisoned = false;
    }
  }

  // === DX RECOVERY (slowTimer) ===
  if (ball.slowTimer && ball.slowTimer > 0) {
    ball.slowTimer--;
    ball.dx += (ball.originalDx - ball.dx) * 0.1;
    if (ball.slowTimer === 0) {
      ball.dx = ball.originalDx;
      ball.originalDx = null;
    }
  }

  // === COIN COLLECTION with Combo Multiplier ===
  ball.coinComboTimer = ball.coinComboTimer || 0;
  ball.coinComboCount = ball.coinComboCount || 0;

  coins.forEach((c) => {
    if (!c.collected) {
      const dx = ball.x - c.x;
      const dy = ball.y - c.y;
      if (Math.hypot(dx, dy) < ball.radius + c.radius) {
        c.collected = true;
        ball.coinComboCount++;
        ball.coinComboTimer = 60;
        score += c.value * ball.coinComboCount;
      }
    }
  });

  if (ball.coinComboTimer > 0) {
    ball.coinComboTimer--;
  } else {
    ball.coinComboCount = 0;
  }

  // === Check for game over conditions ===
  if (ball.hp <= 0) {
    shouldEndGame = true;
  }

  if (ball.y - ball.radius > canvas.height) {
    if (ball.hasRescuePowerup) {
      ball.hasRescuePowerup = false;
      ball.y = canvas.height - 100;
      ball.dy = 0;
    } else {
      shouldEndGame = true;
    }
  }

  if (hitSpikes) {
    // triggerScreenShake();
  }

  if (shouldEndGame) {
    isGameOver = true;
  }
}

function drawPoisonEffect() {
  ctx.save();
  const radius = ball.radius * 1.5;
  const gradient = ctx.createRadialGradient(
    ball.x,
    ball.y,
    ball.radius * 0.5,
    ball.x,
    ball.y,
    radius
  );
  gradient.addColorStop(0, "rgba(50, 205, 50, 0.6)"); // limegreen center
  gradient.addColorStop(1, "rgba(50, 205, 50, 0)"); // fade out

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Optional visual poison effect function (call inside render loop)
function showGreenPoisonEffect(x, y) {
  // Simple green particle or puff effect
  ctx.save();
  ctx.beginPath();
  let radius = ball.radius * 2;
  let grad = ctx.createRadialGradient(x, y, ball.radius * 0.5, x, y, radius);
  grad.addColorStop(0, "rgba(50, 205, 50, 0.5)");
  grad.addColorStop(1, "rgba(50, 205, 50, 0)");

  ctx.fillStyle = grad;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Spawn a new platform above the last one
function spawnPlatformAbove() {
  const difficulty = Math.min(1, Math.pow((score || 0) / 1000, 1.3));
  const recent = platforms.slice(-5);
  const lastPlatform = platforms[platforms.length - 1];
  const lastGrass = [...platforms]
    .reverse()
    .find((p) => p.type === "grassspikes");

  // Cooldowns initialization
  if (!spawnPlatformAbove.cooldowns) {
    spawnPlatformAbove.cooldowns = {
      spikes: 0,
      grassspikes: 0,
      fragile: 0,
      bouncy: 0,
      moving: 0,
      slip: 0,
      ice: 0,
      gravity: 0,
      windblast: 0, // Added windblast to cooldowns
    };
  }
  const cd = spawnPlatformAbove.cooldowns;

  // Decrease cooldowns
  for (const key in cd) {
    cd[key] = Math.max(0, cd[key] - 0.5);
  }

  const countRecent = (type) => recent.filter((p) => p.type === type).length;

  const maxSpikes = 2 + Math.floor(difficulty * 3);
  const spikeChance = 0.08 + Math.sin((difficulty * Math.PI) / 2) * 0.17;

  const rawChances = {
    spikes: spikeChance * (1 - difficulty * 0.3),
    grassspikes: (0.05 + difficulty * 0.08) * (1 - difficulty * 0.2),
    fragile: 0.13 + difficulty * 0.1,
    bouncy: 0.13 + difficulty * 0.1,
    moving: 0.13 + difficulty * 0.1,
    slip: 0.1 + difficulty * 0.05,
    ice: 0.08 + difficulty * 0.04,
    gravity: 0.07 + difficulty * 0.05,
    windblast: 0.09 + difficulty * 0.04, // Added windblast chance
    static: Math.max(0.1, 0.4 - difficulty * 0.3),
  };

  // Penalize based on recent count or cooldown
  for (const type in rawChances) {
    if (
      (type === "spikes" && countRecent("spikes") >= maxSpikes) ||
      (type === "grassspikes" && countRecent("grassspikes") >= 1) ||
      (["fragile", "bouncy", "moving"].includes(type) &&
        countRecent(type) >= 3) ||
      (["slip", "ice", "gravity", "windblast"].includes(type) &&
        countRecent(type) >= 2) || // Added windblast to recent count penalty
      cd[type] > 0
    ) {
      rawChances[type] *= 0.1;
    }
  }

  // Normalize
  let total = Object.values(rawChances).reduce((a, b) => a + b, 0);
  if (total === 0) {
    rawChances.static = 1;
    total = 1;
  }
  for (const key in rawChances) rawChances[key] /= total;

  // Pick a type
  let type = "static";
  let r = Math.random(),
    acc = 0;
  for (const [key, chance] of Object.entries(rawChances)) {
    if (
      key === "grassspikes" &&
      lastGrass &&
      Math.abs(lastPlatform.y - lastGrass.y) < 300
    )
      continue;
    acc += chance;
    if (r < acc) {
      type = key;
      break;
    }
  }

  // Safety and diversity constraints
  const lastTypes = platforms.slice(-3).map((p) => p.type);
  if (
    (lastTypes.includes("spikes") && type === "spikes") ||
    (lastTypes.includes("grassspikes") && type === "grassspikes")
  ) {
    type = "static";
  }
  if (
    ["spikes", "grassspikes"].includes(lastPlatform.type) &&
    type !== "static"
  ) {
    type = "static";
  }

  // Apply cooldown
  if (type !== "static") {
    cd[type] = type === "spikes" ? 10 : type === "grassspikes" ? 12 : 7;
    if (type === "windblast") cd[type] = 7; // Specific cooldown for windblast
  }

  // Vertical spacing
  const baseDistance = 90;
  const maxDistance = 130;
  const verticalDistance =
    baseDistance + difficulty * (maxDistance - baseDistance);
  const y = lastPlatform.y - verticalDistance;

  // Width & horizontal position
  const minWidth = 50 + (1 - difficulty) * 30;
  const maxWidth = 90 + (1 - difficulty) * 50;
  const width = minWidth + Math.random() * Math.max(0, maxWidth - minWidth);
  const x = Math.random() * (canvas.width - width);

  platforms.push(new Platform(x, y, width, 10, type));

  // Spawn collectibles (coins only)
  if (!["spikes", "grassspikes"].includes(type)) {
    const coinCount = Math.random() < 0.2 ? 3 : 1;
    for (let i = 0; i < coinCount; i++) {
      const baseX = x + (width / (coinCount + 1)) * (i + 1);
      const jitterX = (Math.random() - 0.5) * 15;
      const coinType = Math.random() < 0.1 ? "gold" : "normal";
      coins.push(new Coin(baseX + jitterX, y - 15, coinType));
    }
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function update() {
  if (isGameOver) return;

  const now = performance.now();

  // Call the new function to handle all passive skill state changes
  updatePassiveSkills(now);

  // === Constants & Multipliers ===
  const speedBoostMultiplier = speedBoostActive ? 1.5 : 1;
  const acceleration = 0.1 * speedBoostMultiplier;
  const decelerationFactor = speedBoostActive ? 0.15 : 0.1;

  const gravityRadius = 100;
  const antiGravityZone = 30;
  const minGravityForce = 0.0;

  const maxHorizontalSpeed = ball.speed * speedBoostMultiplier;
  const velocitySmoothFactor = 0.9;

  // === Cache ball position for calculations ===
  let bx = ball.x;
  let by = ball.y;

  // === Horizontal Movement ===
  // Player horizontal input is always at full effect.
  if (keys.left) {
    ball.dx -= acceleration;
  } else if (keys.right) {
    ball.dx += acceleration;
  } else {
    ball.dx *= decelerationFactor;
    if (Math.abs(ball.dx) < 0.05) ball.dx = 0;
  }

  ball.dx = clamp(ball.dx, -maxHorizontalSpeed, maxHorizontalSpeed);
  ball.dx *= velocitySmoothFactor;
  bx += ball.dx;

  // --- Floating Upward Force from Windblast Platforms Logic ---
  let applyFloatingUpwardForce = false; // Flag to check if ball should receive upward force
  const floatActivationRadius = 50; // The limited distance around a windblast platform for upward floating
  const floatUpwardForce = -0.1; // The limited upward force applied when floating (negative for upward)

  // First, assume not floating from a timed windblast.
  // This helps prevent conflicts if windblastActive is true but we only want proximity floating.
  ball.isFloating = false;

  // Check for proximity-based floating from "windblast" platforms
  for (const p of platforms) {
    if (p.type === "windblast") {
      const centerX = p.x + p.width / 2;
      const centerY = p.y + p.height / 2;
      const dist = Math.hypot(centerX - bx, centerY - by);

      if (dist < floatActivationRadius + ball.radius) {
        applyFloatingUpwardForce = true; // Ball is within range for upward force
        ball.isFloating = true; // Mark as floating to disable jumping and modify gravity
        break;
      }
    }
  }

  // Apply floating upward force if the ball is within the limited distance
  if (applyFloatingUpwardForce) {
    ball.dy += floatUpwardForce;
  }

  // --- Windblast (Timed effect, if still used, but no longer directly causes "floating" unless also near a platform) ---
  // If ball.windblastActive is meant to be a separate timed effect that *also* makes the ball float,
  // you might need to adjust the logic above to combine conditions.
  // For now, it won't directly make it float or apply horizontal force.
  if (ball.windblastActive) {
    ball.windblastDuration--;
    if (ball.windblastDuration <= 0) {
      ball.windblastActive = false;
    }
  }

  // === Gravity Behavior Based on Gravity Platforms ===
  // Base gravity force, potentially reduced by Gravity Resistance skill
  let gravityForce = gravityResistanceActive
    ? ball.gravity * 0.85
    : ball.gravity;
  let gravityDirection = 1; // Default gravity direction (downwards)
  let nearestDist = Infinity; // To find the closest gravity platform

  // Loop through platforms to find gravity platforms and calculate their effect
  for (const p of platforms) {
    if (p.type !== "gravity") continue; // Skip non-gravity platforms

    const centerX = p.x + p.width / 2;
    const centerY = p.y + p.height / 2;
    const dx = centerX - bx;
    const dy = centerY - by;
    const dist = Math.hypot(dx, dy);

    // If ball is within gravityRadius of a gravity platform and it's the nearest one
    if (dist < gravityRadius && dist < nearestDist) {
      nearestDist = dist; // Update nearest distance

      if (dist < antiGravityZone) {
        // Within anti-gravity zone, reverse gravity and reduce its force
        gravityDirection = -1; // Push upwards (anti-gravity effect)
        gravityForce = Math.max(
          minGravityForce, // Ensure gravity force doesn't go below min
          gravityForce * (1 - dist / antiGravityZone) // Gradually reduce force closer to center
        );
      } else {
        // Outside anti-gravity zone, normal gravity direction but can be reduced
        gravityDirection = 1; // Push downwards
        const ratio = (gravityRadius - dist) / gravityRadius;
        const easedRatio = ratio * ratio; // Apply easing for smoother transition
        gravityForce *= 1 - easedRatio * 0.8; // Reduce gravity force further away

        // Add a slight curving effect towards the platform
        const angle = Math.atan2(dy, dx);
        const curveFactor = Math.sin(now / 200 + dist) * 0.1;
        ball.dx += curveFactor * Math.cos(angle);
      }
    }
  }

  // Apply gravity and clamp vertical speed
  // Gravity is applied UNLESS the ball is currently set to float (ball.isFloating).
  if (!ball.isFloating) {
    ball.dy += gravityForce * gravityDirection;
  }
  ball.dy = clamp(ball.dy, -20, 20); // Clamp vertical speed to prevent excessive velocity
  by += ball.dy;

  // === Wall Collision ===
  if (bx - ball.radius < 0) {
    bx = ball.radius;
    ball.dx = -ball.dx * 0.25; // Bounce off left wall
  } else if (bx + ball.radius > canvas.width) {
    bx = canvas.width - ball.radius;
    ball.dx = -ball.dx * 0.25; // Bounce off right wall
  }

  // === Floor Collision ===
  if (by + ball.radius > canvas.height) {
    by = canvas.height - ball.radius;
    ball.dy = 0; // Stop vertical movement
    ball.canJump = true; // Allow jumping again
  }

  // === Assign new position to ball ===
  ball.x = bx;
  ball.y = by;

  // === Platform Collision Handling ===
  handleCollisions(); // Assuming this function exists elsewhere

  // === Recycle Platforms ===
  platforms = platforms.filter((p) => p.y < canvas.height + 50); // Remove off-screen platforms
  while (platforms.length < platformCount) {
    spawnPlatformAbove(); // Add new platforms
  }

  // === Smooth Camera Scrolling ===
  const cameraThreshold = canvas.height / 2;
  if (ball.y < cameraThreshold) {
    const offset = cameraThreshold - ball.y;
    const lerpFactor = 0.1;
    const smoothedOffset = offset * lerpFactor;

    // Move platforms, coins, and adjust max height to simulate camera scrolling
    platforms.forEach((p) => (p.y += smoothedOffset));
    coins.forEach((c) => (c.y += smoothedOffset));
    maxHeight += smoothedOffset;
    ball.y += smoothedOffset; // Keep ball relatively centered
  }

  // === Update Platforms & Coins ===
  platforms.forEach((p) => p.update()); // Assuming platform update method
  coins = coins.filter((c) => !c.collected); // Filter out collected coins

  // === Jump Power-Up Expiry ===
  if (jumpPowerUpActive && now - lastJumpPowerUseTime > JUMP_POWER_DURATION) {
    jumpPowerUpActive = false;
  }

  // === Auto-Jump Force Boost from Gravity ===
  let autoJumpPower = 0.5;
  if (nearestDist < gravityRadius) {
    const t = 1 - nearestDist / gravityRadius;
    autoJumpPower = clamp(0.5, 2, 0.5 + 1.5 * (t * t)); // Increase jump power near gravity platforms
  }

  // === Jump Trigger Logic ===
  // Only allow jumping if the ball is not currently floating
  if (keys.jumpPressed && ball.canJump && !ball.isFloating) {
    let jumpForceFinal = autoJumpPower * jumpForceMax; // Base jump force

    if (jumpPowerUpActive) {
      jumpForceFinal *= 1.15; // Boost jump force with power-up
    }

    jumpForceFinal += 4; // Additional fixed jump boost

    ball.dy = -jumpForceFinal; // Apply upward jump force

    // Add horizontal momentum if moving left/right during jump
    if (keys.left) {
      ball.dx = -Math.abs(maxHorizontalSpeed * 0.9);
    } else if (keys.right) {
      ball.dx = Math.abs(maxHorizontalSpeed * 0.9);
    }

    ball.canJump = false; // Prevent jumping mid-air
    keys.jumpPressed = false; // Reset jump key state
  }
}

// passive skill state management

// Update function to handle game logic and physics
// Declare platformCount globally to match your platform generation count
const platformCount = 18;
let speedBoostActive = false;
let speedBoostCooldown = 2900; // 2.9 seconds cooldown
let speedBoostDuration = 6250; // 6.25 seconds active duration

let speedBoostLastActivated = 0;

// gravity resistance settings
let gravityResistanceActive = false;
let gravityResistanceLastActivated = 0;
const gravityResistanceCooldown = 7650; // 7.65 seconds cooldown
const gravityResistanceDuration = 5500; // 5.5 seconds active

function updatePassiveSkills(now) {
  // --- Speed Boost Passive Skill Logic ---
  if (!speedBoostActive) {
    // If the skill is NOT active, check if it's ready to be activated again.
    // The time since the last activation must be greater than its full cycle (duration + cooldown).
    if (
      now - speedBoostLastActivated >=
      speedBoostCooldown + speedBoostDuration
    ) {
      speedBoostActive = true;
      speedBoostLastActivated = now; // Reset the activation timer
    }
  } else {
    // If the skill IS active, check if its duration has run out.
    if (now - speedBoostLastActivated >= speedBoostDuration) {
      speedBoostActive = false; // Deactivate the skill
    }
  }

  // --- Gravity Resistance Passive Skill Logic ---
  if (!gravityResistanceActive) {
    // Check if the skill is ready to be activated.
    if (
      now - gravityResistanceLastActivated >=
      gravityResistanceCooldown + gravityResistanceDuration
    ) {
      gravityResistanceActive = true;
      gravityResistanceLastActivated = now; // Reset the activation timer
    }
  } else {
    // If the skill is active, check if its duration has run out.
    if (now - gravityResistanceLastActivated >= gravityResistanceDuration) {
      gravityResistanceActive = false; // Deactivate the skill
    }
  }
}

//  handle HP regeneration
let lastHpRegenTime = Date.now();
const HP_REGEN_INTERVAL = 5000; // 5 seconds
const HP_REGEN_AMOUNT = 0.2;
const HP_MAX = 3;
const HP_MIN = 0;
let maxHeight = 0;

// Setup noise canvas once outside draw()
const fogNoiseCanvas = document.createElement("canvas");
const fogNoiseCtx = fogNoiseCanvas.getContext("2d");
fogNoiseCanvas.width = 200;
fogNoiseCanvas.height = 100;

function generateFogNoise() {
  fogNoiseCtx.clearRect(0, 0, fogNoiseCanvas.width, fogNoiseCanvas.height);
  for (let i = 0; i < 300; i++) {
    let x = Math.random() * fogNoiseCanvas.width;
    let y = Math.random() * fogNoiseCanvas.height;
    let alpha = Math.random() * 0.1; // subtle dots
    fogNoiseCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    fogNoiseCtx.beginPath();
    fogNoiseCtx.arc(x, y, 1.5, 0, Math.PI * 2);
    fogNoiseCtx.fill();
  }
}
generateFogNoise();

let fogOffset = 0;

// ----- STARFIELD SETUP -----
const stars = [];
const NUM_STARS = 100;

function initStars() {
  for (let i = 0; i < NUM_STARS; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.2 + 0.3,
      alpha: Math.random(),
      alphaChange: Math.random() * 0.02 + 0.005, // twinkle speed
      // Add random pastel colors for each star
      color: `hsl(${Math.random() * 360}, 70%, 80%)`,
    });
  }
}
initStars();

function drawStars() {
  stars.forEach((star) => {
    // twinkle effect: alpha goes up and down smoothly
    star.alpha += star.alphaChange;
    if (star.alpha >= 1 || star.alpha <= 0.1) {
      star.alphaChange = -star.alphaChange;
    }

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    // Use star.color with alpha for fillStyle
    ctx.fillStyle = `hsla(${
      star.color.match(/\d+/g)[0]
    }, 70%, 80%, ${star.alpha.toFixed(2)})`;
    ctx.fill();
  });
}

// --------- MAIN DRAW FUNCTION ----------
function draw() {
  // Clear canvas with black background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw twinkling stars behind everything
  drawStars();

  // --- Draw platforms and coins ---
  platforms.forEach((p) => p.draw());
  coins.forEach((c) => c.draw());

  // --- Draw player ball ---
  drawBall();

  // Clamp HP
  ball.hp = Math.max(HP_MIN, Math.min(ball.hp, HP_MAX));

  // --- Base fog gradient (fade from top) ---
  let fogGradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
  fogGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  fogGradient.addColorStop(1, "rgba(255, 255, 255, 0.15)");
  ctx.fillStyle = fogGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // --- Drifting fog noise ---
  fogOffset = (fogOffset + 0.3) % fogNoiseCanvas.height;

  ctx.save(); // Save drawing state
  ctx.globalAlpha = 0.2;

  for (
    let y = -fogNoiseCanvas.height;
    y < canvas.height;
    y += fogNoiseCanvas.height
  ) {
    ctx.drawImage(
      fogNoiseCanvas,
      0,
      Math.floor(y + fogOffset),
      canvas.width,
      fogNoiseCanvas.height
    );
  }

  ctx.restore(); // Restore alpha state

  // --- HUD ---
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top"; // Fix blurry text vertically
  ctx.fillText(`Score: ${score}`, 20, 20);
  ctx.fillText(`HP: ${ball.hp.toFixed(1)}`, 20, 50);

  let feet = Math.floor(maxHeight / 10);
  ctx.fillText(`Height: ${feet} ft`, 20, 80);

  // Jump power status
  let jumpPowerText;
  if (jumpPowerUpActive) {
    jumpPowerText = "Jump Power: Active";
  } else {
    let cooldownRemaining = Math.max(
      0,
      Math.ceil(
        (JUMP_POWER_COOLDOWN - (Date.now() - lastJumpPowerUseTime)) / 1000
      )
    );
    jumpPowerText =
      cooldownRemaining > 0
        ? `Jump Power: Ready in ${cooldownRemaining}s`
        : "Jump Power: Ready";
  }
  ctx.fillText(jumpPowerText, 20, 110);

  // --- Game Over Overlay ---
  if (isGameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "50px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 30);

    ctx.font = "30px Arial";
    ctx.fillText(
      `Final Score: ${score}`,
      canvas.width / 2,
      canvas.height / 2 + 20
    );
    return; // Skip updates
  }

  // --- HP Regeneration ---
  let now = Date.now();
  if (now - lastHpRegenTime >= HP_REGEN_INTERVAL) {
    if (ball.hp < HP_MAX) {
      ball.hp = Math.min(ball.hp + HP_REGEN_AMOUNT, HP_MAX);
    }
    lastHpRegenTime = now;
  }
}

function gameLoop() {
  update();
  draw();
  if (ball.slipEffectTimer > 0) {
    ball.slipEffectTimer--;
  }
  drawStars();
  if (!isGameOver) requestAnimationFrame(gameLoop);
}

// Load the jump sound at the top of your script (if not already loaded)
const jumpSound = new Audio("jump.mp3");
jumpSound.volume = 0.5;

const powerUpSound = new Audio("");
powerUpSound.volume = 0.5;

window.addEventListener("keydown", (e) => {
  // Prevent default page scroll on movement/jump keys
  if (
    e.code === "ArrowLeft" ||
    e.code === "KeyA" ||
    e.code === "ArrowRight" ||
    e.code === "KeyD" ||
    e.code === "Space"
  ) {
    e.preventDefault();
  }

  // Move Left
  if (e.code === "ArrowLeft" || e.code === "KeyA") {
    keys.left = true;
  }

  // Move Right
  if (e.code === "ArrowRight" || e.code === "KeyD") {
    keys.right = true;
  }

  // Jump
  if (e.code === "Space" && ball.canJump) {
    keys.jumpHeld = true;

    // Play jump sound
    jumpSound.currentTime = 0;
    jumpSound.play();
  }

  // Activate Jump Power-Up
  if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && !e.repeat) {
    const now = Date.now();

    if (
      !jumpPowerUpActive &&
      now - lastJumpPowerUseTime >= JUMP_POWER_COOLDOWN
    ) {
      jumpPowerUpActive = true;
      lastJumpPowerUseTime = now;

      // Play power-up sound
      powerUpSound.currentTime = 0;
      powerUpSound.play();

      // Play jump sound for power-jump effect
      jumpSound.currentTime = 0;
      jumpSound.play();

      // Automatically deactivate power-up after duration
      setTimeout(() => {
        jumpPowerUpActive = false;
      }, JUMP_POWER_DURATION);
    }
  }
});

// ==== KEYUP ====
window.addEventListener("keyup", (e) => {
  const { code } = e;

  // Prevent default page scroll on movement/jump keys
  if (
    code === "ArrowLeft" ||
    code === "KeyA" ||
    code === "ArrowRight" ||
    code === "KeyD" ||
    code === "Space"
  ) {
    e.preventDefault();
  }

  // Movement key release
  if (code === "ArrowLeft" || code === "KeyA") {
    keys.left = false;
  } else if (code === "ArrowRight" || code === "KeyD") {
    keys.right = false;
  }

  // Jump release handling
  if (code === "Space" && keys.jumpHeld && ball.canJump) {
    // Balance boost: stronger negative velocity means stronger upward jump
    // Adjust this number to balance the jump height with power-up
    const boost = jumpPowerUpActive ? -7 : 0; // -7 is a stronger boost than -6

    ball.dy = jumpForceCurrent + boost;

    ball.canJump = false;
    keys.jumpHeld = false;
    jumpForceCurrent = jumpForceBase;
    jumpHoldStartTime = null;
  }
});
