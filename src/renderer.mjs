import * as pc from "playcanvas";
import { _n, jn, fa, Hl } from "./world.mjs";

// Budgets are explicit: changing quality never changes the authoritative map,
// collisions, objectives, creature awareness, or multiplayer simulation.
export const QUALITY_PRESETS = Object.freeze({
  ultraLow: {
    width: 800,
    height: 450,
    distance: 48,
    detail: 20,
    animation: 24,
    fps: 30,
  },
  low: {
    width: 1024,
    height: 576,
    distance: 70,
    detail: 34,
    animation: 40,
    fps: 60,
  },
  medium: {
    width: 1440,
    height: 810,
    distance: 105,
    detail: 62,
    animation: 70,
    fps: 60,
  },
  high: {
    width: 1920,
    height: 1080,
    distance: 145,
    detail: 95,
    animation: 105,
    fps: 60,
  },
});
const DEG = 180 / Math.PI;
const PALETTE = [
  "#315b80",
  "#a54c3e",
  "#58745b",
  "#b18a36",
  "#79678f",
  "#558e96",
  "#8e565f",
  "#9c9b89",
];
const productColors = [
  "#ab654b",
  "#d0bd80",
  "#6d9561",
  "#7095a0",
  "#b38d45",
  "#907593",
];
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];
const color = (hex) => new pc.Color(...rgb(hex));

// All boxes in a chunk share a vertex-colour material and become one mesh.
// There are no thousands of scene graph nodes for shelf merchandise.
class Boxes {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.uv = [];
    this.i = [];
  }
  box(x, y, z, w, h, d, hex, tilt = 0, pivotX = x, pivotY = 0) {
    const r = rgb(hex),
      base = this.p.length / 3;
    const faces = [
      [
        [1, 0, 0],
        [
          [1, -1, -1],
          [1, 1, -1],
          [1, 1, 1],
          [1, -1, 1],
        ],
      ],
      [
        [-1, 0, 0],
        [
          [-1, -1, 1],
          [-1, 1, 1],
          [-1, 1, -1],
          [-1, -1, -1],
        ],
      ],
      [
        [0, 1, 0],
        [
          [-1, 1, -1],
          [-1, 1, 1],
          [1, 1, 1],
          [1, 1, -1],
        ],
      ],
      [
        [0, -1, 0],
        [
          [-1, -1, 1],
          [-1, -1, -1],
          [1, -1, -1],
          [1, -1, 1],
        ],
      ],
      [
        [0, 0, 1],
        [
          [1, -1, 1],
          [1, 1, 1],
          [-1, 1, 1],
          [-1, -1, 1],
        ],
      ],
      [
        [0, 0, -1],
        [
          [-1, -1, -1],
          [-1, 1, -1],
          [1, 1, -1],
          [1, -1, -1],
        ],
      ],
    ];
    const ct = Math.cos(tilt),
      st = Math.sin(tilt);
    for (let f = 0; f < 6; f++) {
      const [normal, corners] = faces[f];
      const shade = [0.87, 0.77, 1, 0.55, 0.91, 0.83][f];
      for (let v = 0; v < 4; v++) {
        const a = corners[v];
        let px = x + (a[0] * w) / 2,
          py = y + (a[1] * h) / 2;
        if (tilt) {
          const dx = px - pivotX,
            dy = py - pivotY;
          px = pivotX + dx * ct - dy * st;
          py = pivotY + dx * st + dy * ct;
        }
        this.p.push(px, py, z + (a[2] * d) / 2);
        this.n.push(
          normal[0] * ct - normal[1] * st,
          normal[0] * st + normal[1] * ct,
          normal[2],
        );
        this.c.push(r[0] * shade, r[1] * shade, r[2] * shade, 1);
        this.uv.push(v === 1 || v === 2 ? 1 : 0, v > 1 ? 1 : 0);
      }
      const b = base + f * 4;
      this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    return this;
  }
  mesh(device) {
    const mesh = new pc.Mesh(device);
    mesh.setPositions(this.p);
    mesh.setNormals(this.n);
    mesh.setColors(this.c);
    mesh.setUvs(0, this.uv);
    mesh.setIndices(this.i);
    mesh.update();
    return mesh;
  }
}

function chooseAutomatic(device) {
  let renderer = "";
  try {
    const gl = device.gl,
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
  } catch {
    /* GPU names may be hidden by browser privacy settings. */
  }
  if (
    /swiftshader|llvmpipe|software|intel.*(hd graphics|hd [2345])/i.test(
      renderer,
    )
  )
    return "ultraLow";
  if (
    (navigator.deviceMemory || 4) <= 4 ||
    (navigator.hardwareConcurrency || 4) <= 4
  )
    return "low";
  return "medium";
}

