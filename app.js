import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';


// === СЦЕНА/КАМЕРА/РЕНДЕР ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);
const stats = new Stats();
document.body.appendChild(stats.dom);


const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// свет
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(5, 10, 7);
scene.add(dir);

// сетка
scene.add(new THREE.GridHelper(80, 80, 0x3a3a5a, 0x2a2a3a));

////////////////////////////////////////////////////////////////////////////////
// СПАВНЕР
////////////////////////////////////////////////////////////////////////////////
function spawnPieces(template, { total = 24, yStep = 2, angleStepDeg = 45 } = {}) {
  const parentGroup = new THREE.Group();
  scene.add(parentGroup);

  const angleStep = THREE.MathUtils.degToRad(angleStepDeg);
  let currentY = 0;

  for (let i = 0; i < total; i++) {
    if (i > 0 && i % 8 === 0) currentY += yStep;

    const clone = template.clone(true);
    clone.position.set(0, currentY, 0);
    clone.rotation.y = (i % 8) * angleStep;

    parentGroup.add(clone);

    // 👇 ЛОГ В КОНСОЛЬ
    console.log(
      `Spawned piece ${i + 1}/${total} at Y=${currentY}, angle=${((i % 8) * angleStepDeg).toFixed(1)}°`
    );
  }

  return parentGroup;
}




////////////////////////////////////////////////////////////////////////////////
// КОНТРОЛЫ КАМЕРЫ
////////////////////////////////////////////////////////////////////////////////
class VerticalCameraSmoothZoomControls {
  constructor(camera, dom, {
    target = new THREE.Vector3(0, 0, 0),
    yawDeg = 45,
    distance = 15,
    minDistance = 4,
    maxDistance = 80,
    maxSpeed = 10,
    moveSmoothTime = 0.12,
    zoomStep = 2.5,
    zoomSmoothTime = 0.18,
  } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.target = target.clone();
    this.yawRad = THREE.MathUtils.degToRad(yawDeg);
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.maxSpeed = maxSpeed;
    this.moveSmoothTime = moveSmoothTime;
    this.zoomStep = zoomStep;
    this.zoomSmoothTime = zoomSmoothTime;

    this.dirY = 0;
    this.velY = 0;
    this.targetDistance = distance;
    this.currentDistance = distance;
    this.baseYOffset = this.camera.position.y - this.target.y;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW') this.dirY = 1;
      if (e.code === 'KeyS') this.dirY = -1;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' && this.dirY === 1) this.dirY = 0;
      if (e.code === 'KeyS' && this.dirY === -1) this.dirY = 0;
    });
    dom.addEventListener('wheel', (e) => {
      this.targetDistance += e.deltaY * this.zoomStep * 0.01;
      this.targetDistance = THREE.MathUtils.clamp(this.targetDistance, this.minDistance, this.maxDistance);
    });

    this._applyTransform();
  }

  update(dt) {
    const targetVel = this.dirY * this.maxSpeed;
    const mv = this.moveSmoothTime > 0 ? (1 - Math.exp(-dt / this.moveSmoothTime)) : 1;
    this.velY += (targetVel - this.velY) * mv;
    if (Math.abs(this.velY) < 1e-4 && this.dirY === 0) this.velY = 0;
    this.baseYOffset += this.velY * dt;

    const zv = this.zoomSmoothTime > 0 ? (1 - Math.exp(-dt / this.zoomSmoothTime)) : 1;
    this.currentDistance += (this.targetDistance - this.currentDistance) * zv;

    this._applyTransform();
  }

  _applyTransform() {
    const offX = Math.sin(this.yawRad) * this.currentDistance;
    const offZ = Math.cos(this.yawRad) * this.currentDistance;

    const camPos = new THREE.Vector3(
      this.target.x + offX,
      this.target.y + this.baseYOffset,
      this.target.z + offZ
    );
    this.camera.position.copy(camPos);
    this.camera.lookAt(new THREE.Vector3(this.target.x, camPos.y, this.target.z));
    camera.position.set(45, 25, 45);
  }
}

const controls = new VerticalCameraSmoothZoomControls(camera, renderer.domElement);

////////////////////////////////////////////////////////////////////////////////
// ВРАЩЕНИЕ ОБЪЕКТА ПО A/D
////////////////////////////////////////////////////////////////////////////////
class RotateYByKeys {
  constructor(object, speedDegPerSec = 90) {
    this.object = object;
    this.speed = THREE.MathUtils.degToRad(speedDegPerSec);
    this.dir = 0;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyA') this.dir = -1;
      else if (e.code === 'KeyD') this.dir = 1;
    });
    window.addEventListener('keyup', (e) => {
      if ((e.code === 'KeyA' && this.dir === -1) || (e.code === 'KeyD' && this.dir === 1)) this.dir = 0;
    });
  }

  update(dt) {
    if (!this.object || this.dir === 0) return;
    this.object.rotation.y += this.dir * this.speed * dt;
  }
}

let rotator = null;

////////////////////////////////////////////////////////////////////////////////
// ЗАГРУЗКА МОДЕЛИ
////////////////////////////////////////////////////////////////////////////////
const loader = new GLTFLoader();
loader.load(
  './models/CakeNew.glb',
  (gltf) => {
    const template = gltf.scene;
    const cake = spawnPieces(template, { total: 104, yStep: 4, angleStepDeg: 45 });
    rotator = new RotateYByKeys(cake, 120); // вращаем весь торт
  },
  undefined,
  (err) => console.error('Ошибка загрузки модели:', err)
);

////////////////////////////////////////////////////////////////////////////////
// АНИМАЦИЯ
////////////////////////////////////////////////////////////////////////////////
const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  controls.update(dt);
  if (rotator) rotator.update(dt);
     const pos = camera.position;
  console.log(`Camera position: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}, z=${pos.z.toFixed(2)}`);

  renderer.render(scene, camera);
  stats.update(); // 👈 обновляем FPS
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
