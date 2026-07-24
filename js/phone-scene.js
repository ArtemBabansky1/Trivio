/* =====================================================================
   TRIVIO v2 · 3D-телефон: three.js-движок (порт phoneScene.js из Meets)
   Владеет рендерером/сценой/камерой/окружением, грузит meshopt-GLB,
   подменяет экран на плоскость с canvas-текстурой и отдаёт API
   setProgress/setTilt — скролл и курсор ведёт внешний слой.
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

var FOV = 28;
var FIT_FRAC = 0.56;
/* Исходная модель ~189 юнитов высотой — нормализуем, чтобы камера жила
   в маленьких числах и depth-буфера хватало копланарному экрану */
var NORM_HEIGHT = 2.4;

var v3 = new THREE.Vector3();

/* У модели +Y — верх телефона, экран — грань −Z (камера-бамп на +Z) */
function findScreenMesh(root) {
  var found = null;
  root.traverse(function (o) {
    if (!found && o.isMesh && /display/i.test((o.material && o.material.name) || '')) { found = o; }
  });
  return found;
}

function traceRoundedRect(path, w, h, r) {
  var x = -w / 2, y = -h / 2;
  var rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - rr);
  path.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x + rr, y + h);
  path.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + rr);
  path.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return path;
}

/* Скруглённая плоскость экрана с UV 0..1 — углы UI совпадают с корпусом */
function roundedScreenGeometry(w, h, r) {
  var shape = traceRoundedRect(new THREE.Shape(), w, h, r);
  var x = -w / 2, y = -h / 2;
  var geom = new THREE.ShapeGeometry(shape, 16);
  var pos = geom.attributes.position;
  var uv = new Float32Array(pos.count * 2);
  for (var i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - y) / h;
  }
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geom;
}

/* Графитовый корпус: рамка и стекло чуть светлее/глянцевее, чтобы римы
   ловили кромки и силуэт читался */
function tuneMaterials(root) {
  root.traverse(function (o) {
    if (!o.isMesh) { return; }
    var mat = o.material;
    if (!mat || Array.isArray(mat)) { return; }
    var name = (mat.name || '').toLowerCase();
    if (/glass|multicoat/.test(name)) {
      if (mat.color) { mat.color.setHex(0x17171c); }
      if (mat.metalness !== undefined) { mat.metalness = 0.5; }
      if (mat.roughness !== undefined) { mat.roughness = 0.3; }
      mat.envMapIntensity = 1.0;
    } else if (/frame|matt|cam body|cam black/.test(name)) {
      if (mat.color) { mat.color.setHex(0x303038); }
      if (mat.metalness !== undefined) { mat.metalness = 0.8; }
      if (mat.roughness !== undefined) { mat.roughness = 0.5; }
      mat.envMapIntensity = 0.95;
    } else {
      if (mat.color) { mat.color.setHex(0x282830); }
      if (mat.metalness !== undefined) { mat.metalness = 0.55; }
      if (mat.roughness !== undefined) { mat.roughness = 0.5; }
      mat.envMapIntensity = 0.85;
    }
  });
}

/* Мягкий вертикальный градиент вместо студийного окружения: без жёстких
   источников — глянец отражает плавный спад, а не яркие полосы */
