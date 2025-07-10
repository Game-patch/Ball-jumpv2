// Different platform types
// Assume ctx and canvas are globally available and initialized
// e.g., const canvas = document.getElementById('myCanvas');
//       const ctx = canvas.getContext('2d');

class Platform {
  constructor(
    x,
    y,
    width,
    height,
    type = "static",
    bounceDirection = null,
    bounceForceMultiplier = 1,
    // New parameters for windblast
    windDirection = "up", // "up", "left", "right"
    windForceMultiplier = 1
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;

    this.broken = false;
    this.opacity = 1;
    this.direction = 1; // For moving platforms
    this.speed = 1.5;   // For moving platforms

    this.pulse = 0; // For bouncy, etc.
    this.scale = 1; // For bouncy

    this.breakDuration = 100;
    this.breakTimer = 0;

    this.slipPulse = 0; // For slip, ice

    this.bounceDirection = bounceDirection;
    this.bounceForceMultiplier = bounceForceMultiplier;

    // Windblast specific
    if (type === "windblast") {
      this.windDirection = windDirection;
      this.windForceMultiplier = Math.max(0.1, windForceMultiplier); // Ensure force is not zero or negative
      this.windPulse = 0;
      this.particles = [];
      this.particleSpawnTimer = 0;
      // Particle spawn rate can be faster for stronger winds, capped at a minimum interval
      this.particleSpawnInterval = Math.max(2, Math.round(5 / this.windForceMultiplier));
    }


    if (type === "ice") {
      this.cracks = Array.from({ length: 3 }, () => ({
        startX: Math.random() * width * 0.7,
        startY: Math.random() * height,
        endX: Math.random() * width * 0.7 + width * 0.3,
        endY: Math.random() * height + (Math.random() - 0.5) * height * 0.2,
      }));
    }

    if (
      ["static", "fragile", "moving", "slip", "bouncy", "gravity", "windblast"].includes( // Added "windblast"
        type
      )
    ) {
      this.cachedGradient = this.createBaseGradient(type);
    }

    if (type === "spikes") this.cachedSpikes = this.generateSpikeData();
    if (type === "grassspikes")
      this.cachedGrassSpikes = this.generateGrassData();
  }

