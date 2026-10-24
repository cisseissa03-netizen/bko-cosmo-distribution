// Three.js Lightweight Decorative Scene for Wholesale Hero
// Strict constraints: lightweight procedural shapes, no heavy models, pauses offscreen,
// respects prefers-reduced-motion, graceful fallback.

export async function initHeroThree() {
  const canvas = document.getElementById('hero-three-canvas');
  const fallback = document.querySelector('.hero-fallback-visual');
  const toggleBtn = document.getElementById('toggle-3d-btn');

  if (!canvas) return;

  // 1. Check prefers-reduced-motion
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQuery.matches) {
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    return;
  }

  // 2. Load Three.js dynamically to guarantee zero blocking of other scripts
  let THREE;
  try {
    THREE = await import('../vendor/three.module.js');
  } catch (err) {
    console.warn('Three.js module could not be loaded, using visual fallback.', err);
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    return;
  }

  // 3. Test WebGL availability
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power'
    });
  } catch (err) {
    console.warn('WebGL not supported or disabled. Using static fallback.', err);
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    return;
  }

  const container = canvas.parentElement;
  let width = container.clientWidth || 400;
  let height = container.clientHeight || 360;

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xfff7ed, 1.2);
  dirLight1.position.set(5, 8, 5);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.8);
  dirLight2.position.set(-5, -3, 3);
  scene.add(dirLight2);

  const mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // Cosmetic Bottle
  const bottleBodyGeo = new THREE.CylinderGeometry(0.7, 0.75, 2.2, 32);
  const bottleMat = new THREE.MeshStandardMaterial({
    color: 0x0d5c75,
    roughness: 0.25,
    metalness: 0.15
  });
  const bottle = new THREE.Mesh(bottleBodyGeo, bottleMat);
  bottle.position.set(-0.8, -0.3, 0);

  const capGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.6, 24);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.2,
    metalness: 0.8
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.set(0, 1.4, 0);
  bottle.add(cap);
  mainGroup.add(bottle);

  // Jar
  const jarGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.8, 32);
  const jarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    metalness: 0.05
  });
  const jar = new THREE.Mesh(jarGeo, jarMat);
  jar.position.set(1.2, -0.9, 0.8);

  const jarLidGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.2, 32);
  const jarLidMat = new THREE.MeshStandardMaterial({
    color: 0x094154,
    roughness: 0.3,
    metalness: 0.2
  });
  const jarLid = new THREE.Mesh(jarLidGeo, jarLidMat);
  jarLid.position.set(0, 0.5, 0);
  jar.add(jarLid);
  mainGroup.add(jar);

  // Pearl Spheres
  const pearlGeo = new THREE.SphereGeometry(0.3, 24, 24);
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.15,
    metalness: 0.1
  });
  const pearl1 = new THREE.Mesh(pearlGeo, pearlMat);
  pearl1.position.set(1.4, 1.2, -0.5);
  mainGroup.add(pearl1);

  const pearl2 = new THREE.Mesh(pearlGeo, pearlMat);
  pearl2.position.set(-1.6, 1.0, 0.3);
  pearl2.scale.set(0.65, 0.65, 0.65);
  mainGroup.add(pearl2);

  let isPaused = false;
  let isOffscreen = false;
  let targetRotationX = 0;
  let targetRotationY = 0;

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    targetRotationY = x * 0.4;
    targetRotationX = y * 0.3;
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });

  function onResize() {
    if (!container) return;
    width = container.clientWidth;
    height = container.clientHeight || 360;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', onResize);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isOffscreen = !entry.isIntersecting;
      if (entry.isIntersecting && !isPaused) {
        requestAnimationFrame(renderLoop);
      }
    });
  }, { threshold: 0.1 });

  observer.observe(canvas);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isPaused = !isPaused;
      toggleBtn.textContent = isPaused ? '▶ Reprendre 3D' : '⏸ Pause 3D';
      if (!isPaused && !isOffscreen) {
        requestAnimationFrame(renderLoop);
      }
    });
  }

  let clock = new THREE.Clock();

  function renderLoop() {
    if (isPaused || isOffscreen) return;

    const elapsedTime = clock.getElapsedTime();

    bottle.position.y = -0.3 + Math.sin(elapsedTime * 0.8) * 0.08;
    jar.position.y = -0.9 + Math.cos(elapsedTime * 0.7) * 0.06;
    pearl1.position.y = 1.2 + Math.sin(elapsedTime * 1.1) * 0.1;
    pearl2.position.y = 1.0 + Math.cos(elapsedTime * 0.9) * 0.08;

    bottle.rotation.y = elapsedTime * 0.2;
    jar.rotation.y = -elapsedTime * 0.15;

    mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.05;
    mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.05;

    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
}