function wireCart() {
  const g = new Boxes(),
    metal = "#65786e",
    dark = "#303b3b";
  // The cart stays at floor height. The eye drops behind the OPEN wire front
  // at y=1.05 when crouched; neither a solid panel nor the handle crosses it.
  const width = 0.72,
    front = -0.95,
    back = 0.12,
    bottom = 0.49,
    top = 1.24;
  for (const side of [-1, 1]) {
    g.box((side * width) / 2, 0.32, -0.28, 0.035, 0.55, 0.035, metal);
    g.box((side * width) / 2, 0.58, -0.45, 0.035, 0.035, 1.05, metal);
    for (const zz of [-0.82, 0.04])
      g.box(side * 0.31, 0.13, zz, 0.09, 0.2, 0.15, dark);
    g.box((side * width) / 2, top, -0.42, 0.016, 0.016, 1.1, metal);
    for (let zz = front; zz <= back + 0.001; zz += 0.12)
      g.box(
        (side * width) / 2,
        (bottom + top) / 2,
        zz,
        0.006,
        top - bottom,
        0.006,
        metal,
      );
    for (let yy = bottom; yy < top; yy += 0.13)
      g.box((side * width) / 2, yy, -0.42, 0.006, 0.006, 1.1, metal);
    g.box((side * width) / 2, 1.3, 0.23, 0.025, 0.2, 0.025, dark);
  }
  g.box(0, 1.4, 0.23, width + 0.05, 0.045, 0.045, "#45655b");
  for (const zz of [front, back]) {
    g.box(0, top, zz, width, 0.016, 0.016, metal);
    for (let xx = -width / 2; xx <= width / 2 + 0.001; xx += 0.09)
      g.box(xx, (bottom + top) / 2, zz, 0.006, top - bottom, 0.006, metal);
    for (let yy = bottom; yy < top; yy += 0.13)
      g.box(0, yy, zz, width, 0.006, 0.006, metal);
  }
  for (let xx = -width / 2; xx <= width / 2 + 0.001; xx += 0.09)
    g.box(xx, bottom, -0.42, 0.006, 0.006, 1.1, metal);
  return g;
}

