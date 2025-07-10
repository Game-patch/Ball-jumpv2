let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFPS() {
  const now = performance.now();
  frameCount++;

  if (now - lastTime >= 1000) {
    fps = frameCount;
    console.clear(); // optional, clears console each second
    console.log("FPS:", fps);
    frameCount = 0;
    lastTime = now;
  }

  requestAnimationFrame(updateFPS);
}

updateFPS();