  createBaseGradient(type) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    switch (type) {
      case "fragile":
        grad.addColorStop(0, "#D96459");
        grad.addColorStop(1, "#C44536");
        break;
      case "moving":
        grad.addColorStop(0, "#6CA0DC");
        grad.addColorStop(1, "#1B4F72");
        break;
      case "slip":
        grad.addColorStop(0, "#B2BABB");
        grad.addColorStop(1, "#626567");
        break;
      case "bouncy":
        grad.addColorStop(0, "#A9DFBF");
        grad.addColorStop(1, "#2ECC71");
        break;
      case "gravity":
        grad.addColorStop(0, "#F4D03F");
        grad.addColorStop(1, "#D68910");
        break;
      case "windblast": // New gradient for windblast
        grad.addColorStop(0, "#E0FFFF"); // Light cyan / pale sky blue
        grad.addColorStop(1, "#B0E0E6"); // Powder blue
        break;
      default: // Static
        grad.addColorStop(0, "#A47551");
        grad.addColorStop(1, "#6E4B26");
        break;
    }
    return grad;
  }

  generateSpikeData() {
    const spikes = [];
    const spikeCount = Math.floor(this.width / 8);
    const spikeMaxHeight = this.height * 1.5;
    for (let i = 0; i < spikeCount; i++) {
      spikes.push({
        i,
        spikeHeight: spikeMaxHeight * (0.85 + Math.random() * 0.3),
      });
    }
    return spikes;
  }

  generateGrassData() {
    const blades = [];
    const spikeCount = Math.floor(this.width / 4);
    for (let i = 0; i < spikeCount; i++) {
      blades.push({
        sx: (this.width / spikeCount) * i,
        h1: 5 + Math.random() * 6,
        h2: 4 + Math.random() * 5,
      });
    }
    return blades;
  }

  breakTemporarily() {
    if (this.type !== "fragile" || this.broken) return;
    this.broken = true;
    this.breakTimer = this.breakDuration;
    this.opacity = 1;
  }

  update() {
    if (this.type === "moving" && !this.broken) {
      this.x += this.speed * this.direction;
      if (this.x < 0 || this.x + this.width > canvas.width) {
        this.direction *= -1;
      }
    }

    if (this.broken) {
      this.opacity -= 0.02;
      if (this.opacity < 0) this.opacity = 0;
      this.breakTimer--;
      if (this.breakTimer <= 0) {
        this.broken = false;
        this.opacity = 1;
      }
    }

    if (this.type === "bouncy") {
      this.pulse += 0.05;
      this.scale = 1 + 0.1 * Math.sin(this.pulse);
    }

    if (this.type === "slip" || this.type === "ice") {
      this.slipPulse += 0.1;
    }

    if (this.type === "slip") {
      this.x += Math.sin(this.slipPulse) * 0.3;
    }

    if (this.type === "windblast") {
      this.windPulse += 0.03; // Slower pulse for arrows, particle speed has its own pace
      this.particleSpawnTimer++;

      if (this.particleSpawnTimer >= this.particleSpawnInterval) {
        this.particleSpawnTimer = 0;
        this.spawnWindParticle();
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life--;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        switch (this.windDirection) {
          case "up":
            p.y -= p.speed;
            p.x += (Math.random() - 0.5) * p.speed * 0.3; // slight sideways drift proportional to speed
            break;
          case "left":
            p.x -= p.speed;
            p.y += (Math.random() - 0.5) * p.speed * 0.3; // slight vertical drift
            break;
          case "right":
            p.x += p.speed;
            p.y += (Math.random() - 0.5) * p.speed * 0.3; // slight vertical drift
            break;
        }
        p.opacity = (p.life / p.initialLife) * 0.7; // Max opacity 0.7 for softer particles
      }
    }
  }

  spawnWindParticle() {
    const particle = {
      x: 0,
      y: 0,
      size: Math.random() * 2.5 + 1.5, // Particle base size
      // Speed scales with windForceMultiplier, base speed of 1-2 units
      speed: (Math.random() * 1 + 1) * this.windForceMultiplier,
      opacity: 1,
      initialLife: 40 + Math.random() * 30, // Lifetime in frames
      life: 0,
    };
    particle.life = particle.initialLife;

    switch (this.windDirection) {
      case "up":
        particle.x = Math.random() * this.width;
        particle.y = this.height - particle.size; // Start at the bottom edge
        break;
      case "left":
        particle.x = this.width - particle.size; // Start at the right edge
        particle.y = Math.random() * this.height;
        break;
      case "right":
        particle.x = particle.size; // Start at the left edge
        particle.y = Math.random() * this.height;
        break;
    }
    this.particles.push(particle);
  }

  draw() {
    if (this.broken && this.opacity <= 0) return;

    ctx.save();

    if (this.type === "bouncy") {
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-this.width / 2, -this.height / 2);
    } else {
      ctx.translate(this.x, this.y);
    }

    // Moved shadow setup before specific draw calls that might not use the main fillRect
    switch (this.type) {
      case "gravity":
        ctx.shadowColor = "rgba(255, 215, 0, 0.7)";
        break;
      case "bouncy":
        ctx.shadowColor = "rgba(127, 255, 0, 0.8)";
        break;
      case "ice":
        ctx.shadowColor = `rgba(200, 230, 255, ${
          0.3 + 0.4 * Math.sin(this.slipPulse * 6)
        })`;
        break;
      case "slip":
        ctx.shadowColor = `rgba(149, 165, 166, ${
          0.4 + 0.3 * Math.sin(this.slipPulse * 4)
        })`;
        break;
      case "moving":
        ctx.shadowColor = "rgba(93, 173, 226, 0.6)";
        break;
      case "windblast": // Shadow for the windblast platform base
        ctx.shadowColor = "rgba(135, 206, 250, 0.6)"; // Lighter sky blue shadow
        break;
      default: // static, fragile
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        break;
    }
    ctx.shadowBlur = (this.type === "windblast" || this.type === "ice") ? 15 : 12; // Slightly larger blur for ethereal platforms


    if (this.type === "spikes") {
      this.drawSpikes(ctx); // Spikes draw their own base, no preceding fillRect needed from here
      ctx.restore();
      return;
    }

    if (this.type === "grassspikes") {
      this.drawGrassSpikes(ctx); // Also draws its own base
      ctx.restore();
      return;
    }

    if (this.type === "ice") {
      this.drawIce(ctx); // Draws its own complex surface
      ctx.restore();
      return;
    }

    if (this.type === "windblast") {
      this.drawWindblast(ctx); // Manages its full appearance
      ctx.restore();
      return;
    }

    // Default drawing for platforms that use cachedGradient directly
    ctx.fillStyle = this.cachedGradient;
    ctx.globalAlpha = this.opacity;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1; // Reset globalAlpha

    // Specific highlights or details for some types after base fill
    if (this.type === "bouncy") {
      ctx.strokeStyle = `rgba(127, 255, 0, ${
        0.7 + 0.3 * Math.sin(this.pulse * 4)
      })`;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, this.width, this.height);
      if (this.bounceDirection) this.drawBounceArrow(ctx);
    }

    ctx.restore();
  }

  drawWindblast(ctx) {
    // Base platform (shadow is already set from draw())
    ctx.fillStyle = this.cachedGradient;
    ctx.globalAlpha = this.opacity; // Respect platform opacity if it were breakable (though wind isn't)
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;

    // Draw wind particles (whooshing animation)
    // Particles don't get the platform's main shadow
    ctx.save();
    ctx.shadowColor = "transparent"; // No shadow for particles themselves

    this.particles.forEach(p => {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.beginPath();
      let particleWidth = p.size;
      let particleHeight = p.size;
      if (this.windDirection === "up") {
        particleHeight = p.size * (1.5 + p.speed * 0.2); // More elongated if faster
        particleWidth = p.size * 0.7;
      } else { // left or right
        particleWidth = p.size * (1.5 + p.speed * 0.2);
        particleHeight = p.size * 0.7;
      }
      ctx.ellipse(p.x, p.y, particleWidth/2, particleHeight/2, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore(); // Restore shadow settings if they were changed

    // Draw arrows indicating wind direction (also no shadow from platform base)
    this.drawWindArrows(ctx);
  }

  drawWindArrows(ctx) {
    ctx.save();
    ctx.shadowColor = "transparent"; // Arrows are overlays, no shadow from platform base
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 1;

    const arrowLength = 9; // Length of the arrow from base to tip
    const arrowHalfBase = 6; // Half-width of the arrow's base
    const arrowSpacing = 35; 
    const timeFactor = this.windPulse * this.windForceMultiplier; // Flow speed influenced by force

    if (this.windDirection === "up") {
      const numArrows = Math.max(1, Math.floor(this.width / arrowSpacing));
      const startX = (this.width - (numArrows -1) * arrowSpacing) / 2;
      let animOffsetY = (timeFactor * 10) % arrowSpacing;

      for (let yBase = animOffsetY - arrowSpacing; yBase < this.height + arrowLength; yBase += arrowSpacing) {
        for (let i = 0; i < numArrows; i++) {
          const currentX = startX + i * arrowSpacing;
          const currentY = this.height - yBase; 
          if (currentY > this.height + arrowLength/2 || currentY < -arrowLength/2) continue;

          ctx.save();
          ctx.translate(currentX, currentY);
          ctx.beginPath();
          ctx.moveTo(0, -arrowLength / 2); 
          ctx.lineTo(-arrowHalfBase, arrowLength / 2); 
          ctx.lineTo(arrowHalfBase, arrowLength / 2); 
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (this.windDirection === "left") {
      const numArrows = Math.max(1, Math.floor(this.height / arrowSpacing));
      const startY = (this.height - (numArrows -1) * arrowSpacing) / 2;
      let animOffsetX = (timeFactor * 10) % arrowSpacing;

      for (let xBase = animOffsetX - arrowSpacing; xBase < this.width + arrowLength; xBase += arrowSpacing) {
        for (let i = 0; i < numArrows; i++) {
          const currentY = startY + i * arrowSpacing;
          const currentX = this.width - xBase; 
          if (currentX > this.width + arrowLength/2 || currentX < -arrowLength/2) continue;
          
          ctx.save();
          ctx.translate(currentX, currentY);
          ctx.beginPath();
          ctx.moveTo(-arrowLength / 2, 0); 
          ctx.lineTo(arrowLength / 2, -arrowHalfBase); 
          ctx.lineTo(arrowLength / 2, arrowHalfBase);  
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (this.windDirection === "right") {
      const numArrows = Math.max(1, Math.floor(this.height / arrowSpacing));
      const startY = (this.height - (numArrows -1) * arrowSpacing) / 2;
      let animOffsetX = (timeFactor * 10) % arrowSpacing;

      for (let xBase = animOffsetX - arrowSpacing; xBase < this.width + arrowLength; xBase += arrowSpacing) {
        for (let i = 0; i < numArrows; i++) {
          const currentY = startY + i * arrowSpacing;
          const currentX = xBase; 
          if (currentX > this.width + arrowLength/2 || currentX < -arrowLength/2) continue;

          ctx.save();
          ctx.translate(currentX, currentY);
          ctx.beginPath();
          ctx.moveTo(arrowLength / 2, 0);  
          ctx.lineTo(-arrowLength / 2, -arrowHalfBase); 
          ctx.lineTo(-arrowLength / 2, arrowHalfBase); 
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  drawSpikes(ctx) {
    // Shadow for spike base should be set before this call if desired or handled internally
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, this.width, this.height);
    const spikeWidth = this.width / this.cachedSpikes.length;
    const spikeBaseY = this.height;

    this.cachedSpikes.forEach(({ i, spikeHeight }) => {
      const spikeX = i * spikeWidth;
      ctx.beginPath();
      ctx.moveTo(spikeX, spikeBaseY);
      ctx.lineTo(spikeX + spikeWidth / 2, spikeBaseY - spikeHeight);
      ctx.lineTo(spikeX + spikeWidth, spikeBaseY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(
        spikeX,
        spikeBaseY - spikeHeight,
        spikeX,
        spikeBaseY
      );
      grad.addColorStop(0, "#eeeeee");
      grad.addColorStop(0.6, "#888888");
      grad.addColorStop(1, "#222222");

      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  drawGrassSpikes(ctx) {
    // Shadow for grass base set by main draw()
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "#228b22"); 
    grad.addColorStop(1, "#006400");
    // ctx.shadowColor = "rgba(46, 139, 87, 0.5)"; // This shadow is already set by main draw() before calling this
    // ctx.shadowBlur = 12;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save(); // Isolate shadow changes for blades
    ctx.shadowColor = "transparent"; // Blades themselves shouldn't cast the platform's shadow

    ctx.fillStyle = "rgba(0,60,0,0.9)";
    this.cachedGrassSpikes.forEach(({ sx, h1 }) => {
      ctx.beginPath();
      ctx.moveTo(sx, this.height);
      ctx.lineTo(sx + 2, this.height - h1);
      ctx.lineTo(sx + 4, this.height);
      ctx.closePath();
      ctx.fill();
    });

    ctx.fillStyle = "rgba(173,255,47,0.6)"; 
    this.cachedGrassSpikes.forEach(({ sx, h2 }, i) => {
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(sx + 1, this.height);
        ctx.lineTo(sx + 2.5, this.height - h2);
        ctx.lineTo(sx + 4, this.height);
        ctx.closePath();
        ctx.fill();
      }
    });
    ctx.restore(); // Restore previous shadow settings
  }

  drawIce(ctx) {
    // Shadow for ice base set by main draw()
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, "rgba(220, 245, 255, 0.8)");
    grad.addColorStop(0.5, "rgba(180, 220, 255, 0.6)");
    grad.addColorStop(1, "rgba(160, 210, 255, 0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save(); // Isolate shadow changes for cracks/highlights
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = `rgba(204, 242, 255, 0.25)`; 
    ctx.lineWidth = 1;
    this.cracks.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(c.startX, c.startY);
      ctx.lineTo(c.endX, c.endY);
      ctx.stroke();
    });

    const highlightHeight = 4;
    const highlightGrad = ctx.createLinearGradient(0, 0, 0, highlightHeight);
    highlightGrad.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    highlightGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlightGrad;
    ctx.fillRect(0, 0, this.width, highlightHeight);
    ctx.restore();
  }

  drawBounceArrow(ctx) {
    ctx.save();
    // ctx.translate(this.width / 2, this.height / 2); // This is already done if bouncy platform drawing logic uses it
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 2;

    // Arrow is drawn relative to the center of the platform (0,0 after translation)
    // Assuming the main draw() for bouncy has translated to center
    ctx.beginPath();
    if (this.bounceDirection === "up") {
      ctx.moveTo(0, -10); ctx.lineTo(-8, 6); ctx.lineTo(8, 6);
    } else if (this.bounceDirection === "down") {
      ctx.moveTo(0, 10); ctx.lineTo(-8, -6); ctx.lineTo(8, -6);
    } else if (this.bounceDirection === "left") {
      ctx.moveTo(-10, 0); ctx.lineTo(6, -8); ctx.lineTo(6, 8);
    } else if (this.bounceDirection === "right") {
      ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
function startGame() {
  generateInitialPlatforms();
  isGameOver = false;
  gameStarted = true;
  score = 0;
  jumpForceCurrent = jumpForceBase;
  gameLoop();
}

startGame();