export async function Lg(canvas, onProgress = () => {}) {
  let app;
  try {
    app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
        preserveDrawingBuffer: false,
      },
      devtools: false,
    });
  } catch (e) {
    throw new Error(
      "PlayCanvas için WebGL 2 destekli bir tarayıcı ve ekran kartı sürücüsü gerekiyor. Tarayıcıyı/sürücüyü güncelleyin. " +
        e.message,
    );
  }
  app.autoRender = false;
  app.setCanvasResolution(pc.RESOLUTION_FIXED, 800, 450);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  app.scene.ambientLight = color("#a6b5a9");
  app.scene.exposure = 1.05;
  app.scene.fog.type = pc.FOG_LINEAR;
  app.scene.fog.color = color("#273132");
  app.scene.clusteredLightingEnabled = false;

  const cameraEntity = new pc.Entity("First person camera");
  cameraEntity.addComponent("camera", {
    fov: 70,
    nearClip: 0.035,
    farClip: 150,
    clearColor: color("#273132"),
    frustumCulling: true,
  });
  cameraEntity.camera.toneMapping = pc.TONEMAP_FILMIC;
  app.root.addChild(cameraEntity);
  const sun = new pc.Entity("Fluorescent ambient direction");
  sun.addComponent("light", {
    type: "directional",
    color: color("#d6dfce"),
    intensity: 0.55,
    castShadows: false,
  });
  sun.setEulerAngles(48, 32, 0);
  app.root.addChild(sun);
  const flashlight = new pc.Entity("Flashlight");
  flashlight.addComponent("light", {
    type: "spot",
    color: color("#f1e7bc"),
    intensity: 2.5,
    range: 28,
    innerConeAngle: 15,
    outerConeAngle: 31,
    castShadows: false,
  });
  cameraEntity.addChild(flashlight);
  flashlight.setLocalEulerAngles(90, 0, 0);

  const makeMaterial = (name, lighting = true) => {
    const m = new pc.StandardMaterial();
    m.name = name;
    m.diffuseVertexColor = true;
    m.useLighting = lighting;
    m.diffuse.set(1, 1, 1);
    m.specular.set(0.04, 0.04, 0.04);
    m.gloss = 12;
    m.update();
    return m;
  };
  const worldMaterial = makeMaterial("Batched market vertex colours");
  const lampMaterial = makeMaterial("Fluorescent strips", false);
  lampMaterial.emissive.set(0.82, 0.91, 0.77);
  lampMaterial.update();
  // Unlit muted vertex colours keep a nearby flashlight from clipping the
  // wire grid to solid white. This also saves fragment lighting on the cart.
  const cartMaterial = makeMaterial("Open wire shopping carts", false);
  cartMaterial.specular.set(0, 0, 0);
  cartMaterial.update();
  function entityFromBoxes(
    name,
    boxes,
    material = worldMaterial,
    parent = app.root,
  ) {
    const e = new pc.Entity(name);
    // Edge/light-only chunks have no merchandise. PlayCanvas rejects a
    // zero-vertex mesh, so keep a cheap graph node without a render component.
    if (!boxes.p.length) {
      parent.addChild(e);
      return e;
    }
    const mesh = boxes.mesh(app.graphicsDevice);
    e.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, material)],
      castShadows: false,
      receiveShadows: false,
    });
    parent.addChild(e);
    return e;
  }

  const shell = new Boxes();
  shell.box(0, -0.12, 0, 240, 0.24, 320, "#757c78");
  shell.box(0, 8.1, 0, 240, 0.25, 320, "#303b3d");
  shell.box(-120, 4, 0, 0.4, 8, 320, "#88968e");
  shell.box(120, 4, 0, 0.4, 8, 320, "#88968e");
  shell.box(0, 4, -160, 240, 8, 0.4, "#89958b");
  shell.box(0, 4, 160, 240, 8, 0.4, "#89958b");
  // Tile seams have their own mesh so the lowest setting avoids subpixel
  // shimmer and unnecessary geometry. No high-resolution floor texture.
  const seams = new Boxes();
  for (let x = -120; x <= 120; x += 4)
    seams.box(x, 0.003, 0, 0.01, 0.008, 320, "#6d7770");
  for (let z = -160; z <= 160; z += 4)
    seams.box(0, 0.004, z, 240, 0.008, 0.01, "#6d7770");
  const shellEntity = entityFromBoxes("Floor, ceiling and walls", shell);
  const floorSeams = entityFromBoxes("Optional tile seams", seams);
  const fixed = new Boxes();
  for (const a of fa.slice(jn.length)) {
    if (a.kind === "column") fixed.box(a.x, 4, a.z, a.w, 8, a.d, "#76867d");
    else if (a.kind === "checkout") {
      fixed.box(a.x, 0.55, a.z, a.w, 1.1, a.d, "#4e7166");
      fixed.box(a.x, 1.13, a.z, a.w + 0.15, 0.12, a.d + 0.15, "#344b46");
      fixed.box(a.x - 0.8, 1.45, a.z, 0.8, 0.5, 0.9, "#293c3b");
    } else if (a.kind === "freezer") {
      fixed.box(a.x, 1.5, a.z, a.w, 3, a.d, "#bdc9bb");
      fixed.box(
        a.x + (a.x < 0 ? 1.52 : -1.52),
        1.55,
        a.z,
        0.03,
        2.3,
        a.d - 0.25,
        "#4d7175",
      );
    } else {
      fixed.box(a.x, 0.55, a.z, a.w, 1.1, a.d, "#807254");
      fixed.box(a.x, 1.16, a.z, a.w - 0.1, 0.18, a.d - 0.1, "#658c50");
    }
  }
  entityFromBoxes("Checkouts, columns, produce and freezers", fixed);
  const safe = new Boxes();
  safe.box(0, 0.016, 148, 19, 0.025, 18, "#658c70");
  for (const x of [-10, 10]) {
    safe.box(x, 1.08, 148, 0.055, 2.16, 0.055, "#92b48a");
    safe.box(x, 2.2, 148, 0.06, 0.06, 13, "#a6c190");
  }
  safe.box(0, 1.9, 159.5, 20, 3.8, 0.15, "#354c44");
  entityFromBoxes("Delivery safety zone", safe);

  // Signs use one small atlas and share a single mesh/material.
  function addSigns() {
    const atlas = document.createElement("canvas");
    atlas.width = 1024;
    atlas.height = 512;
    const ctx = atlas.getContext("2d");
    ctx.fillStyle = "#273f36";
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    const labels = [
      "TESLİMAT / GÜVENLİ ALAN",
      "SON KORİDOR / 24 SAAT",
      "KURU GIDA",
      "İÇECEKLER",
      "KONSERVE",
      "KAHVALTILIK",
      "TEMİZLİK",
      "SEBZE / MEYVE",
    ];
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    labels.forEach((label, i) => {
      ctx.strokeStyle = "#9caf92";
      ctx.strokeRect(4, i * 64 + 4, 1016, 56);
      ctx.fillStyle = "#e1e8cb";
      ctx.fillText(label, 512, i * 64 + 34, 980);
    });
    const tex = new pc.Texture(app.graphicsDevice, {
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
    });
    tex.setSource(atlas);
    const material = new pc.StandardMaterial();
    material.emissiveMap = tex;
    material.emissive.set(1, 1, 1);
    material.useLighting = false;
    material.cull = pc.CULLFACE_NONE;
    material.update();
    const p = [],
      uv = [],
      ii = [];
    const sign = (x, y, z, w, h, row, rot = 0) => {
      const b = p.length / 3,
        cs = Math.cos(rot),
        sn = Math.sin(rot);
      for (const [xx, yy] of [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ])
        p.push(x + xx * cs, y + yy, z - xx * sn);
      const v0 = 1 - (row + 1) / 8,
        v1 = 1 - row / 8;
      uv.push(0, v0, 1, v0, 1, v1, 0, v1);
      ii.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    sign(0, 4.5, 158, 13, 1.2, 0);
    sign(0, 4.8, -159, 28, 1.8, 1);
    for (let i = 0; i < 18; i++)
      sign(-102 + i * 12, 4.3, 128, 8.3, 0.8, 2 + Math.floor(i / 3));
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(p);
    mesh.setUvs(0, uv);
    mesh.setIndices(ii);
    mesh.update();
    const e = new pc.Entity("Market wayfinding signs");
    e.addComponent("render", {
      meshInstances: [new pc.MeshInstance(mesh, material)],
      castShadows: false,
    });
    app.root.addChild(e);
  }
  addSigns();
  onProgress(0.15);

  let chunks = [],
    fallenKey = "",
    currentFallen = [];
  function rebuildShelves(fallen = []) {
    for (const chunk of chunks)
      for (const e of [chunk.base, chunk.detail, chunk.lamps]) {
        const mesh = e.render?.meshInstances[0]?.mesh;
        e.destroy();
        mesh?.destroy();
      }
    chunks = [];
    const data = new Map(),
      fallenByIndex = new Map(fallen.map((f) => [f.aisleIndex, f]));
    const get = (x, z) => {
      const cx = Math.floor((x + 120) / 36),
        cz = Math.floor((z + 160) / 34),
        key = cx + "," + cz;
      if (!data.has(key))
        data.set(key, {
          x: cx * 36 - 102,
          z: cz * 34 - 143,
          base: new Boxes(),
          detail: new Boxes(),
          lamps: new Boxes(),
        });
      return data.get(key);
    };
    jn.forEach((a, index) => {
      const chunk = get(a.x, a.z),
        f = fallenByIndex.get(index),
        tilt = f ? -f.side * 1.12 : 0;
      const add = (target, dx, y, dz, w, h, d, c) =>
        target.box(a.x + dx, y, a.z + dz, w, h, d, c, tilt, a.x, 0);
      add(chunk.base, 0, 1.4, 0, 0.055, 2.8, a.d, "#4c5c56");
      for (const dx of [-1.02, 1.02])
        for (const dz of [-9.45, 0, 9.45])
          add(chunk.base, dx, 1.45, dz, 0.06, 2.9, 0.06, "#6e8377");
      for (const y of [0.27, 1.02, 1.77, 2.52])
        add(chunk.base, 0, y, 0, 2.1, 0.065, 19.2, "#8b9c8d");
      const rng = Hl(index + 91);
      for (let zz = -8.8; zz < 9; zz += 1.65)
        for (const side of [-1, 1]) {
          for (const level of [0, 1, 2]) {
            const target = level === 0 ? chunk.base : chunk.detail;
            add(
              target,
              side * 0.62,
              0.55 + level * 0.75,
              zz,
              0.54,
              0.45 + rng() * 0.16,
              0.65,
              productColors[Math.floor(rng() * productColors.length)],
            );
          }
        }
    });
    for (let x = -108; x <= 108; x += 24)
      for (let z = -144; z <= 144; z += 34) {
        const c = get(x, z);
        c.base.box(x, 5.6, z, 4.8, 0.12, 0.4, "#35443f");
        c.lamps.box(x, 5.51, z, 4.5, 0.035, 0.23, "#d9e5c5");
      }
    for (const [key, c] of data)
      chunks.push({
        x: c.x,
        z: c.z,
        base: entityFromBoxes("Market chunk " + key, c.base),
        detail: entityFromBoxes("Product detail " + key, c.detail),
        lamps: entityFromBoxes("Lights " + key, c.lamps, lampMaterial),
      });
    currentFallen = fallen;
  }
  rebuildShelves();
  onProgress(0.35);
  const cartMesh = wireCart().mesh(app.graphicsDevice);
  function cart(parent, name) {
    const e = new pc.Entity(name);
    e.addComponent("render", {
      meshInstances: [new pc.MeshInstance(cartMesh, cartMaterial)],
      castShadows: false,
    });
    parent.addChild(e);
    return e;
  }
  const localCart = cart(app.root, "Your open wire basket");
  const monsterPivot = new pc.Entity("Locust");
  app.root.addChild(monsterPivot);
  const actors = new Map(),
    itemEntities = new Map(),
    foodTemplates = new Map();
  let monsterModel = null,
    monsterAnimation = "",
    lastState = null,
    lastMe = null,
    lastDt = 1 / 60;
  const loadContainer = (url) =>
    new Promise((resolve, reject) =>
      app.assets.loadFromUrl(url, "container", (err, asset) =>
        err ? reject(new Error(url + ": " + err)) : resolve(asset),
      ),
    );
  function disableShadows(entity) {
    for (const r of entity.findComponents("render")) {
      r.castShadows = false;
      r.receiveShadows = false;
    }
  }
  function fit(entity, height) {
    app.root.syncHierarchy();
    // A freshly instantiated skin still has identity matrices. Its AABB is
    // therefore in raw mesh bind coordinates, not the posed GLB hierarchy.
    // Evaluate CPU skin matrices before measuring; otherwise normalizing the
    // Locust against that bogus box makes it eleven times too large/offscreen.
    const renderComponents = entity.findComponents("render");
    const meshInstances = renderComponents.flatMap((r) => r.meshInstances);
    app.renderer.updateCpuSkinMatrices(meshInstances);
    let bounds = null;
    for (const r of renderComponents)
      for (const mi of r.meshInstances) {
        if (!bounds) bounds = mi.aabb.clone();
        else bounds.add(mi.aabb);
      }
    if (!bounds) return;
    const scale = height / Math.max(0.001, bounds.halfExtents.y * 2);
    const initialScale = entity.getLocalScale();
    entity.setLocalScale(
      initialScale.x * scale,
      initialScale.y * scale,
      initialScale.z * scale,
    );
    entity.setLocalPosition(
      -bounds.center.x * scale,
      -(bounds.center.y - bounds.halfExtents.y) * scale,
      -bounds.center.z * scale,
    );
  }
  const monsterAsset = await loadContainer("assets/locust.glb");
  monsterModel = monsterAsset.resource.instantiateRenderEntity({
    castShadows: false,
    receiveShadows: false,
  });
  // A singleton GLB scene instantiates its real root, including a -90° X
  // conversion from this asset. Never overwrite that authored rotation:
  // use a separate normalization parent for game scale/forward correction.
  const monsterVisual = new pc.Entity("Locust normalization");
  monsterPivot.addChild(monsterVisual);
  monsterVisual.addChild(monsterModel);
  monsterVisual.setLocalEulerAngles(0, 90, 0);
  disableShadows(monsterModel);
  const tracks = monsterAsset.resource.animations;
  if (tracks.length) {
    monsterModel.addComponent("anim", { activate: true });
    const states = [
      { name: "START" },
      ...tracks.map((a) => ({ name: a.resource.name, speed: 1, loop: true })),
    ];
    monsterModel.anim.loadStateGraph({
      layers: [
        {
          name: "Base",
          states,
          transitions: [{ from: "START", to: tracks[0].resource.name }],
        },
      ],
      parameters: {},
    });
    for (const a of tracks)
      monsterModel.anim.assignAnimation(a.resource.name, a.resource);
  }
  // Normalize the authored rig in its initial animation pose, retaining every
  // GLB root transform. Subsequent clips share the same fixed game scale.
  app.update(0);
  fit(monsterVisual, 4.4);
  onProgress(0.7);
  const foodNames = [
    "carton",
    "loaf",
    "apple",
    "can",
    "bottle-oil",
    "soda-bottle",
    "banana",
    "carton-small",
    "honey",
    "bag",
    "orange",
    "can-small",
  ];
  let loaded = 0;
  // Avoid a large simultaneous parse spike on low-memory machines.
  for (let start = 0; start < foodNames.length; start += 3)
    await Promise.all(
      foodNames.slice(start, start + 3).map(async (name) => {
        const asset = await loadContainer("assets/food-kit/" + name + ".glb");
        foodTemplates.set(name, asset.resource);
        onProgress(0.7 + (++loaded / foodNames.length) * 0.25);
      }),
    );

  // Camera facade keeps the recovered UI/controller independent of engine math.
  const rotation = {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    },
  };
  const position = {
    x: 0,
    y: 1.72,
    z: 148,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    },
  };
  const quaternion = new pc.Quat(),
    qYaw = new pc.Quat(),
    qPitch = new pc.Quat(),
    qRoll = new pc.Quat(),
    screen = new pc.Vec3(),
    world = new pc.Vec3();
  function syncCamera() {
    cameraEntity.setPosition(position.x, position.y, position.z);
    qYaw.setFromAxisAngle(pc.Vec3.UP, rotation.y * DEG);
    qPitch.setFromAxisAngle(pc.Vec3.RIGHT, rotation.x * DEG);
    qRoll.setFromAxisAngle(pc.Vec3.BACK, rotation.z * DEG);
    quaternion.mul2(qYaw, qPitch).mul(qRoll);
    cameraEntity.setRotation(quaternion);
    cameraEntity.camera.fov = camera.fov;
  }
  const camera = {
    position,
    rotation,
    fov: 70,
    entity: cameraEntity,
    updateProjectionMatrix() {},
    lookAt(x, y, z) {
      const dx = x - position.x,
        dy = y - position.y,
        dz = z - position.z;
      rotation.y = Math.atan2(-dx, -dz);
      rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
      rotation.z = 0;
    },
    getWorldDirection(v) {
      const c = Math.cos(rotation.x);
      v.x = -Math.sin(rotation.y) * c;
      v.y = Math.sin(rotation.x);
      v.z = -Math.cos(rotation.y) * c;
      return v;
    },
    worldToScreen(v) {
      syncCamera();
      // Marker projection runs before the next render; refresh camera matrices
      // now instead of using the previous frame's cached view/projection.
      cameraEntity.camera.onAppPrerender();
      world.set(v.x, v.y, v.z);
      cameraEntity.camera.worldToScreen(world, screen);
      const cp = Math.cos(rotation.x);
      const depth =
        (v.x - position.x) * -Math.sin(rotation.y) * cp +
        (v.y - position.y) * Math.sin(rotation.x) +
        (v.z - position.z) * -Math.cos(rotation.y) * cp;
      return {
        // CameraComponent already projects into CSS pixels (clientRect),
        // independent of the reduced framebuffer used by low settings.
        x: screen.x,
        y: screen.y,
        z: depth,
      };
    },
  };
  let preset = "low",
    requested = "auto",
    budget = QUALITY_PRESETS.low,
    autoQuality = true,
    resizeKey = "",
    visibilityAt = -1,
    drawFrameAt = -1,
    frameEMA = 16,
    slowFor = 0;
  const metrics = {
    engine: "PlayCanvas",
    engineVersion: pc.version,
    preset,
    activeQuality: preset,
    requestedQuality: requested,
    width: 800,
    height: 450,
    calls: 0,
    triangles: 0,
    visibleChunks: 0,
    frameEMA: 16,
    renderedFrames: 0,
    fpsLimit: budget.fps,
    renderScale: 1,
    basket: {
      handleY: 1.4,
      gridBottomY: 0.49,
      gridTopY: 1.24,
      groundAnchored: true,
    },
  };
  function resize() {
    const scale = Math.min(
        1,
        budget.width / innerWidth,
        budget.height / innerHeight,
      ),
      w = Math.max(320, Math.floor(innerWidth * scale)),
      h = Math.max(180, Math.floor(innerHeight * scale));
    const key = w + ":" + h;
    if (key === resizeKey) return;
    resizeKey = key;
    app.setCanvasResolution(pc.RESOLUTION_FIXED, w, h);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    app.graphicsDevice.updateClientRect();
    metrics.width = w;
    metrics.height = h;
    metrics.renderScale = scale;
  }
  function quality(value = "auto") {
    requested = value;
    autoQuality = value === "auto";
    preset = autoQuality ? chooseAutomatic(app.graphicsDevice) : value;
    if (!QUALITY_PRESETS[preset]) preset = "low";
    budget = QUALITY_PRESETS[preset];
    metrics.preset = preset;
    metrics.activeQuality = preset;
    metrics.requestedQuality = requested;
    metrics.fpsLimit = budget.fps;
    app.scene.fog.start = budget.distance * 0.45;
    app.scene.fog.end = budget.distance;
    cameraEntity.camera.farClip = budget.distance + 25;
    // Retain the flashlight and blackout gameplay even on the lowest preset.
    // It uses one shadowless spot light, a small framebuffer and no sun.
    worldMaterial.useLighting = true;
    worldMaterial.update();
    sun.enabled = preset !== "ultraLow";
    floorSeams.enabled = preset !== "ultraLow";
    slowFor = 0;
    resize();
    visibilityAt = -1;
    return preset;
  }
  quality(localStorage.getItem("son-koridor-quality") || "auto");
  window.addEventListener("resize", resize);
  function setItems(items = [], me) {
    const ids = new Set(items.filter((i) => !i.collected).map((i) => i.id));
    for (const [id, entry] of itemEntities)
      if (!ids.has(id)) {
        entry.entity.destroy();
        itemEntities.delete(id);
      }
    for (const item of items) {
      if (item.collected) continue;
      let entry = itemEntities.get(item.id);
      if (!entry) {
        const pivot = new pc.Entity("Shopping item " + item.id),
          resource =
            foodTemplates.get(item.model) || foodTemplates.get("carton");
        app.root.addChild(pivot);
        const model = resource.instantiateRenderEntity({ castShadows: false });
        pivot.addChild(model);
        fit(model, 0.36);
        disableShadows(model);
        entry = { entity: pivot, item };
        itemEntities.set(item.id, entry);
      }
      entry.item = item;
      entry.entity.setPosition(item.x, item.y, item.z);
      entry.owned = item.ownerId === me;
    }
  }
  function actor(player) {
    let a = actors.get(player.id);
    if (a) return a;
    const root = new pc.Entity("Player " + player.id);
    app.root.addChild(root);
    const c = PALETTE[(player.appearance || 0) % PALETTE.length],
      body = new Boxes();
    body.box(0, 1.08, 0, 0.46, 0.68, 0.25, c);
    body.box(0, 1.6, 0, 0.24, 0.27, 0.24, "#bbad8d");
    body.box(-0.14, 0.38, 0, 0.18, 0.72, 0.19, "#384748");
    body.box(0.14, 0.38, 0, 0.18, 0.72, 0.19, "#384748");
    body.box(-0.3, 1.02, -0.06, 0.12, 0.59, 0.13, c);
    body.box(0.3, 1.02, -0.06, 0.12, 0.59, 0.13, c);
    const model = entityFromBoxes(
        "Teammate " + player.name,
        body,
        worldMaterial,
        root,
      ),
      basket = cart(root, "Teammate basket");
    basket.setLocalPosition(0, 0, -1.15);
    a = { root, model, basket };
    actors.set(player.id, a);
    return a;
  }
  function update(state, me, dt, time, hasFlashlight = true) {
    lastDt = dt;
    lastState = state;
    lastMe = me;
    const now = performance.now(),
      self = state?.players.find((p) => p.id === me),
      playing = state?.phase === "playing";
    localCart.enabled = !!playing && !!self?.lives && !self?.captured;
    if (localCart.enabled) {
      localCart.setPosition(
        position.x - Math.sin(rotation.y) * 1.0,
        0,
        position.z - Math.cos(rotation.y) * 1.0,
      );
      localCart.setEulerAngles(0, rotation.y * DEG, 0);
    }
    const online = new Set();
    for (const p of state?.players || []) {
      if (p.id === me) continue;
      online.add(p.id);
      const a = actor(p);
      a.root.enabled =
        playing &&
        p.online &&
        p.lives > 0 &&
        Math.hypot(p.x - position.x, p.z - position.z) < budget.distance;
      a.root.setPosition(p.x, p.captured ? 0 : p.crouch ? -0.56 : 0, p.z);
      a.root.setEulerAngles(0, p.yaw * DEG, 0);
      a.basket.setLocalPosition(0, p.crouch ? 0.56 : 0, -1.15);
    }
    for (const [id, a] of actors)
      if (!online.has(id)) {
        a.root.destroy();
        actors.delete(id);
      }
    const l = state?.locust;
    monsterPivot.enabled = !!l && playing;
    if (l) {
      const distance = Math.hypot(l.x - position.x, l.z - position.z);
      monsterPivot.enabled = playing && distance < budget.distance + 8;
      monsterPivot.setPosition(l.x, 0, l.z);
      monsterPivot.setEulerAngles(0, l.yaw * DEG, 0);
      if (monsterModel?.anim) {
        monsterModel.anim.enabled =
          monsterPivot.enabled && distance < budget.animation;
        const name = l.capture
          ? "Jumpscare"
          : l.moving
            ? l.state === "chase"
              ? "Run"
              : "Walk"
            : "Idle";
        if (name !== monsterAnimation) {
          monsterAnimation = name;
          monsterModel.anim.baseLayer.transition(name, 0.2);
        }
        monsterModel.anim.speed = l.moving
          ? Math.max(
              0.45,
              Math.min(1.8, (l.speed || 3) / (name === "Run" ? 6.6 : 3.1)),
            )
          : 1;
      }
    }
    const key = (state?.fallenShelves || [])
      .map((f) => f.aisleIndex + ":" + f.side)
      .join(",");
    if (key !== fallenKey) {
      fallenKey = key;
      rebuildShelves(state?.fallenShelves || []);
      visibilityAt = -1;
    }
    const blackout = !!state?.blackout;
    app.scene.ambientLight.set(
      blackout ? 0.12 : 0.64,
      blackout ? 0.15 : 0.7,
      blackout ? 0.14 : 0.63,
    );
    sun.light.intensity = blackout ? 0.03 : 0.48;
    flashlight.enabled = playing && hasFlashlight;
    metrics.flashlightActive = flashlight.enabled;
    metrics.blackout = blackout;
    if (now - visibilityAt > 150) {
      visibilityAt = now;
      let visible = 0;
      for (const c of chunks) {
        const d = Math.hypot(c.x - position.x, c.z - position.z);
        c.base.enabled = d < budget.distance + 25;
        c.detail.enabled = d < budget.detail + 16;
        c.lamps.enabled = c.base.enabled && !blackout;
        if (c.base.enabled) visible++;
      }
      metrics.visibleChunks = visible;
      for (const e of itemEntities.values())
        e.entity.enabled =
          playing &&
          Math.hypot(e.item.x - position.x, e.item.z - position.z) <
            budget.distance;
    }
    return l;
  }
  function capturePose(state, player, hostNow) {
    const c = state?.locust?.capture;
    if (!c || c.playerId !== player?.id) return null;
    const elapsed = Math.max(
      0,
      Math.min(4300, (hostNow || Date.now()) - c.startedAt),
    );
    const yaw = c.yaw,
      fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      raise =
        elapsed < 1300
          ? elapsed / 1300
          : elapsed < 2900
            ? 1
            : Math.max(0, 1 - (elapsed - 2900) / 1000);
    const distance =
      elapsed < 2900 ? 1.9 : 1.9 + Math.min(1, (elapsed - 2900) / 1000) * 2;
    return {
      position: {
        x: c.x + fx * distance,
        y: 1.1 + raise * 1.1,
        z: c.z + fz * distance,
      },
      lookAt: { x: c.x, y: 3.3, z: c.z },
      roll:
        Math.sin(elapsed * 0.025) *
        (elapsed > 1300 && elapsed < 2900 ? 0.05 : 0.015),
    };
  }
  const renderer = {
    info: { render: { calls: 0, triangles: 0 } },
    render() {
      const now = performance.now();
      if (document.hidden) return false;
      if (drawFrameAt > 0) {
        const frame = Math.min(150, now - drawFrameAt);
        frameEMA = frameEMA * 0.95 + frame * 0.05;
        metrics.frameEMA = frameEMA;
        if (autoQuality && frameEMA > 42 && preset !== "ultraLow") {
          slowFor += frame;
          if (slowFor > 4000) {
            const next =
              preset === "high"
                ? "medium"
                : preset === "medium"
                  ? "low"
                  : "ultraLow";
            quality(next);
            autoQuality = true;
            requested = "auto";
            metrics.requestedQuality = "auto";
          }
        } else slowFor = Math.max(0, slowFor - frame);
      }
      drawFrameAt = now;
      syncCamera();
      // Match Application.tick's per-frame counter reset without scheduling
      // its own RAF. frameEnd alone only clears Gaussian-splat statistics.
      app.stats.updateBasic(
        now,
        lastDt,
        lastDt * 1000,
        app.renderer,
        app.graphicsDevice,
      );
      app.update(lastDt);
      app.render();
      const calls = app.graphicsDevice._drawCallsPerFrame;
      // Engine visibility flags count submitted triangles. Sample once a second;
      // traversing the graph/allocating an array each frame wastes old-PC CPU.
      let triangles = metrics.triangles;
      if (!renderer.trianglesAt || now - renderer.trianglesAt > 1000) {
        renderer.trianglesAt = now;
        triangles = 0;
        for (const r of app.root.findComponents("render"))
          if (r.enabled && r.entity.enabled)
            for (const mi of r.meshInstances)
              if (mi.visibleThisFrame)
                triangles += (mi.mesh.primitive[0]?.count || 0) / 3;
      }
      renderer.info.render.calls = calls;
      renderer.info.render.triangles = triangles;
      metrics.calls = calls;
      metrics.triangles = triangles;
      metrics.renderedFrames++;
      app.stats.frameEnd();
      return true;
    },
    domElement: canvas,
  };
  // Initialize component systems without starting a second animation loop.
  app.onLibrariesLoaded();
  app.systems.fire("initialize", app.root);
  app.systems.fire("postInitialize", app.root);
  app.systems.fire("postPostInitialize", app.root);
  onProgress(1);
  return {
    renderer,
    scene: app.scene,
    camera,
    monster: monsterPivot,
    setItems,
    update,
    capturePose,
    quality,
    metrics,
    app,
    destroy() {
      window.removeEventListener("resize", resize);
      app.destroy();
    },
  };
}
