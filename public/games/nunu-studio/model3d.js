/* 努努赛博定制台 · 3D 裸娃
 * 娃娃本身是几个椭球（头、身体、手臂、耳朵），表面是一层肤色。
 * 图纸上每一片裁片，按它的「用途」做成一块贴在椭球上的曲面片：片上每个点和图纸上的点一一对应，
 * 贴图就是这一片自己的画布，所以鼠标打到哪，立刻知道是图纸上的哪一点；图样上画一笔，这里也同步变。
 * 片外面是透明的，所以 3D 上看到的就是图纸的轮廓贴在娃娃身上。 */
(function (root) {
'use strict';
const C = root.NunuCore;
const T = () => root.THREE;

function ellipsoidGeometry(targetKey, nu = 48, nv = 32) {
  const THREE = T(), pos = [], nor = [], idx = [];
  for (let i = 0; i <= nv; i++) for (let j = 0; j <= nu; j++) {
    const d = C.dirOf(-180 + (360 * j) / nu, (180 * i) / nv);
    pos.push(...C.targetPoint(targetKey, d, 0));
    nor.push(...C.targetNormal(targetKey, d));
  }
  for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) {
    const a = i * (nu + 1) + j, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** 一片裁片 → 贴在椭球上的曲面片。网格铺在裁片外接框上，每个顶点按用途换算成 3D 的点；uv = 外接框里的位置，正好对上这一片的画布 */
function pillowGeometry(piece, doc) {
  const THREE = T(), m = C.pillowMesh(piece, doc);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
  g.setIndex(m.idx);
  g.computeVertexNormals();
  return g;
}

function patchGeometry(piece, n = 36, over) {
  const THREE = T(), role = over || C.ROLES[piece.role], b = piece.box, pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const u = j / n, v = i / n, d = C.pieceDir(piece, b.x + u * b.w, b.y + v * b.h);
    pos.push(...C.targetPoint(role.target, d, role.off));
    nor.push(...C.targetNormal(role.target, d));
    uv.push(u, v);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = i * (n + 1) + j, bb = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, bb, bb, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function create(canvas) {
  const THREE = T();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cdbd, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff1e6, 0.25);
  rim.position.set(-4, 2, -5);
  scene.add(rim);
  const group = new THREE.Group();
  scene.add(group);

  const view = { rotY: -0.35, rotX: 0.06, zoom: 1.0, target: 1.7 };
  const raycaster = new THREE.Raycaster();
  const bases = [], patches = new Map();
  let skinMat = null, doc = null;

  const texOf = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;
    t.encoding = THREE.sRGBEncoding;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return t;
  };

  /** 重建（图纸或用途变了）：comps[id] = { canvas, ... } 是每一片自己的画布 */
  function build(newDoc, comps, skinHex, shells) {
    doc = newDoc;
    for (const m of bases) { group.remove(m); m.geometry.dispose(); }
    bases.length = 0;
    for (const p of patches.values()) { group.remove(p.mesh); p.mesh.geometry.dispose(); p.tex.dispose(); p.mat.dispose(); }
    patches.clear();
    skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex).convertSRGBToLinear(), roughness: 0.95, metalness: 0 });
    if (!doc.flat) for (const k of Object.keys(C.TARGETS)) { // 只有圆头有一个底（光头）；扁平头、身体、手臂、耳朵完全由裁片自己缝出来
      const m = new THREE.Mesh(ellipsoidGeometry(k), skinMat);
      m.userData.base = k;
      group.add(m);
      bases.push(m);
    }
    for (const p of doc.pieces) {
      const role = C.ROLES[p.role];
      if (!role || !role.target || !comps[p.id]) continue;
      const tex = texOf(comps[p.id].canvas);
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: p.material === 'hair' ? 0.85 : 0.95, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 - Math.round((role.off || 0) * 40), polygonOffsetUnits: -1 });
      const mesh = new THREE.Mesh(role.kind === 'pillow' ? pillowGeometry(p, doc) : patchGeometry(p), mat);
      mesh.userData.pieceId = p.id;
      group.add(mesh);
      patches.set(p.id, { mesh, tex, mat });
    }
    // 前发、后发：脑袋上另起的一层（比头皮布再凸出去一点），只有画了的地方看得见
    for (const sh of shells || []) {
      const tex = texOf(sh.canvas);
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -1 });
      const mesh = new THREE.Mesh(sh.shellPiece ? pillowGeometry(sh.shellPiece, doc) : patchGeometry(sh.piece, 40, { target: 'head', off: sh.off }), mat);
      mesh.userData.pieceId = sh.piece.id;
      group.add(mesh);
      patches.set(sh.piece.id, { mesh, tex, mat });
    }
    view.target = doc.flat ? 1.5 : C.TARGETS.head.pos[1] - 0.4;
  }
  /** 头顶的发片：画板上画出来的每一块，做成一张贴在头顶的卡片，底边贴着头、往外翘；左右位置跟它在画板上的位置一致 */
  const cards = [];
  function setCards(list, board, unit) {
    for (const c of cards) { group.remove(c); c.geometry.dispose(); c.material.dispose(); }
    cards.length = 0;
    const head = C.TARGETS.head;
    for (const d of list) {
      const shape = new THREE.Shape();
      const ax = d.box.x + d.box.w / 2, ay = d.box.y + d.box.h; // 底边中点贴在头上
      d.poly.forEach(([x, y], i) => { const px = (x - ax) * unit, py = (ay - y) * unit; if (i) shape.lineTo(px, py); else shape.moveTo(px, py); });
      const u = Math.max(0, Math.min(1, (ax - board.x) / board.w)), psi = ((160 - 140 * u) * Math.PI) / 180;
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: new THREE.Color(d.hex).convertSRGBToLinear(), roughness: 0.85, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -1 }));
      mesh.position.set(head.pos[0] + head.r[0] * 0.97 * Math.cos(psi), head.pos[1] + head.r[1] * 0.97 * Math.sin(psi), 0.15);
      mesh.rotation.z = psi - Math.PI / 2;
      group.add(mesh);
      cards.push(mesh);
    }
  }
  function setSkin(hex) { if (skinMat) skinMat.color.set(hex).convertSRGBToLinear(); }
  function refresh(id) {
    if (id) { const p = patches.get(id); if (p) p.tex.needsUpdate = true; return; }
    for (const p of patches.values()) p.tex.needsUpdate = true;
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function render() {
    if (!doc) return;
    group.rotation.y = view.rotY;
    group.rotation.x = view.rotX;
    camera.position.set(0, view.target + 0.3, 11.5 / view.zoom);
    camera.lookAt(0, view.target, 0);
    renderer.render(scene, camera);
  }

  /** 屏幕上的点打到哪：先找最近的、真的在裁片里面的点；打到娃娃本体（没有裁片盖着）返回 { base }；什么都没打到返回 null */
  function pick(clientX, clientY, filter) {
    if (!doc) return null;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const objs = [...bases, ...[...patches.values()].map((p) => p.mesh)];
    for (const h of raycaster.intersectObjects(objs, false)) {
      const o = h.object;
      if (o.userData.base) return { base: o.userData.base };
      if (!h.uv) continue;
      const piece = doc.byId[o.userData.pieceId], b = piece.box;
      if (filter && !filter(piece)) continue;
      const x = b.x + h.uv.x * b.w, y = b.y + h.uv.y * b.h;
      if (C.inPoly(piece.poly, x, y)) return { pieceId: piece.id, x, y };
    }
    return null;
  }
  const snapshot = () => { render(); return canvas.toDataURL('image/png'); };

  return { renderer, view, build, setSkin, setCards, refresh, resize, render, pick, snapshot };
}

root.NunuModel = { create, ellipsoidGeometry, patchGeometry };
})(window);