function gradientEnvTexture() {
  var W = 128, H = 64;
  var c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  var ctx = c.getContext('2d');
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, '#7a7a86');
  g.addColorStop(0.5, '#2a2a30');
  g.addColorStop(1.0, '#070709');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  var tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPhoneScene(canvas, opts) {
  opts = opts || {};
  var faceAngleDeg = opts.faceAngleDeg !== undefined ? opts.faceAngleDeg : 180;
  var turnAwayDeg = opts.turnAwayDeg !== undefined ? opts.turnAwayDeg : 135;
  var maxPixelRatio = opts.maxPixelRatio !== undefined ? opts.maxPixelRatio : 2;
  var fitFrac = opts.fitFrac !== undefined ? opts.fitFrac : FIT_FRAC;

  var pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  /* MSAA обязателен: белый экран на почти чёрной рамке — самая контрастная
     кромка на странице, без сглаживания лесенка видна даже на 2x */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' });
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(pixelRatio);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
  camera.position.set(0, 0, 10);

  var pmrem = new THREE.PMREMGenerator(renderer);
  var envSrc = gradientEnvTexture();
  var envRT = pmrem.fromEquirectangular(envSrc);
  scene.environment = envRT.texture;
  envSrc.dispose();

  var hemi = new THREE.HemisphereLight(0xb0b0bc, 0x0c0c0e, 0.95);
  var key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2.5, 3.5);
  var rim = new THREE.DirectionalLight(0xffffff, 1.1);
  rim.position.set(-2.5, 1.5, -2);
  scene.add(hemi, key, rim);

  /* tiltGroup (курсор) → pivot (скролл + idle) → модель */
  var tiltGroup = new THREE.Group();
  var pivot = new THREE.Group();
  tiltGroup.add(pivot);
  scene.add(tiltGroup);

  var clock = new THREE.Clock();
  var faceAngle = THREE.MathUtils.degToRad(faceAngleDeg);
  var turnAway = THREE.MathUtils.degToRad(turnAwayDeg);
  var phoneHeight = 1;
  var baseAngle = faceAngle - turnAway;
  var tiltTarget = { x: 0, y: 0 };
  var running = false;
  var raf = 0;
  var screenTexture = null;
  var disposed = false;

  function fitCamera(height) {
    var dist = height / (2 * fitFrac * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));
    camera.position.set(0, 0, dist);
    camera.near = Math.max(0.01, dist - height);
    camera.far = dist + height * 2;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function attachScreen(model, modelBox, screenCanvas, aspect) {
    var mesh = findScreenMesh(model);
    var tex = new THREE.CanvasTexture(screenCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    /* 4x анизотропии достаточно для наших углов; 16x заметно дороже */
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    screenTexture = tex;

    var size = modelBox.getSize(v3);
    var cx = 0, cy = 0, cz = modelBox.min.z, w = size.x * 0.86, h = w / aspect;
    if (mesh) {
      mesh.geometry.computeBoundingBox();
      var b = mesh.geometry.boundingBox.clone();
      var toRoot = new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
      b.applyMatrix4(toRoot);
      var c = b.getCenter(new THREE.Vector3());
      var s = b.getSize(new THREE.Vector3());
      cx = c.x; cy = c.y; cz = c.z; w = s.x; h = s.y;
      /* Родной дисплей — чёрная нелит-подложка; polygonOffset уводит её
         глубину назад пропорционально наклону, иначе на скользящих углах
         подложка выигрывает depth-тест полосами поверх UI-плоскости */
      if (mesh.material && mesh.material.dispose) { mesh.material.dispose(); }
      mesh.material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        polygonOffset: true,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4
      });
    }
    /* Кромку экрана рисуем сами: UI-плоскость на полный дисплей + чёрное
       маск-кольцо, чья внутренняя дуга и есть видимый угол экрана. Рваная
       кромка модели остаётся похоронена под ними при любом повороте */
    var screenR = Math.min(0.145 * size.x, w * 0.5, h * 0.5);
    var zBase = cz - size.z * 0.003;
    var plane = new THREE.Mesh(
      roundedScreenGeometry(w, h, screenR),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    plane.position.set(cx, cy, zBase);
    plane.rotation.y = Math.PI;
    plane.renderOrder = 10;
    model.add(plane);

    var lip = size.x * 0.005;
    var spread = size.x * 0.022;
    var maskShape = traceRoundedRect(new THREE.Shape(), w + spread * 2, h + spread * 2, screenR + spread);
    maskShape.holes.push(traceRoundedRect(new THREE.Path(), w - lip * 2, h - lip * 2, screenR - lip));
    var mask = new THREE.Mesh(
      new THREE.ShapeGeometry(maskShape, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })
    );
    mask.position.set(cx, cy, zBase - size.z * 0.001);
    mask.rotation.y = Math.PI;
    mask.renderOrder = 11;
    model.add(mask);
  }

  function load(glbUrl, screenCanvas, aspect) {
    var loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    return loader.loadAsync(glbUrl).then(function (gltf) {
      if (disposed) { return; }
      var model = gltf.scene;
      model.updateMatrixWorld(true);

      var box = new THREE.Box3().setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());

      tuneMaterials(model);
      attachScreen(model, box, screenCanvas, aspect);

      model.position.sub(center);
      var norm = new THREE.Group();
      norm.scale.setScalar(NORM_HEIGHT / size.y);
      norm.add(model);
      pivot.add(norm);
      phoneHeight = NORM_HEIGHT;

      fitCamera(NORM_HEIGHT);
      renderer.render(scene, camera);
    });
  }

  /* Адаптивный fps: 60 только пока телефон активно ведут (скролл/тилт),
     в покое idle-боб субпиксельный — хватает ~20 кадров */
  var FAST_WINDOW_MS = 250;
  var IDLE_FRAME_MS = 50;
  var fastUntil = 0;
  var lastRender = 0;

  function frame(now) {
    if (!running) { return; }
    raf = requestAnimationFrame(frame);
    now = now === undefined ? performance.now() : now;
    var tiltSettled =
      Math.abs(tiltTarget.x - tiltGroup.rotation.x) < 0.001 &&
      Math.abs(tiltTarget.y - tiltGroup.rotation.y) < 0.001;
    if (now >= fastUntil && tiltSettled && now - lastRender < IDLE_FRAME_MS) { return; }
    lastRender = now;
    var t = clock.getElapsedTime();
    pivot.rotation.y = baseAngle + Math.sin(t * 0.6) * 0.05;
    pivot.position.y = Math.sin(t * 0.9) * phoneHeight * 0.012;
    tiltGroup.rotation.x += (tiltTarget.x - tiltGroup.rotation.x) * 0.08;
    tiltGroup.rotation.y += (tiltTarget.y - tiltGroup.rotation.y) * 0.08;
    renderer.render(scene, camera);
  }

  return {
    load: load,
    /* p: 0 = отвернут на turnAway … 1 = экраном к зрителю */
    setProgress: function (p) {
      baseAngle = faceAngle - turnAway * (1 - Math.min(1, Math.max(0, p)));
      fastUntil = performance.now() + FAST_WINDOW_MS;
    },
    setTilt: function (rx, ry) { tiltTarget.x = rx; tiltTarget.y = ry; },
    setSize: function (w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!running) { renderer.render(scene, camera); }
    },
    start: function () { if (running) { return; } running = true; clock.getDelta(); frame(); },
    stop: function () { running = false; cancelAnimationFrame(raf); },
    redrawScreen: function () { if (screenTexture) { screenTexture.needsUpdate = true; } },
    dispose: function () {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      scene.environment = null;
      scene.traverse(function (o) {
        if (o.isMesh) {
          if (o.geometry) { o.geometry.dispose(); }
          var m = o.material;
          (Array.isArray(m) ? m : [m]).forEach(function (mm) {
            if (mm && mm.map && mm.map.dispose) { mm.map.dispose(); }
            if (mm && mm.dispose) { mm.dispose(); }
          });
        }
      });
      if (screenTexture) { screenTexture.dispose(); }
      screenTexture = null;
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    }
  };
}
