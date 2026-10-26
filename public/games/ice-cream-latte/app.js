let scene, camera, renderer;
        let tableMesh, cupGroup, cupBodyMesh, saucerMesh, liquidMesh, liquidTexture, liquidCanvas, liquidCtx;
        let pitcherGroup, pitcherMesh, milkStreamMesh;
        let stirSpoonGroup, penGroup;
        let hemiLight, sunLight;

        const LIQUID_Y = 1.48;   // 咖啡液面高度
        const SCOOP_R = 0.9;     // 冰淇淋球半径
        const MAX_SCOOPS = 14;   // 杯子最多放几颗
        const scoops = [];       // 所有冰淇淋球的网格

        // 交互状态
        let currentMode = 'ADD'; // 'ADD' | 'FLATTEN' | 'SPOON' | 'PITCHER' | 'ETCH' | 'ORBIT'
        let currentGelatoColor = '#fffcf0';
        let isInteracting = false;
        let currentHitPoint = null;
        let lastHitPoint = null;
        let currentHitObject = null;
        let lastCanvasPos = null;
        let actionStartTime = 0;
        let penPts = [];
        let penColor = '#e8334a';   // 彩笔颜色（和口味分开，颜色更跳）
        let currentDeco = 'lemon';  // 当前选中的小装饰
        let grabbedScoop = null;    // 正在被捏起来的冰淇淋球
        const decos = [];           // 放上去的小装饰
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(LIQUID_Y + 0.6));
        const groundHit = new THREE.Vector3();
        let currentHitUV = null;    // 命中点在网格上的 uv，用来把字画到杯子上
        let pinchMode = 'peak';     // 捏起来：'peak' 捏出尖角 | 'move' 挪动
        let currentShape = 'ball';  // 新放的冰淇淋形状
        let currentScoopSize = 1;   // 新放的冰淇淋大小
        let clayMode = 'push';      // 橡皮泥：'push' 推 | 'squeeze' 挤 | 'poke' 戳 | 'smooth' 抹
        let clayGrab = null;        // 推的时候抓住的那一块
        let cupCanvas = null, cupCtx = null, cupTexture = null;
        let cupProfileLen = 1;      // 杯身轮廓总长度，用来换算笔刷大小
        const undoStack = [];       // 撤回栈：每一步之前的快照
        const UNDO_MAX = 30;
        let brushLevel = 3;         // 幅度 1~10
        let toolYaw = 0;            // 道具朝向（弧度），相对镜头
        let toolTilt = 0;           // 道具倾斜（弧度）
        let lastPaintObj = null;    // 画画时上一笔落在哪个物体上
        const assets = [];          // 自己上传的素材：{ id, name, canvas, tex }
        const ASSET_MAX = 12;
        let currentStamp = null;    // 画画时选中的素材印章（null 表示用颜色画）
        let stampedThisStroke = false;
        let currentHitFace = null;  // 命中的面，用来让贴纸贴着表面

        // 把幅度换算成 0.1~1 的系数，各工具按它决定大小和速度
        function brushScale() {
            return brushLevel / 10;
        }
        let pendingUndo = null;     // 这次按下时的快照，松手时才决定要不要入栈
        let actionDirty = false;    // 这次操作是否真的改动了东西

        // 360° 自由相机
        let camRadius = 8.5;
        const camTarget = new THREE.Vector3(0, 0, 0);   // 视线中心（可平移）
        let orbitDrag = false;      // 右键拖动：随时转视角
        let panDrag = false;        // Shift / 中键拖动：平移
        let lastCentroid = null;    // 双指中心点，用来双指拖动转视角
        const CAM_MIN = 3.5;        // 最近距离
        const CAM_MAX = 14;         // 最远距离
        let pinchStartDist = 0;     // 双指捏合开始时两指的距离
        let pinchStartRadius = 8.5;
        let camTheta = 0.0;
        let camPhi = 0.82;
        let lastPointerPos = { x: 0, y: 0 };
        let camTween = null;        // 镜头平滑移动：进出雕琢台时慢慢滑过去，不跳
        let camUserMoved = false;   // 取景之后用户自己动过镜头

        // i18n 兜底：i18n.js 未加载时仍然按原中文显示
        const setLocalizedText = window.setI18nText || function (el, zh, params) {
            if (!el) return;
            el.textContent = params ? zh.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : zh;
        };

        function init() {
            const box = document.getElementById('webgl-box');
            const w = box.clientWidth;
            const h = box.clientHeight;

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xfaf0f2);

            camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
            updateCameraPosition();

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(w, h);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            applyStageFraming();
            // 画质：sRGB 输出 + 电影感色调映射，颜色更干净、高光更柔和
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.0;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            box.appendChild(renderer.domElement);

            // 光影系统：环境光 + 主光（带柔和阴影）+ 逆光轮廓光
            hemiLight = new THREE.HemisphereLight(0xfff6fa, 0xf1c4cf, 0.7);
            scene.add(hemiLight);

            sunLight = new THREE.DirectionalLight(0xfff3e6, 1.0);
            sunLight.position.set(6, 14, 8);
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.set(2048, 2048);
            sunLight.shadow.camera.left = -5;
            sunLight.shadow.camera.right = 5;
            sunLight.shadow.camera.top = 5;
            sunLight.shadow.camera.bottom = -5;
            sunLight.shadow.camera.near = 1;
            sunLight.shadow.camera.far = 40;
            sunLight.shadow.bias = -0.0004;
            scene.add(sunLight);

            const rim = new THREE.DirectionalLight(0xffd1dc, 0.5);
            rim.position.set(-6, 8, -5);
            scene.add(rim);

            // 1. 桌布
            buildCustomizableTable('pink');

            // 2. 白瓷杯与浓缩咖啡液面
            buildSolidUnified3DCup();

            // 3. 道具模型
            buildMilkPitcher();
            buildStirSpoon();
            buildEtchingPen();

            setupPointerEvents();
            window.addEventListener('resize', onResize);
            setMainMode('ADD');
            animate();
        }

        // ================= 1. 360° 相机系统 =================
        // 竖屏按窄边拉远；宽屏也适度拉远，避免杯子贴满整屏被工具坞压住
        function cameraFit() {
            const wideFit = Math.pow(Math.min(1.6, Math.max(1, camera.aspect / 1.1)), 0.45);
            return Math.pow(Math.max(1, 1.2 / camera.aspect), 0.8) * wideFit;
        }

        function updateCameraPosition() {
            const fit = cameraFit();
            const r = camRadius * fit;
            camera.position.x = camTarget.x + r * Math.sin(camPhi) * Math.sin(camTheta);
            camera.position.y = r * Math.cos(camPhi);
            camera.position.z = camTarget.z + r * Math.sin(camPhi) * Math.cos(camTheta);
            // 默认距离及更远时看杯子中部；越拉近越往上看，落到冰淇淋上
            const t = THREE.MathUtils.clamp((8.5 - camRadius) / (8.5 - CAM_MIN), 0, 1);
            const lookY = 0.8 + t * 1.0 + camLookLift;
            camera.lookAt(camTarget.x, lookY, camTarget.z);
        }

        // 镜头慢慢滑到新位置（缓入缓出），用户一动手就停下
        function tweenCamera(to, ms) {
            camTween = {
                from: { x: camTarget.x, z: camTarget.z, r: camRadius, phi: camPhi, theta: camTheta },
                to: to, t0: performance.now(), ms: ms || 480
            };
        }

        function stepCamTween() {
            if (!camTween) return;
            const k = Math.min(1, (performance.now() - camTween.t0) / camTween.ms);
            const e = k * k * (3 - 2 * k);
            const f = camTween.from, to = camTween.to;
            camTarget.x = f.x + (to.x - f.x) * e;
            camTarget.z = f.z + (to.z - f.z) * e;
            camRadius = f.r + (to.r - f.r) * e;
            camPhi = f.phi + (to.phi - f.phi) * e;
            camTheta = f.theta + (to.theta - f.theta) * e;
            updateCameraPosition();
            if (k >= 1) camTween = null;
        }

        // 转视角：左右不限，上下从几乎正上方到几乎平视
        function orbitBy(dx, dy) {
            camTween = null;
            camUserMoved = true;
            camTheta -= dx * 0.008;
            camPhi = THREE.MathUtils.clamp(camPhi - dy * 0.008, 0.12, 1.5);
            updateCameraPosition();
        }

        // 平移：沿屏幕左右、前后移动视线中心，最远不离开杯子太多
        function panBy(dx, dy) {
            camTween = null;
            camUserMoved = true;
            const k = camRadius * 0.0015;
            const rx = Math.cos(camTheta), rz = -Math.sin(camTheta);
            const fx = -Math.sin(camTheta), fz = -Math.cos(camTheta);
            camTarget.x += -dx * k * rx + dy * k * fx;
            camTarget.z += -dx * k * rz + dy * k * fz;
            // 雕琢台时转台也在画面里，允许平移得更远一点
            const maxPan = currentMode === 'SCULPT' ? 4.5 : 2.5;
            const len = Math.hypot(camTarget.x, camTarget.z);
            if (len > maxPan) {
                camTarget.x *= maxPan / len;
                camTarget.z *= maxPan / len;
            }
            updateCameraPosition();
        }

        function setCamPreset(preset) {
            document.getElementById('camPresetPop').style.display = 'none';
            camTween = null;
            camTarget.set(0, 0, 0);
            if (preset === 'BARISTA') {
                camTheta = 0.0;
                camPhi = 0.82;
            } else if (preset === 'SIDE') {
                camTheta = 0.45;
                camPhi = 1.35;
            } else {
                camTheta = 0.0;
                camPhi = 0.2;
            }
            updateCameraPosition();
        }

        function zoomBy(factor) {
            camTween = null;
            camUserMoved = true;
            camRadius = THREE.MathUtils.clamp(camRadius * factor, CAM_MIN, camMax());
            updateCameraPosition();
        }

        // 雕琢台要同时装下杯子和转台，能拉得更远
        function camMax() {
            return currentMode === 'SCULPT' ? CAM_MAX * 1.5 : CAM_MAX;
        }

        function toggleCamPresets() {
            const p = document.getElementById('camPresetPop');
            p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
        }

        // ================= 2. 桌布 =================
        function generateTableTexture(theme) {
            const c = document.createElement('canvas');
            c.width = 512; c.height = 512;
            const ctx = c.getContext('2d');

            if (theme === 'wood') {
                ctx.fillStyle = '#b08968';
                ctx.fillRect(0, 0, 512, 512);
                ctx.strokeStyle = '#7f5539';
                ctx.lineWidth = 6;
                for (let i = 0; i < 35; i++) {
                    ctx.beginPath();
                    let y = i * 16;
                    ctx.moveTo(0, y);
                    ctx.bezierCurveTo(150, y + 8, 350, y - 8, 512, y);
                    ctx.stroke();
                }
            } else {
                let sqColor = '#ff9ebb';
                let crossColor = '#ff6584';

                if (theme === 'mint') {
                    sqColor = '#a5d6a7';
                    crossColor = '#66bb6a';
                } else if (theme === 'purple') {
                    sqColor = '#ce93d8';
                    crossColor = '#ab47bc';
                } else if (theme === 'orange') {
                    sqColor = '#ffe082';
                    crossColor = '#ffa726';
                }

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, 512, 512);

                const sq = 64;
                ctx.fillStyle = sqColor;
                for (let y = 0; y < 512; y += sq) {
                    for (let x = 0; x < 512; x += sq) {
                        if ((x / sq + y / sq) % 2 === 0) ctx.fillRect(x, y, sq, sq);
                    }
                }
                ctx.fillStyle = crossColor;
                ctx.globalAlpha = 0.45;
                for (let y = 0; y < 512; y += sq * 2) ctx.fillRect(0, y, 512, sq);
                for (let x = 0; x < 512; x += sq * 2) ctx.fillRect(x, 0, sq, 512);
                ctx.globalAlpha = 1.0;
            }

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(7, 7);
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            tex.encoding = THREE.sRGBEncoding;
            return tex;
        }

        function buildCustomizableTable(theme) {
            const tableGeo = new THREE.CylinderGeometry(15, 15, 1, 48);
            const tableMat = new THREE.MeshStandardMaterial({ map: generateTableTexture(theme), roughness: 0.55 });

            if (tableMesh) scene.remove(tableMesh);
            tableMesh = new THREE.Mesh(tableGeo, tableMat);
            tableMesh.position.y = -0.52;
            tableMesh.receiveShadow = true;
            scene.add(tableMesh);
        }

        function changeTableColor(theme) {
            tableMesh.material.map = generateTableTexture(theme);
            tableMesh.material.needsUpdate = true;
            document.getElementById('colorPalette').style.display = 'none';
        }

        function togglePalette() {
            const p = document.getElementById('colorPalette');
            p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
        }

        // ================= 3. 白瓷杯与咖啡液面 =================
        function buildSolidUnified3DCup() {
            cupGroup = new THREE.Group();

            // 上釉瓷器：带清漆层，有柔和的高光
            const porcelainMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                roughness: 0.15,
                metalness: 0,
                clearcoat: 0.6,
                clearcoatRoughness: 0.12
            });

            // 底托
            const saucerPts = [];
            saucerPts.push(new THREE.Vector2(0, 0));
            saucerPts.push(new THREE.Vector2(1.8, 0.04));
            saucerPts.push(new THREE.Vector2(3.3, 0.32));
            saucerPts.push(new THREE.Vector2(3.5, 0.28));
            saucerPts.push(new THREE.Vector2(1.8, -0.08));
            saucerPts.push(new THREE.Vector2(1.6, 0));
            saucerMesh = new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 64), porcelainMat);
            saucerMesh.receiveShadow = true;
            saucerMesh.castShadow = true;
            cupGroup.add(saucerMesh);

            // 宽口深腹杯
            const cupPts = [];
            cupPts.push(new THREE.Vector2(0.9, 0.1));
            cupPts.push(new THREE.Vector2(1.65, 0.8));
            cupPts.push(new THREE.Vector2(2.1, 1.75));
            cupPts.push(new THREE.Vector2(2.22, 1.8));
            cupPts.push(new THREE.Vector2(2.18, 1.68));
            cupPts.push(new THREE.Vector2(1.85, 0.6));
            cupPts.push(new THREE.Vector2(1.1, 0.05));
            cupPts.push(new THREE.Vector2(0.9, 0.05));
            // 杯身单独一张画布，用来在杯子外壁上画画
            cupCanvas = document.createElement('canvas');
            cupCanvas.width = 2048;
            cupCanvas.height = 768;
            cupCtx = cupCanvas.getContext('2d');
            cupCtx.fillStyle = '#ffffff';
            cupCtx.fillRect(0, 0, cupCanvas.width, cupCanvas.height);
            cupTexture = new THREE.CanvasTexture(cupCanvas);
            cupTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            cupTexture.encoding = THREE.sRGBEncoding;

            // 杯身 uv 改成按轮廓长度均匀分布：原来每段轮廓平分高度，杯壁被压扁、杯沿被拉长
            const cupGeo = new THREE.LatheGeometry(cupPts, 96);
            const lens = [0];
            for (let j = 1; j < cupPts.length; j++) lens.push(lens[j - 1] + cupPts[j].distanceTo(cupPts[j - 1]));
            cupProfileLen = lens[lens.length - 1];
            const uvAttr = cupGeo.attributes.uv;
            for (let k = 0; k < uvAttr.count; k++) uvAttr.setY(k, lens[k % cupPts.length] / cupProfileLen);
            uvAttr.needsUpdate = true;

            cupBodyMesh = new THREE.Mesh(cupGeo, new THREE.MeshPhysicalMaterial({
                map: cupTexture,
                color: 0xffffff,
                roughness: 0.15,
                metalness: 0,
                clearcoat: 0.6,
                clearcoatRoughness: 0.12
            }));
            cupBodyMesh.receiveShadow = true;
            cupBodyMesh.castShadow = true;
            cupGroup.add(cupBodyMesh);

            // 把手
            const handleGeo = new THREE.TorusGeometry(0.62, 0.12, 24, 40, Math.PI * 1.15);
            const handle = new THREE.Mesh(handleGeo, porcelainMat);
            handle.rotation.z = -Math.PI / 2;
            handle.position.set(2.35, 0.95, 0);
            handle.castShadow = true;
            cupGroup.add(handle);

            // 浓缩咖啡液面（拉花与彩笔都画在这张贴图上）
            liquidCanvas = document.createElement('canvas');
            liquidCanvas.width = 1024;
            liquidCanvas.height = 1024;
            liquidCtx = liquidCanvas.getContext('2d');
            drawFreshCremaBase();

            liquidTexture = new THREE.CanvasTexture(liquidCanvas);
            liquidTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            liquidTexture.encoding = THREE.sRGBEncoding;

            const liquidGeo = new THREE.CircleGeometry(1.95, 96);
            liquidGeo.rotateX(-Math.PI / 2);

            // 咖啡液面：有光泽的清漆质感
            const liquidMat = new THREE.MeshPhysicalMaterial({
                map: liquidTexture,
                roughness: 0.3,
                metalness: 0,
                clearcoat: 0.8,
                clearcoatRoughness: 0.12
            });

            liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
            liquidMesh.position.y = LIQUID_Y;
            liquidMesh.receiveShadow = true;
            cupGroup.add(liquidMesh);

            scene.add(cupGroup);
        }

        function drawFreshCremaBase() {
            const rad = 512;
            const grad = liquidCtx.createRadialGradient(rad, rad, 40, rad, rad, rad);
            grad.addColorStop(0.0, '#a55928');
            grad.addColorStop(0.45, '#783510');
            grad.addColorStop(0.85, '#4a1d06');
            grad.addColorStop(1.0, '#270e02');

            liquidCtx.fillStyle = grad;
            liquidCtx.fillRect(0, 0, 1024, 1024);

            // 很淡的油脂光斑，代替之前颗粒感强的贴图
            liquidCtx.fillStyle = 'rgba(255, 205, 145, 0.04)';
            for (let i = 0; i < 60; i++) {
                liquidCtx.beginPath();
                liquidCtx.arc(Math.random() * 1024, Math.random() * 1024, 20 + Math.random() * 40, 0, Math.PI * 2);
                liquidCtx.fill();
            }
        }

        // ================= 4. 冰淇淋球：每颗一个颜色，可多颗叠放，可压平 =================
        function placeScoop(hit) {
            if (scoops.length >= MAX_SCOOPS) {
                setBubble('冰淇淋球已经放满 {n} 颗啦，先清空再来吧~', { n: MAX_SCOOPS });
                return;
            }
            const p = hit.point;
            // 空气墙已拆掉：桌面、托盘、杯沿、别的冰淇淋上都能放
            const onScoop = scoops.includes(hit.object);

            // 每颗球一张画布：底色就是口味色，之后可以在上面画画
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = currentGelatoColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const tex = new THREE.CanvasTexture(canvas);
            tex.encoding = THREE.sRGBEncoding;
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

            const mat = new THREE.MeshPhysicalMaterial({
                map: tex,
                color: 0xffffff,
                roughness: 0.42,
                metalness: 0,
                clearcoat: 0.25,
                clearcoatRoughness: 0.35
            });
            // 球的两极转到左右两侧，正面和顶部画画时不容易变形
            const geo = buildScoopGeometry(currentShape);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData.canvas = canvas;
            mesh.userData.ctx = ctx;
            mesh.userData.tex = tex;
            // 底部稍微没入咖啡；叠在别的冰淇淋上时坐在它上面
            const size = currentScoopSize;
            const minY = geo.boundingBox.min.y;
            mesh.scale.setScalar(size);
            // 落在咖啡里就浮在液面；叠在别的球上就坐在球顶；其他表面就贴着表面放
            const liquidY = LIQUID_Y - minY * size - 0.05 * size;
            const stackY = p.y - minY * size * 0.55;
            const surfaceY = p.y - minY * size * 0.85;
            const y = onScoop ? stackY : (hit.object === liquidMesh ? liquidY : surfaceY);
            mesh.userData.baseY = y;
            mesh.position.set(p.x, y, p.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            scoops.push(mesh);
            actionDirty = true;
        }

        // ================= 冰淇淋形状 =================
        // 每种形状给出"从中心往某个方向走多远到表面"，把同一个球面网格的点挪过去。
        // 网格、贴图坐标都不变，所以各种工具对所有形状都能用

        // 沿方向 d 往外走，找到隐式曲面 F(p) 从里(<=0)到外(>0)的位置
        function implicitRadius(d, F, tmax) {
            const step = 0.03;
            let t = step;
            while (t < tmax && F(d.x * t, d.y * t, d.z * t) <= 0) t += step;
            if (t >= tmax) return tmax;
            let lo = t - step, hi = t;
            for (let i = 0; i < 18; i++) {
                const mid = (lo + hi) / 2;
                if (F(d.x * mid, d.y * mid, d.z * mid) <= 0) lo = mid; else hi = mid;
            }
            return (lo + hi) / 2;
        }

        // 平面图形鼓成胖胖的立体：正面看是这个形状，侧面是圆润的厚度
        function puffy(d, radius2D, thickness) {
            const rho = Math.hypot(d.x, d.y);
            const r = radius2D(Math.atan2(d.y, d.x));
            return 1 / Math.hypot(rho / r, d.z / thickness);
        }

        // 爱心曲线 (x²+y²−1)³ − x²y³ = 0，尖朝下
        function heartRadius2D(theta) {
            const c = Math.cos(theta), s = Math.sin(theta);
            const inside = (r) => { const x = r * c, y = r * s, q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0; };
            let r = 0.05;
            while (r < 2 && inside(r)) r += 0.05;
            let lo = r - 0.05, hi = r;
            for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inside(mid)) lo = mid; else hi = mid; }
            return 0.85 * (lo + hi) / 2;
        }

        // 圆角五角星，一个角朝上
        function starRadius2D(theta) {
            return 0.6 + 0.48 * Math.pow((Math.cos(5 * (theta - Math.PI / 2)) + 1) / 2, 2);
        }

        const CAT_EARS = [new THREE.Vector3(-0.55, 0.83, 0.05).normalize(), new THREE.Vector3(0.55, 0.83, 0.05).normalize()];

        const SCOOP_SHAPES = {
            ball: d => 1 / Math.hypot(d.x / 1.08, d.y / 0.9, d.z / 1.08),
            flat: d => 1 / Math.hypot(d.x / 1.2, d.y / 0.55, d.z / 1.2),
            // 圆角方块：超椭球，指数越大越方
            cube: d => 0.82 / Math.pow(Math.pow(Math.abs(d.x), 6) + Math.pow(Math.abs(d.y), 6) + Math.pow(Math.abs(d.z), 6), 1 / 6),
            heart: d => puffy(d, heartRadius2D, 0.5),
            star: d => puffy(d, starRadius2D, 0.45),
            // 猫头：略扁的球，上面两只平滑隆起的耳朵
            cat: d => {
                let r = 1 / Math.hypot(d.x / 1.1, d.y / 0.92, d.z / 1.0);
                for (const e of CAT_EARS) {
                    const c = d.x * e.x + d.y * e.y + d.z * e.z;
                    if (c > 0.88) {
                        const k = (c - 0.88) / 0.12;
                        r += 0.62 * Math.pow(k, 1.25);
                    }
                }
                return r;
            },
            // 水滴：底部圆、顶上收成一个软软的尖
            drop: d => implicitRadius(d, (x, y, z) => {
                const t = (y + 0.85) / 2.1;
                if (t <= 0 || t >= 1) return 1;
                return Math.hypot(x, z) - 1.05 * Math.pow(Math.sin(Math.PI * t), 0.7) * Math.pow(1 - t, 0.35);
            }, 2.2),
            // 甜筒：一圈圈往上盘、越往上越细，最后收成小尖
            swirl: d => implicitRadius(d, (x, y, z) => {
                const t = (y + 0.7) / 2.3;
                if (t < 0 || t >= 1) return 1;
                const turn = t * 3.5 * Math.PI * 2 + Math.atan2(z, x);
                const base = Math.sqrt(Math.min(1, t / 0.08));
                const r = (1.05 * Math.pow(1 - t, 0.9) + 0.1 * (1 - t) * (0.5 + 0.5 * Math.sin(turn))) * base;
                return Math.hypot(x, z) - r;
            }, 2.6)
        };

        function buildScoopGeometry(shape) {
            // 球的两极转到左右两侧，正面和顶部画画时不容易变形
            const geo = new THREE.SphereGeometry(SCOOP_R, 64, 48);
            geo.rotateZ(Math.PI / 2);
            const f = SCOOP_SHAPES[shape] || SCOOP_SHAPES.ball;
            const pos = geo.attributes.position;
            const d = new THREE.Vector3();
            for (let v = 0; v < pos.count; v++) {
                d.set(pos.getX(v), pos.getY(v), pos.getZ(v)).normalize();
                const t = f(d) * SCOOP_R;
                pos.setXYZ(v, d.x * t, d.y * t, d.z * t);
            }
            computeWeldedNormals(geo);
            geo.computeBoundingBox();
            geo.computeBoundingSphere();
            return geo;
        }

        // 一颗冰淇淋在世界里大概有多大，捏和压用它判断有没有碰到
        function scoopReach(m) {
            return m.geometry.boundingSphere.radius * m.scale.x + 0.1;
        }

        function setShape(shape, elem) {
            currentShape = shape;
            document.querySelectorAll('#shapeBar .shape-btn').forEach(b => b.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        function setScoopSize(size, elem) {
            currentScoopSize = size;
            document.querySelectorAll('#shapeBar .size-btn').forEach(b => b.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        // 勺背压平：只作用在按到的冰淇淋球上，用平滑衰减，不产生尖刺
        function pressScoops(curPoint) {
            const s = brushScale();
            const PR = 0.25 + 0.3 * s;     // 压平范围（球的局部单位）
            const RATE = 0.02 + 0.12 * s;  // 每帧压下比例
            const PUSH = 0.03;  // 向外挤的距离

            for (const m of scoops) {
                if (Math.hypot(m.position.x - curPoint.x, m.position.z - curPoint.z) > scoopReach(m) + PR) continue;

                const pl = m.worldToLocal(curPoint.clone());
                const pos = m.geometry.attributes.position;
                let changed = false;

                for (let v = 0; v < pos.count; v++) {
                    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
                    const dx = x - pl.x, dz = z - pl.z;
                    const d = Math.hypot(dx, dz);
                    if (d >= PR) continue;

                    const f = 1 - (d / PR) * (d / PR);
                    const w = f * f;
                    if (y > pl.y) {
                        pos.setY(v, y - (y - pl.y) * RATE * w);
                        changed = true;
                    }
                    if (d > 1e-4) {
                        pos.setX(v, x + (dx / d) * PUSH * w);
                        pos.setZ(v, z + (dz / d) * PUSH * w);
                        changed = true;
                    }
                }

                if (changed) {
                    pos.needsUpdate = true;
                    computeWeldedNormals(m.geometry);
                    m.geometry.computeBoundingSphere();
                }
            }
        }

        function setGelatoColor(colorHex, elem) {
            currentGelatoColor = colorHex;
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        // ================= 5. 道具模型：拉花缸、勺子、画笔 =================
        function buildMilkPitcher() {
            pitcherGroup = new THREE.Group();
            pitcherMesh = new THREE.Group();

            const steelMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.92, roughness: 0.15 });
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 1.8, 32), steelMat);
            body.castShadow = true;
            pitcherMesh.add(body);

            const spoutGeo = new THREE.ConeGeometry(0.25, 0.45, 24);
            spoutGeo.translate(0, 0.2, -0.65);
            spoutGeo.rotateX(-Math.PI / 4);
            const spout = new THREE.Mesh(spoutGeo, steelMat);
            spout.position.y = 0.7;
            pitcherMesh.add(spout);

            const pHandle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 12, 24, Math.PI), steelMat);
            pHandle.rotation.y = Math.PI / 2;
            pHandle.position.set(0, 0, 0.8);
            pitcherMesh.add(pHandle);

            pitcherMesh.position.set(0, 1.6, 0.8);
            pitcherMesh.rotation.x = 0.35;
            pitcherMesh.rotation.z = -0.25;
            pitcherGroup.add(pitcherMesh);

            // 奶流：细一点，颜色跟随当前口味
            const streamGeo = new THREE.CylinderGeometry(0.035, 0.055, 1.4, 16);
            streamGeo.translate(0, -0.7, 0);
            const streamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 });
            milkStreamMesh = new THREE.Mesh(streamGeo, streamMat);
            milkStreamMesh.visible = false;
            pitcherGroup.add(milkStreamMesh);

            pitcherGroup.position.set(0, 2.8, 0);
            pitcherGroup.visible = false;
            scene.add(pitcherGroup);
        }

        function buildStirSpoon() {
            stirSpoonGroup = new THREE.Group();
            const steelMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.95, roughness: 0.15 });

            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 3.2, 16), steelMat);
            handle.position.y = 1.4;
            handle.castShadow = true;
            stirSpoonGroup.add(handle);

            const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), steelMat);
            scoop.scale.set(0.9, 0.3, 1.3);
            scoop.position.y = 0.05;
            stirSpoonGroup.add(scoop);

            stirSpoonGroup.rotation.x = 0.38;
            stirSpoonGroup.rotation.z = -0.2;
            stirSpoonGroup.position.set(0, LIQUID_Y, 0);
            stirSpoonGroup.visible = false;
            scene.add(stirSpoonGroup);
        }

        function buildEtchingPen() {
            penGroup = new THREE.Group();
            const pin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.04, 2.2, 16),
                new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 })
            );
            pin.position.y = 1.1;
            penGroup.add(pin);

            const drop = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 16, 12),
                new THREE.MeshStandardMaterial({ color: 0x241107, roughness: 0.1 })
            );
            drop.position.y = 0.04;
            penGroup.add(drop);

            penGroup.rotation.x = 0.55;
            penGroup.rotation.z = -0.3;
            penGroup.visible = false;
            scene.add(penGroup);
        }

        // ================= 6. 拉花：一圈圈叠加的柔和印章，沿路径连续画 =================
        // 每个印章：白色奶泡中心 → 口味色的内圈 → 金色边缘 → 渐隐到咖啡色
        function pourStamp(cx, cy, r) {
            const g = liquidCtx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
            g.addColorStop(0.0, 'rgba(255, 250, 242, 1)');
            g.addColorStop(0.5, 'rgba(255, 250, 242, 1)');
            g.addColorStop(0.72, currentGelatoColor);
            g.addColorStop(0.88, 'rgba(214, 150, 70, 0.95)');
            g.addColorStop(1.0, 'rgba(60, 20, 5, 0)');
            liquidCtx.fillStyle = g;
            liquidCtx.beginPath();
            liquidCtx.arc(cx, cy, r, 0, Math.PI * 2);
            liquidCtx.fill();
        }

        // 把液面坐标 (0..1024) 转成屏幕上的一点
        function liquidCoordsFromHit(point) {
            const local = liquidMesh.worldToLocal(point.clone());
            return {
                x: ((local.x / 1.95) * 0.5 + 0.5) * 1024,
                y: ((local.z / 1.95) * 0.5 + 0.5) * 1024
            };
        }

        // ================= 7. 旋涡乳化：在咖啡中搅拌（保留原有算法） =================
        function applyTrueFluidMixing(cx, cy, moveX, moveY, speed) {
            const radius = 30 + 90 * brushScale();
            const r2 = radius * radius;
            const x0 = Math.max(0, Math.floor(cx - radius));
            const y0 = Math.max(0, Math.floor(cy - radius));
            const x1 = Math.min(1024, Math.ceil(cx + radius));
            const y1 = Math.min(1024, Math.ceil(cy + radius));
            const w = x1 - x0;
            const h = y1 - y0;
            if (w <= 4 || h <= 4) return;

            const img = liquidCtx.getImageData(x0, y0, w, h);
            const data = img.data;

            let sumR = 0, sumG = 0, sumB = 0, count = 0;
            for (let py = 0; py < h; py++) {
                const dy = (y0 + py) - cy;
                const row = py * w;
                for (let px = 0; px < w; px++) {
                    const dx = (x0 + px) - cx;
                    if (dx * dx + dy * dy < r2) {
                        const idx = (row + px) * 4;
                        sumR += data[idx];
                        sumG += data[idx + 1];
                        sumB += data[idx + 2];
                        count++;
                    }
                }
            }
            if (count === 0) return;
            const avgR = sumR / count;
            const avgG = sumG / count;
            const avgB = sumB / count;

            const mixRate = Math.min(0.08 + speed * 0.016, 0.42);
            const advX = THREE.MathUtils.clamp(moveX * 0.35, -20, 20);
            const advY = THREE.MathUtils.clamp(moveY * 0.35, -20, 20);

            const src = new Uint8ClampedArray(data);

            for (let py = 0; py < h; py++) {
                const dy = (y0 + py) - cy;
                const row = py * w;
                for (let px = 0; px < w; px++) {
                    const dx = (x0 + px) - cx;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < r2) {
                        const factor = 1 - Math.sqrt(d2) / radius;
                        const localMix = mixRate * factor;

                        const sx = Math.round(px - advX * factor);
                        const sy = Math.round(py - advY * factor);
                        let r, g, b;

                        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                            const sIdx = (sy * w + sx) * 4;
                            r = src[sIdx];
                            g = src[sIdx + 1];
                            b = src[sIdx + 2];
                        } else {
                            const idx = (row + px) * 4;
                            r = src[idx];
                            g = src[idx + 1];
                            b = src[idx + 2];
                        }

                        const idx = (row + px) * 4;
                        data[idx]     = Math.round(r * (1 - localMix) + avgR * localMix);
                        data[idx + 1] = Math.round(g * (1 - localMix) + avgG * localMix);
                        data[idx + 2] = Math.round(b * (1 - localMix) + avgB * localMix);
                    }
                }
            }

            liquidCtx.putImageData(img, x0, y0);
            liquidTexture.needsUpdate = true;
        }

        // ================= 8. 彩笔：平滑的描边（二次曲线连接相邻点） =================
        function drawPenStroke(p) {
            penPts.push(p);
            if (penPts.length > 3) penPts.shift();
            if (penPts.length < 3) return;

            const a = penPts[0], b = penPts[1], c = penPts[2];
            const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };

            liquidCtx.lineCap = 'round';
            liquidCtx.lineJoin = 'round';
            // 先画一层深色描边，颜色更跳，不会糊在咖啡里
            liquidCtx.beginPath();
            liquidCtx.moveTo(m1.x, m1.y);
            liquidCtx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
            liquidCtx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
            const penW = 4 + 16 * brushScale();
            liquidCtx.lineWidth = penW + 5;
            liquidCtx.stroke();
            liquidCtx.strokeStyle = penColor;
            liquidCtx.lineWidth = penW;
            liquidCtx.stroke();
            liquidTexture.needsUpdate = true;
        }

        // ================= 9. 交互调度 =================
        function setBubble(text, params) {
            const b = document.getElementById('maidBubble');
            // 文案以中文原文为 key 交给 i18n 处理，切换语言后依然是同一句
            setLocalizedText(b, text, params);
            b.style.display = 'block';
        }

        function updateContinuousInteraction() {
            // 雕琢台里只有上色、揉捏、拖模型才算改动，转视角不记撤回
            if (isInteracting && currentMode !== 'ORBIT' && currentHitPoint &&
                (currentMode !== 'SCULPT' || sculptEditing)) actionDirty = true;

            // 雕琢台 · 揉捏：和冰淇淋一样推、挤、戳、抹、捏尖
            if (currentMode === 'SCULPT' && sculptSlot === 'clay' && sculptEditing && isInteracting) {
                if (sculptTool === 'push') {
                    if (clayGrab) updateClayGrab();
                } else if (currentHitPoint && isSculptMesh(currentHitObject)) {
                    sculptBrush(currentHitObject, currentHitPoint, sculptTool);
                }
                return;
            }
            // 捏起来：球被拿着时跟随指针在杯口上方移动
            if (currentMode === 'PINCH' && grabbedScoop) {
                const p = groundPoint();
                if (p) {
                    const d = Math.hypot(p.x, p.z);
                    const s = d > 1.6 ? 1.6 / d : 1;
                    grabbedScoop.position.set(p.x * s, grabbedScoop.userData.baseY + 0.5, p.z * s);
                }
                return;
            }

            // 橡皮泥：推是抓住一块跟着手指走；挤、戳、抹是按住时每帧改一点
            if (currentMode === 'CLAY' && isInteracting) {
                if (clayMode === 'push') {
                    if (clayGrab) updateClayGrab();
                } else if (currentHitPoint && currentHitObject && scoops.includes(currentHitObject)) {
                    clayBrush(currentHitObject, currentHitPoint, clayMode);
                } else if (currentHitPoint && isSculptMesh(currentHitObject)) {
                    sculptBrush(currentHitObject, currentHitPoint, clayMode);
                }
                return;
            }

            // 捏出尖角：按住球的表面拖动，表面被拉起一个柔和的尖
            if (currentMode === 'PINCH' && pinchMode === 'peak' && isInteracting && currentHitPoint &&
                currentHitObject && scoops.includes(currentHitObject)) {
                pinchPeak(currentHitPoint);
                return;
            }
            if (currentMode === 'PINCH' && pinchMode === 'peak' && isInteracting && currentHitPoint && isSculptMesh(currentHitObject)) {
                sculptBrush(currentHitObject, currentHitPoint, 'peak');
                return;
            }

            // 画画：杯身外壁或冰淇淋球上都能画，颜色用颜色条里选的
            if (currentMode === 'CUP' && isInteracting && currentHitUV && currentHitObject) {
                // 印图：选了自己上传的素材时，点一下印一次，拖动时不连续印
                if (currentStamp) {
                    const target = currentHitObject;
                    if (!stampedThisStroke && (target === cupBodyMesh || target === liquidMesh || scoops.includes(target) || target.userData.paintable)) {
                        stampAsset(target, currentHitUV, currentHitPoint);
                        stampedThisStroke = true;
                    }
                    return;
                }
                const obj = currentHitObject;
                // 换了画的物体就重新起笔，避免两个画布之间连线
                if (obj !== lastPaintObj) lastCanvasPos = null;
                if (obj === cupBodyMesh) {
                    lastCanvasPos = paintCup(currentHitUV, lastCanvasPos, currentHitPoint);
                    lastPaintObj = obj;
                    return;
                }
                if (scoops.includes(obj)) {
                    lastCanvasPos = paintScoop(obj, currentHitUV, lastCanvasPos);
                    lastPaintObj = obj;
                    return;
                }
                if (obj.userData.paintable) {
                    lastCanvasPos = paintScoop(obj, currentHitUV, lastCanvasPos);
                    lastPaintObj = obj;
                    return;
                }
            }

            if (!isInteracting || !currentHitPoint) return;

            // 勺背压平：只压按到的冰淇淋球
            if (currentMode === 'FLATTEN') {
                if (currentHitObject && scoops.includes(currentHitObject)) {
                    pressScoops(currentHitPoint);
                }
                return;
            }

            // 旋涡乳化：在咖啡液面上画圈搅拌
            if (currentMode === 'SPOON' && currentHitObject === liquidMesh) {
                snapshotLiquid();
                stirSpoonGroup.position.set(currentHitPoint.x, LIQUID_Y, currentHitPoint.z);
                stirSpoonGroup.rotation.x = 0.38;

                const c = liquidCoordsFromHit(currentHitPoint);
                let moveX = 0, moveY = 0, speed = 4;
                if (lastCanvasPos) {
                    moveX = c.x - lastCanvasPos.x;
                    moveY = c.y - lastCanvasPos.y;
                    speed = Math.hypot(moveX, moveY);
                }
                applyTrueFluidMixing(c.x, c.y, moveX, moveY, speed);
                lastCanvasPos = c;
                return;
            }

            // 金边拉花：按住越久奶泡越大，移动时沿路径连续盖章
            if (currentMode === 'PITCHER' && currentHitObject === liquidMesh) {
                snapshotLiquid();
                const c = liquidCoordsFromHit(currentHitPoint);
                pitcherMesh.rotation.x = 0.72;
                milkStreamMesh.visible = true;
                milkStreamMesh.material.color.set(currentGelatoColor);
                milkStreamMesh.material.emissive.set(currentGelatoColor);

                const holdSec = (performance.now() - actionStartTime) / 1000;
                const s = brushScale();
                const r = Math.min(10 + holdSec * (6 + 20 * s), 30 + 60 * s);

                if (lastCanvasPos) {
                    const dist = Math.hypot(c.x - lastCanvasPos.x, c.y - lastCanvasPos.y);
                    const steps = Math.max(1, Math.ceil(dist / Math.max(r * 0.2, 2)));
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        pourStamp(lastCanvasPos.x + (c.x - lastCanvasPos.x) * t,
                                  lastCanvasPos.y + (c.y - lastCanvasPos.y) * t, r);
                    }
                } else {
                    pourStamp(c.x, c.y, r);
                }
                lastCanvasPos = c;
                liquidTexture.needsUpdate = true;
                return;
            }

            // 描边彩笔：平滑曲线
            if (currentMode === 'ETCH' && currentHitObject === liquidMesh) {
                snapshotLiquid();
                const c = liquidCoordsFromHit(currentHitPoint);
                const last = penPts[penPts.length - 1];
                if (!last || Math.hypot(c.x - last.x, c.y - last.y) > 2) {
                    drawPenStroke(c);
                }
                lastCanvasPos = c;
            }
        }

        function setMainMode(mode) {
            if (mode === 'SCULPT' && currentMode !== 'SCULPT') modeBeforeSculpt = currentMode;
            currentMode = mode;
            grabbedScoop = null;
            clayGrab = null;
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

            pitcherGroup.visible = (mode === 'PITCHER');
            stirSpoonGroup.visible = (mode === 'FLATTEN' || mode === 'SPOON');
            penGroup.visible = (mode === 'ETCH');
            document.getElementById('pinchBar').style.display = mode === 'PINCH' ? 'flex' : 'none';
            document.getElementById('clayBar').style.display = mode === 'CLAY' ? 'flex' : 'none';
            document.getElementById('shapeBar').style.display = mode === 'ADD' ? 'flex' : 'none';
            document.getElementById('penBar').style.display = (mode === 'ETCH' || mode === 'CUP') ? 'flex' : 'none';
            document.getElementById('decoBar').style.display = mode === 'DECO' ? 'flex' : 'none';
            const sheet = document.getElementById('sculptSheet');
            if (sheet) sheet.classList.toggle('open', mode === 'SCULPT');
            document.body.classList.toggle('sculpt-on', mode === 'SCULPT');
            if (mode === 'SCULPT') openSculptBench();
            else if (sculptPrevCam || benchFigure || benchPlatform) closeSculptBench();
            document.getElementById('stampChips').style.display = mode === 'CUP' ? 'contents' : 'none';
            const sized = ['PINCH', 'CLAY', 'FLATTEN', 'SPOON', 'PITCHER', 'ETCH', 'CUP'].includes(mode);
            document.getElementById('sizeBar').style.display = sized ? 'flex' : 'none';
            document.getElementById('angleBar').style.display = ['FLATTEN', 'SPOON', 'PITCHER', 'ETCH'].includes(mode) ? 'flex' : 'none';

            const pills = {
                ADD: ['btnToolAdd', '🍨 选好形状和大小，点一下杯子放一颗（每颗都能换口味）'],
                PINCH: ['btnToolPinch', '🤏 捏起来 (下方选：捏出尖角，或挪动冰淇淋球)'],
                CLAY: ['btnToolClay', '🧸 橡皮泥 (下方选推、挤、戳、抹，按住冰淇淋球揉一揉)'],
                FLATTEN: ['btnToolFlatten', '🥄 勺背压平 (按住冰淇淋球上方滑动，压成柔软的一层)'],
                SPOON: ['btnToolSpoon', '🌪️ 旋涡乳化 (在咖啡中搅拌，把冰淇淋与咖啡融匀)'],
                PITCHER: ['btnToolPitcher', '🥛 金边拉花 (按住不动会鼓起奶泡，移动就画出纹路)'],
                ETCH: ['btnToolEtch', '🍫 描边彩笔 (下方选颜色，在咖啡液面上画线条)'],
                DECO: ['btnToolDeco', '🍋 小装饰 (下方选一种，点在冰淇淋或咖啡上；也能上传自己的图片当贴纸)'],
                CUP: ['btnToolCup', '🎨 画画 (选颜色画；选自己的图片，点一下印到杯子、冰淇淋或咖啡上)'],
                ORBIT: ['btnToolOrbit', '🖐️ 转视角 (拖动旋转，Shift+拖动平移；其他模式下右键或双指拖动也能转)'],
                SCULPT: ['btnToolSculpt', '🗿 雕琢台：在杯子旁边拼小人，拖它转一圈，「揉捏」能像冰淇淋一样捏形状']
            };
            const [btnId, text] = pills[mode];
            document.getElementById(btnId).classList.add('active');
            // 子面板出现 / 消失会改变工具坞高度，取景跟着更新
            if (typeof applyStageFraming === 'function') requestAnimationFrame(applyStageFraming);
            setLocalizedText(document.getElementById('modePill'), text);
            fitModePill();
        }

        // 窄屏上把模式提示裁成两行（不同浏览器对 -webkit-line-clamp 支持不一）
        function fitModePill() {
            const el = document.getElementById('modePill');
            if (!el || !el.clientHeight) return;
            const full = el.textContent;
            if (el.scrollHeight <= el.clientHeight + 1) return;
            let n = full.length;
            while (n > 6 && el.scrollHeight > el.clientHeight + 1) {
                n -= 2;
                el.textContent = full.slice(0, n).replace(/[\s，,、:：;；\-—]+$/, '') + '…';
            }
        }
        window.fitModePill = fitModePill;
        document.addEventListener('gelato:langchange', () => requestAnimationFrame(fitModePill));

        function setToolYaw(deg) {
            toolYaw = THREE.MathUtils.degToRad(Number(deg));
        }

        function setToolTilt(deg) {
            toolTilt = THREE.MathUtils.degToRad(Number(deg));
        }

        // 每帧摆好道具的角度。朝向加上镜头的方位角：转了视角，道具也跟着转，看起来始终是同一个方向
        function applyToolPose() {
            const yaw = camTheta + toolYaw;
            stirSpoonGroup.rotation.order = 'YXZ';
            stirSpoonGroup.rotation.set((currentMode === 'FLATTEN' ? 0.18 : 0.38) + toolTilt, yaw, -0.2);
            // 拉花缸只转朝向：奶流挂在它下面，倾斜会把奶流也歪掉
            pitcherGroup.rotation.order = 'YXZ';
            pitcherGroup.rotation.set(0, yaw, 0);
            penGroup.rotation.order = 'YXZ';
            penGroup.rotation.set(0.55 + toolTilt, yaw, -0.3);
        }

        function setBrushLevel(v) {
            brushLevel = Number(v);
            document.getElementById('sizeVal').innerText = v;
            // 顶部幅度条和雕琢台里的幅度条是同一个值
            for (const id of ['sizeRange', 'sculptBrushRange']) {
                const el = document.getElementById(id);
                if (el && el.value !== String(v)) el.value = String(v);
            }
        }

        function setClayMode(mode, elem) {
            clayMode = mode;
            clayGrab = null;
            document.querySelectorAll('#clayBar .deco-btn').forEach(d => d.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        // ================= 橡皮泥 =================
        // 权重：中心为 1，到边缘平滑降到 0，所以推挤戳抹都不会出硬边和尖刺
        function clayFalloff(d, R) {
            if (d >= R) return 0;
            const t = 1 - (d / R) * (d / R);
            return t * t;
        }

        // 重新算光照方向，并把接缝、两极上重合的点统一成同一个方向，揉过的地方不会出现折线
        function computeWeldedNormals(geo) {
            geo.computeVertexNormals();
            if (!geo.index) return;   // 星星眼这类不带索引的小零件，直接用自带的法线
            const { members } = clayNeighbors(geo);
            const n = geo.attributes.normal;
            for (const list of members.values()) {
                if (list.length < 2) continue;
                let x = 0, y = 0, z = 0;
                for (const v of list) { x += n.getX(v); y += n.getY(v); z += n.getZ(v); }
                const len = Math.hypot(x, y, z) || 1;
                for (const v of list) n.setXYZ(v, x / len, y / len, z / len);
            }
            n.needsUpdate = true;
        }

        function finishClayEdit(mesh) {
            const geo = mesh.geometry;
            geo.attributes.position.needsUpdate = true;
            computeWeldedNormals(geo);
            geo.computeBoundingSphere();
        }

        // 球面在接缝和两极有位置重合的重复顶点。抹的时候要把它们当成同一个点，
        // 否则两边各抹各的，会抹出一条裂缝。这里按位置分组，并算出每组的相邻组
        function clayNeighbors(geo) {
            if (geo.userData.clayNb) return geo.userData.clayNb;
            const pos = geo.attributes.position, idx = geo.index.array;
            const keyOf = v => Math.round(pos.getX(v) * 1e4) + ',' + Math.round(pos.getY(v) * 1e4) + ',' + Math.round(pos.getZ(v) * 1e4);
            const repByKey = new Map(), rep = new Int32Array(pos.count), members = new Map();
            for (let v = 0; v < pos.count; v++) {
                const k = keyOf(v);
                if (!repByKey.has(k)) {
                    repByKey.set(k, v);
                    members.set(v, []);
                }
                rep[v] = repByKey.get(k);
                members.get(rep[v]).push(v);
            }
            const nbSet = new Map();
            for (const r of members.keys()) nbSet.set(r, new Set());
            const link = (a, b) => {
                if (a === b) return;
                nbSet.get(a).add(b);
                nbSet.get(b).add(a);
            };
            for (let i = 0; i < idx.length; i += 3) {
                const a = rep[idx[i]], b = rep[idx[i + 1]], c = rep[idx[i + 2]];
                link(a, b); link(b, c); link(a, c);
            }
            const nb = new Map();
            for (const [r, s] of nbSet) nb.set(r, [...s]);
            geo.userData.clayNb = { rep, members, nb };
            return geo.userData.clayNb;
        }

        // 推：按下时记下范围内的顶点和原位置；拖动时这一块跟着手指平移，越靠中心跟得越多
        function startClayGrab(mesh, point) {
            const R = 0.3 + 0.4 * brushScale();
            const local = mesh.worldToLocal(point.clone());
            const pos = mesh.geometry.attributes.position;
            const verts = [], weights = [], orig = [];
            for (let v = 0; v < pos.count; v++) {
                const dx = pos.getX(v) - local.x, dy = pos.getY(v) - local.y, dz = pos.getZ(v) - local.z;
                const w = clayFalloff(Math.sqrt(dx * dx + dy * dy + dz * dz), R);
                if (w > 0) {
                    verts.push(v);
                    weights.push(w);
                    orig.push(pos.getX(v), pos.getY(v), pos.getZ(v));
                }
            }
            // 手指在一张正对镜头、穿过按下点的平面上移动
            const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
            clayGrab = {
                mesh: mesh,
                plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point),
                startLocal: local,
                maxPull: R * 1.6,
                verts: verts, weights: weights, orig: orig
            };
        }

        function updateClayGrab() {
            const g = clayGrab;
            const hitW = raycaster.ray.intersectPlane(g.plane, new THREE.Vector3());
            if (!hitW) return;
            if (g.world) {
                updateSculptGrab(g, hitW);
                return;
            }
            const delta = g.mesh.worldToLocal(hitW).sub(g.startLocal);
            if (delta.length() > g.maxPull) delta.setLength(g.maxPull);  // 拉太远会把表面扯得太薄，这里按范围封顶
            const pos = g.mesh.geometry.attributes.position;
            for (let i = 0; i < g.verts.length; i++) {
                const w = g.weights[i];
                pos.setXYZ(g.verts[i], g.orig[i * 3] + delta.x * w, g.orig[i * 3 + 1] + delta.y * w, g.orig[i * 3 + 2] + delta.z * w);
            }
            finishClayEdit(g.mesh);
        }

        // 挤 / 戳 / 抹：按住时每帧改一点，松手就停在那里
        function clayBrush(mesh, point, mode) {
            const s = brushScale();
            const R = 0.2 + 0.35 * s;
            const local = mesh.worldToLocal(point.clone());
            const pos = mesh.geometry.attributes.position;
            const near = [];
            for (let v = 0; v < pos.count; v++) {
                const dx = pos.getX(v) - local.x, dy = pos.getY(v) - local.y, dz = pos.getZ(v) - local.z;
                const w = clayFalloff(Math.sqrt(dx * dx + dy * dy + dz * dz), R);
                if (w > 0) near.push(v, w);
            }
            if (!near.length) return;

            if (mode === 'squeeze') {
                // 挤：往球的中轴收，被挤出来的部分往上鼓
                const rate = 0.01 + 0.03 * s;
                for (let i = 0; i < near.length; i += 2) {
                    const v = near[i], k = rate * near[i + 1];
                    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
                    const rxz = Math.hypot(x, z);
                    if (rxz < 0.05) continue;
                    pos.setXYZ(v, x - (x / rxz) * k, y + k * 0.8, z - (z / rxz) * k);
                }
            } else if (mode === 'poke') {
                // 戳：往球心方向按出一个圆圆的小坑，按得越久越深
                const rate = 0.004 + 0.012 * s;
                for (let i = 0; i < near.length; i += 2) {
                    const v = near[i];
                    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
                    const len = Math.hypot(x, y, z);
                    if (len < 0.2) continue;  // 不戳穿到中心
                    const k = rate * near[i + 1] / len;
                    pos.setXYZ(v, x - x * k, y - y * k, z - z * k);
                }
            } else {
                // 抹：每个点往相邻点的平均位置靠，把疙瘩和棱角抹平
                const { rep, members, nb } = clayNeighbors(mesh.geometry);
                const rate = 0.15 + 0.35 * s;
                const seen = new Set(), targets = [];
                for (let i = 0; i < near.length; i += 2) {
                    const r = rep[near[i]];
                    if (seen.has(r)) continue;
                    seen.add(r);
                    const list = nb.get(r);
                    if (!list.length) continue;
                    let ax = 0, ay = 0, az = 0;
                    for (const u of list) { ax += pos.getX(u); ay += pos.getY(u); az += pos.getZ(u); }
                    targets.push(r, near[i + 1], ax / list.length, ay / list.length, az / list.length);
                }
                for (let i = 0; i < targets.length; i += 5) {
                    const r = targets[i], k = rate * targets[i + 1];
                    const nx = pos.getX(r) + (targets[i + 2] - pos.getX(r)) * k;
                    const ny = pos.getY(r) + (targets[i + 3] - pos.getY(r)) * k;
                    const nz = pos.getZ(r) + (targets[i + 4] - pos.getZ(r)) * k;
                    for (const m of members.get(r)) pos.setXYZ(m, nx, ny, nz);
                }
            }
            finishClayEdit(mesh);
        }

        function setPinchMode(mode, elem) {
            pinchMode = mode;
            grabbedScoop = null;
            document.querySelectorAll('#pinchBar .deco-btn').forEach(d => d.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        // 捏出尖角：指针下的球面被慢慢往上拉，离指针越近拉得越高，形成柔和的尖
        function pinchPeak(curPoint) {
            const s = brushScale();
            const PR = 0.2 + 0.3 * s;      // 作用范围（球的局部单位）
            const RATE = 0.006 + 0.03 * s; // 每帧拉起比例
            const LIFT = 0.3;  // 尖角比指针高出的距离

            for (const m of scoops) {
                if (m.position.distanceTo(curPoint) > scoopReach(m)) continue;

                const pl = m.worldToLocal(curPoint.clone());
                const target = pl.y + LIFT;
                const pos = m.geometry.attributes.position;
                let changed = false;

                for (let v = 0; v < pos.count; v++) {
                    const dx = pos.getX(v) - pl.x, dz = pos.getZ(v) - pl.z;
                    const d = Math.hypot(dx, dz);
                    if (d >= PR) continue;

                    const f = 1 - (d / PR) * (d / PR);
                    const y = pos.getY(v);
                    if (y < target) {
                        pos.setY(v, y + (target - y) * RATE * f * f);
                        changed = true;
                    }
                }

                if (changed) {
                    pos.needsUpdate = true;
                    computeWeldedNormals(m.geometry);
                    m.geometry.computeBoundingSphere();
                }
            }
        }

        // 在小人身体上画：用彩笔颜色盖简单色块，复用 paintScoop 的球面印章逻辑
        function paintSculptBody(mesh, uv) {
            lastCanvasPos = paintScoop(mesh, uv, lastCanvasPos);
        }

        // 在冰淇淋球上画：沿笔迹盖椭圆印章，横向按纬度拉宽，抵消球面贴图的拉伸
        function paintScoop(mesh, uv, from) {
            const { canvas, ctx, tex } = mesh.userData;
            const W = canvas.width, H = canvas.height;
            const x = uv.x * W;
            const y = (1 - uv.y) * H;

            // 本次操作第一次画这颗球时，先存一份画布，撤回时用
            if (pendingUndo && !pendingUndo.ballCanvases.has(mesh)) {
                pendingUndo.ballCanvases.set(mesh, cloneCanvas(canvas));
            }

            const ry = 2 + 8 * brushScale();
            ctx.fillStyle = penColor;
            const stamp = (sx, sy) => {
                const theta = (sy / H) * Math.PI;
                const rx = ry / Math.max(Math.sin(theta), 0.15);
                // 靠近左右接缝时，在另一侧也补画一份
                for (const ox of [0, -W, W]) {
                    if (ox !== 0 && (sx + ox + rx < 0 || sx + ox - rx > W)) continue;
                    ctx.beginPath();
                    ctx.ellipse(sx + ox, sy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            };

            if (from) {
                // 跨过左右接缝时走较短的那一边，接缝两侧都能连上
                let fx = from.x;
                if (x - fx > W / 2) fx += W;
                else if (fx - x > W / 2) fx -= W;
                const dist = Math.hypot(x - fx, y - from.y);
                const steps = Math.max(1, Math.ceil(dist / (ry * 0.5)));
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const px = fx + (x - fx) * t;
                    stamp(((px % W) + W) % W, from.y + (y - from.y) * t);
                }
            } else {
                stamp(x, y);
            }
            tex.needsUpdate = true;
            return { x: x, y: y };
        }

        // 画杯子：沿笔迹盖椭圆印章。笔刷按真实尺寸换算成像素，
        // 横向再按命中点到杯轴的半径补偿，杯口和杯底画出来一样粗
        function paintCup(uv, from, point) {
            const W = cupCanvas.width, H = cupCanvas.height;
            const x = uv.x * W;
            const y = (1 - uv.y) * H;

            // 本次操作第一次画杯子时，先存一份画布，撤回时用
            if (pendingUndo && !pendingUndo.cup) pendingUndo.cup = cloneCanvas(cupCanvas);

            const r = Math.max(Math.hypot(point.x, point.z), 0.5);
            const rad = 0.02 + 0.08 * brushScale();          // 笔刷半径（世界单位）
            const ry = rad * H / cupProfileLen;
            const rx = rad * W / (2 * Math.PI * r);

            cupCtx.fillStyle = penColor;
            const stamp = (sx, sy) => {
                for (const ox of [0, -W, W]) {
                    if (ox !== 0 && (sx + ox + rx < 0 || sx + ox - rx > W)) continue;
                    cupCtx.beginPath();
                    cupCtx.ellipse(sx + ox, sy, rx, ry, 0, 0, Math.PI * 2);
                    cupCtx.fill();
                }
            };

            if (from) {
                // 跨过左右接缝时走较短的那一边，接缝两侧都能连上
                let fx = from.x;
                if (x - fx > W / 2) fx += W;
                else if (fx - x > W / 2) fx -= W;
                const dist = Math.hypot(x - fx, y - from.y);
                const steps = Math.max(1, Math.ceil(dist / (Math.min(rx, ry) * 0.5)));
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const px = fx + (x - fx) * t;
                    stamp(((px % W) + W) % W, from.y + (y - from.y) * t);
                }
            } else {
                stamp(x, y);
            }
            cupTexture.needsUpdate = true;
            return { x: x, y: y };
        }

        function setPenColor(hex, elem) {
            penColor = hex;
            currentStamp = null;
            document.querySelectorAll('.pen-dot').forEach(d => d.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        function setDecoType(type, elem) {
            currentDeco = type;
            document.querySelectorAll('#decoBar .deco-btn').forEach(d => d.classList.remove('active'));
            if (elem) elem.classList.add('active');
        }

        // 捏起来：指针射线与杯口上方的水平面求交，得到球该去的位置
        function groundPoint() {
            const p = raycaster.ray.intersectPlane(groundPlane, groundHit);
            return p ? p.clone() : null;
        }

        // 小装饰：用几何体拼出来，每一种都有自己的颜色
        function buildDecoration(type) {
            if (type.startsWith('asset:')) return buildAssetSticker(assets.find(a => a.id === type.slice(6)));
            const g = new THREE.Group();
            const part = (geo, color, x, y, z) => {
                const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color(color).convertSRGBToLinear(),
                    roughness: 0.35,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.3
                }));
                m.position.set(x, y, z);
                m.castShadow = true;
                g.add(m);
                return m;
            };

            if (type === 'lemon') {
                // 柠檬片：黄色外皮 + 浅黄果肉 + 六瓣分隔
                part(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48), 0xffd93b, 0, 0.04, 0);
                part(new THREE.CylinderGeometry(0.36, 0.36, 0.09, 48), 0xfff1a6, 0, 0.045, 0);
                for (let k = 0; k < 6; k++) {
                    const seg = part(new THREE.BoxGeometry(0.03, 0.1, 0.34), 0xfff8c9, 0, 0.05, 0);
                    seg.rotation.y = k * Math.PI / 3;
                }
            } else if (type === 'strawberry') {
                // 草莓：尖端朝下的红色圆锥 + 绿色花萼
                const body = new THREE.ConeGeometry(0.24, 0.42, 32);
                body.rotateX(Math.PI);
                part(body, 0xe8334a, 0, 0.21, 0);
                for (let k = 0; k < 5; k++) {
                    const leaf = part(new THREE.SphereGeometry(0.1, 16, 8), 0x3fa34d, 0, 0.42, 0);
                    leaf.scale.set(1.8, 0.2, 1.0);
                    leaf.rotation.y = k * 2 * Math.PI / 5;
                }
            } else if (type === 'cherry') {
                // 樱桃：两颗红球 + 细梗 + 小叶子
                part(new THREE.SphereGeometry(0.18, 24, 16), 0xc1121f, -0.1, 0.18, 0);
                part(new THREE.SphereGeometry(0.18, 24, 16), 0xc1121f, 0.12, 0.2, 0.04);
                const stem = part(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), 0x5b8c3a, 0.0, 0.4, 0);
                stem.rotation.z = -0.4;
                const leaf = part(new THREE.SphereGeometry(0.12, 16, 8), 0x3fa34d, 0.18, 0.5, 0);
                leaf.scale.set(1.6, 0.2, 0.9);
            } else if (type === 'mint') {
                // 薄荷叶：扁平的绿叶
                const leaf = part(new THREE.SphereGeometry(0.22, 24, 16), 0x3cb371, 0, 0.02, 0);
                leaf.scale.set(1, 0.08, 0.55);
            } else if (type === 'cookie') {
                // 饼干：棕色圆片 + 几颗巧克力豆
                part(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 48), 0xc98a4b, 0, 0.045, 0);
                for (let k = 0; k < 6; k++) {
                    const a = k * Math.PI / 3 + 0.3;
                    part(new THREE.SphereGeometry(0.04, 12, 10), 0x3b1d0e, Math.cos(a) * 0.18, 0.1, Math.sin(a) * 0.18);
                }
            } else if (type === 'chips') {
                // 巧克力碎：一小撮深色碎屑
                for (let k = 0; k < 8; k++) {
                    const a = k * 0.9;
                    const rr = 0.08 + (k % 3) * 0.08;
                    part(new THREE.SphereGeometry(0.045, 12, 10), 0x2a1408, Math.cos(a) * rr, 0.04, Math.sin(a) * rr);
                }
            } else if (type === 'blueberry') {
                // 蓝莓：一小串深蓝圆球
                for (let k = 0; k < 3; k++) {
                    const a = k * 2;
                    part(new THREE.SphereGeometry(0.11, 20, 14), 0x3a4b9e, Math.cos(a) * 0.14, 0.11, Math.sin(a) * 0.14);
                }
            } else if (type === 'marshmallow') {
                // 棉花糖：白色小方糖
                part(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xfffaf3, 0, 0.15, 0);
            } else if (type === 'starcandy') {
                // 糖霜星星：扁平金色星形（用八面体压扁近似）
                const s = part(new THREE.OctahedronGeometry(0.22, 0), 0xf7d154, 0, 0.1, 0);
                s.scale.set(1, 0.32, 1);
                s.rotation.y = Math.PI / 5;
            } else if (type === 'wafer') {
                // 威化卷：细长圆柱 + 两端奶油
                const stick = part(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 20), 0xe8c389, 0, 0.1, 0);
                stick.rotation.z = Math.PI / 2;
                part(new THREE.SphereGeometry(0.1, 16, 10), 0xfff4e0, -0.25, 0.1, 0);
                part(new THREE.SphereGeometry(0.1, 16, 10), 0xfff4e0, 0.25, 0.1, 0);
            } else {
                // 巧克力碎（兜底）
                for (let k = 0; k < 8; k++) {
                    const a = k * 0.9;
                    const rr = 0.08 + (k % 3) * 0.08;
                    part(new THREE.SphereGeometry(0.045, 12, 10), 0x2a1408, Math.cos(a) * rr, 0.04, Math.sin(a) * rr);
                }
            }
            return g;
        }

        // ================= 自己上传的素材 =================
        function pickAsset() {
            if (assets.length >= ASSET_MAX) {
                setBubble('素材最多放 {n} 张啦~', { n: ASSET_MAX });
                return;
            }
            document.getElementById('assetInput').click();
        }

        // 读图：优先 createImageBitmap，不行再用 Image；统一缩到最长边 512，省内存也省性能
        async function decodeImage(file) {
            let src;
            try {
                src = await createImageBitmap(file);
            } catch (e) {
                src = await new Promise((resolve, reject) => {
                    const url = URL.createObjectURL(file);
                    const im = new Image();
                    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
                    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
                    im.src = url;
                });
            }
            const w = src.width, h = src.height;
            if (!w || !h) throw new Error('empty image');
            const s = Math.min(1, 512 / Math.max(w, h));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * s));
            c.height = Math.max(1, Math.round(h * s));
            c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
            return c;
        }

        function makeThumb(asset, size) {
            const t = document.createElement('canvas');
            t.width = t.height = size * 2;
            const ctx = t.getContext('2d');
            const s = Math.min(t.width / asset.canvas.width, t.height / asset.canvas.height);
            const w = asset.canvas.width * s, h = asset.canvas.height * s;
            ctx.drawImage(asset.canvas, (t.width - w) / 2, (t.height - h) / 2, w, h);
            return t;
        }

        // 每张素材在两处出现：小装饰里当贴纸，画画里当印章
        function addAssetButtons(asset) {
            const decoBtn = document.createElement('button');
            decoBtn.className = 'deco-btn asset-btn';
            decoBtn.title = asset.name;
            const dt = makeThumb(asset, 24);
            dt.className = 'asset-thumb';
            decoBtn.appendChild(dt);
            decoBtn.addEventListener('click', () => setDecoType('asset:' + asset.id, decoBtn));
            const upload = document.querySelector('#decoBar .deco-upload');
            upload.parentNode.insertBefore(decoBtn, upload);

            const chip = document.createElement('button');
            chip.className = 'pen-dot asset-chip';
            chip.title = '印章：' + asset.name;
            chip.appendChild(makeThumb(asset, 24));
            chip.addEventListener('click', () => {
                currentStamp = asset;
                document.querySelectorAll('.pen-dot').forEach(d => d.classList.remove('active'));
                chip.classList.add('active');
            });
            document.getElementById('stampChips').appendChild(chip);
            return { decoBtn, chip };
        }

        document.getElementById('assetInput').addEventListener('change', async (e) => {
            const files = [...e.target.files];
            e.target.value = '';  // 允许再次选择同一张
            let added = null, failed = 0;
            for (const file of files) {
                if (assets.length >= ASSET_MAX) break;
                try {
                    const canvas = await decodeImage(file);
                    const asset = { id: String(Date.now()) + assets.length, name: file.name || '我的图片', canvas: canvas, tex: null };
                    assets.push(asset);
                    added = { asset, ...addAssetButtons(asset) };
                } catch (err) {
                    console.error(err);
                    failed++;
                }
            }
            if (added) {
                // 刚传的那张直接选中：在画画里就是印章，否则当贴纸
                if (currentMode === 'CUP') added.chip.click();
                else setDecoType('asset:' + added.asset.id, added.decoBtn);
                setBubble(currentMode === 'CUP'
                    ? '图片已经变成印章啦，点一下杯子、冰淇淋或咖啡就能印上去~'
                    : '图片已经变成贴纸啦，点在冰淇淋或咖啡上就能贴上去~');
            }
            if (failed) setBubble('有 {n} 张图片打不开，换成 PNG 或 JPG 再试试~', { n: failed });
        });

        // 贴纸：一张透明背景也能用的薄片，带透明通道的 PNG 会是抠好的形状
        function buildAssetSticker(asset) {
            const g = new THREE.Group();
            if (!asset) return g;
            if (!asset.tex) {
                asset.tex = new THREE.CanvasTexture(asset.canvas);
                asset.tex.encoding = THREE.sRGBEncoding;
                asset.tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
            const aspect = asset.canvas.width / asset.canvas.height;
            let h = 0.8, w = h * aspect;
            if (w > 1.2) { w = 1.2; h = w / aspect; }
            const geo = new THREE.PlaneGeometry(w, h);
            geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({
                map: asset.tex,
                transparent: true,
                alphaTest: 0.05,
                roughness: 0.5,
                side: THREE.DoubleSide
            });
            const m = new THREE.Mesh(geo, mat);
            m.position.y = 0.01;
            g.add(m);
            return g;
        }

        // 让贴纸贴着命中的表面，并且图片"上方"朝远离镜头的方向，从镜头看是正的
        function orientSticker(g, hit) {
            const n = hit.face
                ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
                : new THREE.Vector3(0, 1, 0);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
            const away = hit.point.clone().sub(camera.position);
            away.addScaledVector(n, -away.dot(n));
            if (away.lengthSq() > 1e-6) {
                away.normalize();
                const top = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
                const angle = Math.atan2(top.clone().cross(away).dot(n), top.dot(away));
                q.premultiply(new THREE.Quaternion().setFromAxisAngle(n, angle));
            }
            g.quaternion.copy(q);
            g.position.copy(hit.point).addScaledVector(n, 0.02);
        }

        // 印章：把素材画进杯身 / 冰淇淋球 / 咖啡的画布。按真实尺寸换算像素，抵消各自贴图的拉伸
        function stampAsset(obj, uv, point) {
            const a = currentStamp;
            const aspect = a.canvas.width / a.canvas.height;
            const worldH = 0.3 + 1.0 * brushScale();   // 印出来的高度（世界单位），跟幅度走
            const worldW = worldH * aspect;
            let ctx, W, H, tex, x, y, drawW, drawH, rotate = 0, wrap = true;

            if (obj === cupBodyMesh) {
                if (pendingUndo && !pendingUndo.cup) pendingUndo.cup = cloneCanvas(cupCanvas);
                ctx = cupCtx; W = cupCanvas.width; H = cupCanvas.height; tex = cupTexture;
                x = uv.x * W; y = (1 - uv.y) * H;
                const r = Math.max(Math.hypot(point.x, point.z), 0.5);
                drawW = worldW * W / (2 * Math.PI * r);
                drawH = worldH * H / cupProfileLen;
            } else if (obj === liquidMesh) {
                snapshotLiquid();
                ctx = liquidCtx; W = liquidCanvas.width; H = liquidCanvas.height; tex = liquidTexture;
                const c = liquidCoordsFromHit(point);
                x = c.x; y = c.y;
                drawW = worldW * W / 3.9;
                drawH = worldH * H / 3.9;
                wrap = false;
            } else {
                const ud = obj.userData;
                if (pendingUndo && !pendingUndo.ballCanvases.has(obj)) pendingUndo.ballCanvases.set(obj, cloneCanvas(ud.canvas));
                ctx = ud.ctx; W = ud.canvas.width; H = ud.canvas.height; tex = ud.tex;
                x = uv.x * W; y = (1 - uv.y) * H;
                const sinT = Math.max(Math.sin((y / H) * Math.PI), 0.15);
                if (ud.paintable) {
                    // 小人身体：两极就在上下，图片不用转；大小按零件和整个模型的缩放算
                    const gs = ud.sculptRoot ? ud.sculptRoot.scale.x : 1;
                    drawW = worldW * W / (2 * Math.PI * obj.scale.x * gs * sinT);
                    drawH = worldH * H / (Math.PI * obj.scale.y * gs);
                } else {
                    // 球的两极转到了左右两侧：画布横向是世界的上下，纵向是世界的左右，所以图片要转 90°
                    const rb = SCOOP_R * obj.scale.x;
                    drawW = worldW * H / (Math.PI * rb);
                    drawH = worldH * W / (2 * Math.PI * rb * sinT);
                    rotate = Math.PI / 2;
                }
            }

            const extentX = rotate ? drawH / 2 : drawW / 2;
            for (const ox of wrap ? [0, -W, W] : [0]) {
                if (ox !== 0 && (x + ox + extentX < 0 || x + ox - extentX > W)) continue;
                ctx.save();
                ctx.translate(x + ox, y);
                ctx.rotate(rotate);
                ctx.drawImage(a.canvas, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
            }
            tex.needsUpdate = true;
        }

        function placeDecoration(hit) {
            if (!hit.object) return;
            const g = buildDecoration(currentDeco);
            const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
            const lift = hit.object === liquidMesh ? 0.03 : 0.02;
            g.position.copy(hit.point).addScaledVector(n, lift);
            g.rotation.y = Math.random() * Math.PI * 2;
            if (currentDeco.startsWith('asset:')) orientSticker(g, hit);
            scene.add(g);
            decos.push(g);
            actionDirty = true;
        }

        // 复制一张画布，用来保存某一时刻的样子
        function cloneCanvas(src) {
            const c = document.createElement('canvas');
            c.width = src.width;
            c.height = src.height;
            c.getContext('2d').drawImage(src, 0, 0);
            return c;
        }

        // 记录当前全部内容：冰淇淋球（位置和形状）、装饰、液面画布、杯身画布
        function captureState() {
            return {
                scoops: scoops.slice(),
                scoopPos: scoops.map(m => m.position.clone()),
                scoopGeo: scoops.map(m => m.geometry.attributes.position.array.slice()),
                decos: decos.slice(),
                sculpts: sculpts.slice(),
                sculptPos: sculpts.map(g => g.position.clone()),
                liquid: null,             // 改动液面前才保存
                cup: null,                // 画杯子前才保存
                ballCanvases: new Map(),  // 画过的球才会存进来
                sculptGeo: new Map()      // 揉过的模型零件才会存进来
            };
        }

        function restoreState(s) {
            for (const m of scoops) if (!s.scoops.includes(m)) scene.remove(m);
            for (const g of decos) if (!s.decos.includes(g)) scene.remove(g);
            const keepSculpts = s.sculpts || [];
            for (const g of sculpts) if (!keepSculpts.includes(g)) scene.remove(g);
            for (const m of s.scoops) if (!scoops.includes(m)) scene.add(m);
            for (const g of s.decos) if (!decos.includes(g)) scene.add(g);
            for (const g of keepSculpts) if (!sculpts.includes(g)) scene.add(g);
            keepSculpts.forEach((g, i) => { if (s.sculptPos && s.sculptPos[i]) g.position.copy(s.sculptPos[i]); });
            sculpts.length = 0;
            sculpts.push(...keepSculpts);

            scoops.length = 0;
            scoops.push(...s.scoops);
            decos.length = 0;
            decos.push(...s.decos);

            s.scoops.forEach((m, i) => {
                m.position.copy(s.scoopPos[i]);
                const attr = m.geometry.attributes.position;
                attr.array.set(s.scoopGeo[i]);
                attr.needsUpdate = true;
                computeWeldedNormals(m.geometry);
                m.geometry.computeBoundingSphere();
            });

            if (s.liquid) {
                liquidCtx.clearRect(0, 0, liquidCanvas.width, liquidCanvas.height);
                liquidCtx.drawImage(s.liquid, 0, 0);
                liquidTexture.needsUpdate = true;
            }
            if (s.cup) {
                cupCtx.clearRect(0, 0, cupCanvas.width, cupCanvas.height);
                cupCtx.drawImage(s.cup, 0, 0);
                cupTexture.needsUpdate = true;
            }

            for (const [m, c] of s.ballCanvases) {
                m.userData.ctx.clearRect(0, 0, c.width, c.height);
                m.userData.ctx.drawImage(c, 0, 0);
                m.userData.tex.needsUpdate = true;
            }

            if (s.sculptGeo) {
                for (const [m, arr] of s.sculptGeo) {
                    m.geometry.attributes.position.array.set(arr);
                    finishClayEdit(m);
                }
            }

            grabbedScoop = null;
        }

        // 本次操作第一次改液面时，先存一份液面画布
        function snapshotLiquid() {
            if (pendingUndo && !pendingUndo.liquid) pendingUndo.liquid = cloneCanvas(liquidCanvas);
        }

        function pushUndo(state) {
            undoStack.push(state);
            if (undoStack.length > UNDO_MAX) undoStack.shift();
        }

        function undo() {
            const s = undoStack.pop();
            if (!s) {
                setBubble('现在没有可以撤回的步骤啦~');
                return;
            }
            restoreState(s);
        }

        function resetCup() {
            const state = captureState();
            state.liquid = cloneCanvas(liquidCanvas);
            state.cup = cloneCanvas(cupCanvas);
            pushUndo(state);

            for (const m of scoops) scene.remove(m);
            scoops.length = 0;
            for (const d of decos) scene.remove(d);
            decos.length = 0;
            for (const g of sculpts) scene.remove(g);
            sculpts.length = 0;
            activeSculpt = null;
            drawFreshCremaBase();
            liquidTexture.needsUpdate = true;

            cupCtx.fillStyle = '#ffffff';
            cupCtx.fillRect(0, 0, cupCanvas.width, cupCanvas.height);
            cupTexture.needsUpdate = true;
            setBubble('杯子已经清空啦，可以点"撤回"找回刚才的内容~ 🍨');
        }

        // ================= 10. 全局触控拖拽交互 =================
        const raycaster = new THREE.Raycaster();
        const pointerNDC = new THREE.Vector2();
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        function setupPointerEvents() {
            const box = document.getElementById('webgl-box');

            function getCoords(cx, cy) {
                const rect = renderer.domElement.getBoundingClientRect();
                pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1;
                pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1;
            }

            function touchCentroid(e) {
                const a = e.touches[0], b = e.touches[1];
                return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
            }

            function touchDist(e) {
                const a = e.touches[0], b = e.touches[1];
                return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            }

            function handleStart(e) {
                // 第二根手指放下：取消当前操作，进入缩放
                if (e.touches && e.touches.length >= 2) {
                    if (pendingUndo && actionDirty) pushUndo(pendingUndo);
                    pendingUndo = null;
                    if (grabbedScoop) {
                        grabbedScoop.position.y = grabbedScoop.userData.baseY;
                        grabbedScoop = null;
                    }
                    isInteracting = false;
                    milkStreamMesh.visible = false;
                    pinchStartDist = touchDist(e);
                    pinchStartRadius = camRadius;
                    lastCentroid = touchCentroid(e);
                    if (e.cancelable) e.preventDefault();
                    return;
                }
                // 鼠标右键：任何模式下都能转视角；中键或 Shift+左键：平移
                if (!e.touches && (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey))) {
                    orbitDrag = e.button === 2;
                    panDrag = !orbitDrag;
                    lastPointerPos = { x: e.clientX, y: e.clientY };
                    e.preventDefault();
                    return;
                }
                if (e.touches && e.cancelable) e.preventDefault();
                isInteracting = true;
                actionStartTime = performance.now();
                pendingUndo = currentMode === 'ORBIT' ? null : captureState();
                lastPaintObj = null;
                stampedThisStroke = false;
                actionDirty = false;
                lastCanvasPos = null;
                penPts = [];

                const pt = e.touches ? e.touches[0] : e;
                lastPointerPos = { x: pt.clientX, y: pt.clientY };
                getCoords(pt.clientX, pt.clientY);
                raycastScene();
                lastHitPoint = currentHitPoint ? currentHitPoint.clone() : null;
                sculptEditing = false;
                spinSculpt = null;
                // 转视角模式下拖动贴好的模型也要能撤回
                if (currentMode === 'ORBIT' && currentHitObject && currentHitObject.userData.sculptRoot) pendingUndo = captureState();

                // 放冰淇淋：点一下放一颗，不跟随拖拽
                if (currentMode === 'ADD' && currentHitPoint) {
                    placeScoop({ point: currentHitPoint, object: currentHitObject });
                    isInteracting = false;
                }
                // 捏起来（挪动）：按住冰淇淋球就能拿起来
                if (currentMode === 'PINCH' && pinchMode === 'move' && currentHitObject && scoops.includes(currentHitObject)) {
                    grabbedScoop = currentHitObject;
                }
                // 雕琢台 · 上色模式：点中身体贴图就直接画色块，不触发拖动
                if (currentMode === 'SCULPT' && sculptSlot === 'paint' && currentHitObject && currentHitObject.userData.paintable) {
                    lastPaintObj = null;
                    sculptEditing = true;
                    paintSculptBody(currentHitObject, currentHitUV);
                }
                // 雕琢台 · 揉捏：按住模型揉，不拖动、不转视角
                else if (currentMode === 'SCULPT' && sculptSlot === 'clay' && isSculptMesh(currentHitObject)) {
                    sculptEditing = true;
                    selectSculpt(currentHitObject.userData.sculptRoot);
                    if (sculptTool === 'push') startSculptGrab(currentHitObject, currentHitPoint);
                }
                else if (currentHitObject && currentHitObject.userData.sculptRoot) {
                    const g = currentHitObject.userData.sculptRoot;
                    if (currentMode === 'SCULPT' && g === benchFigure) {
                        // 转台上的模型：左右拖动就像转转台，模型不会被拖得跑来跑去
                        spinSculpt = g;
                        selectSculpt(g);
                    } else if ((currentMode === 'ORBIT' || currentMode === 'SCULPT') && (g === activeSculpt || currentMode === 'SCULPT')) {
                        // 贴好的模型：按住拖着走（转视角时先点一下选中，再拖才移动）
                        grabbedSculpt = g;
                        selectSculpt(g);
                    } else {
                        selectSculpt(g);
                    }
                }
                // 小装饰：点一下放上去
                if (currentMode === 'DECO' && currentHitPoint) {
                    placeDecoration({ point: currentHitPoint, object: currentHitObject, face: currentHitFace });
                    isInteracting = false;
                }
                // 橡皮泥（推）：按住冰淇淋球，记下抓住的那一块
                if (currentMode === 'CLAY' && clayMode === 'push' && currentHitObject && scoops.includes(currentHitObject)) {
                    startClayGrab(currentHitObject, currentHitPoint);
                } else if (currentMode === 'CLAY' && clayMode === 'push' && isSculptMesh(currentHitObject)) {
                    startSculptGrab(currentHitObject, currentHitPoint);
                }
                // 画画 / 彩笔：按下就落第一笔
                if (currentMode === 'CUP' || currentMode === 'ETCH') updateContinuousInteraction();
            }

            function handleMove(e) {
                if (e.touches && e.touches.length >= 2 && pinchStartDist > 0) {
                    const d = touchDist(e);
                    if (d > 0) {
                        camTween = null;
                        camRadius = THREE.MathUtils.clamp(pinchStartRadius * pinchStartDist / d, CAM_MIN, camMax());
                    }
                    // 双指一起拖动：转视角
                    const c = touchCentroid(e);
                    if (lastCentroid) orbitBy(c.x - lastCentroid.x, c.y - lastCentroid.y);
                    lastCentroid = c;
                    updateCameraPosition();
                    if (e.cancelable) e.preventDefault();
                    return;
                }
                const pt = e.touches ? e.touches[0] : e;
                const deltaX = pt.clientX - lastPointerPos.x;
                const deltaY = pt.clientY - lastPointerPos.y;
                lastPointerPos = { x: pt.clientX, y: pt.clientY };

                if (spinSculpt) {
                    spinSculpt.rotation.y += deltaX * 0.012;
                    syncSculptSliders();
                } else if (grabbedSculpt) {
                    getCoords(pt.clientX, pt.clientY);
                    raycaster.setFromCamera(pointerNDC, camera);
                    dragPlane.normal.set(0, 1, 0);
                    dragPlane.constant = -grabbedSculpt.position.y;
                    const moved = raycaster.ray.intersectPlane(dragPlane, groundHit);
                    if (moved) {
                        grabbedSculpt.position.x = moved.x;
                        grabbedSculpt.position.z = moved.z;
                        actionDirty = true;
                    }
                } else if (currentMode === 'SCULPT' && sculptEditing && isInteracting) {
                    getCoords(pt.clientX, pt.clientY);
                    raycastScene();
                    if (sculptSlot === 'paint' && currentHitObject && currentHitObject.userData.paintable && currentHitUV) {
                        paintSculptBody(currentHitObject, currentHitUV);
                    }
                } else if (orbitDrag || ((currentMode === 'ORBIT' || currentMode === 'SCULPT') && isInteracting)) {
                    orbitBy(deltaX, deltaY);
                } else if (panDrag) {
                    panBy(deltaX, deltaY);
                } else {
                    getCoords(pt.clientX, pt.clientY);
                    raycastScene();
                    // 画画 / 彩笔：每个移动事件都画，不只每帧画一次
                    if (currentMode === 'CUP' || currentMode === 'ETCH') updateContinuousInteraction();
                }

                if (e.touches && e.cancelable && e.target instanceof Node && box.contains(e.target)) e.preventDefault();
            }

            function handleEnd() {
                isInteracting = false;
                pinchStartDist = 0;
                clayGrab = null;
                orbitDrag = false;
                panDrag = false;
                lastCentroid = null;
                if (pendingUndo) {
                    if (actionDirty) pushUndo(pendingUndo);
                    pendingUndo = null;
                }
                if (grabbedScoop) {
                    grabbedScoop.position.y = grabbedScoop.userData.baseY;
                    grabbedScoop = null;
                }
                grabbedSculpt = null;
                spinSculpt = null;
                sculptEditing = false;
                lastCanvasPos = null;
                lastHitPoint = null;
                milkStreamMesh.visible = false;
                pitcherMesh.rotation.x = 0.35;
            }

            box.addEventListener('wheel', (e) => {
                e.preventDefault();
                zoomBy(1 + THREE.MathUtils.clamp(e.deltaY, -100, 100) * 0.0015);
            }, { passive: false });

            box.addEventListener('contextmenu', (e) => e.preventDefault());
            box.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);

            box.addEventListener('touchstart', handleStart, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleEnd);
            window.addEventListener('touchcancel', handleEnd);
        }

        function raycastScene() {
            raycaster.setFromCamera(pointerNDC, camera);

            // 优先检测冰淇淋球与咖啡液面
            const sculptMeshes = [];
            for (const g of sculpts) if (g.userData.meshes) sculptMeshes.push(...g.userData.meshes);
            if (benchFigure && benchFigure.visible && benchFigure.userData.meshes) sculptMeshes.push(...benchFigure.userData.meshes);
            const targets = [...scoops, liquidMesh, cupBodyMesh, saucerMesh, tableMesh, ...sculptMeshes];
            const hits = raycaster.intersectObjects(targets);

            if (hits.length > 0) {
                currentHitPoint = hits[0].point;
                currentHitObject = hits[0].object;
                currentHitUV = hits[0].uv || null;
                currentHitFace = hits[0].face || null;

                if (currentMode === 'PITCHER') {
                    pitcherGroup.position.set(currentHitPoint.x, currentHitPoint.y + 1.6, currentHitPoint.z + 0.35);
                } else if (currentMode === 'FLATTEN' || currentMode === 'SPOON') {
                    stirSpoonGroup.position.set(currentHitPoint.x, currentHitPoint.y, currentHitPoint.z);
                } else if (currentMode === 'ETCH') {
                    penGroup.position.copy(currentHitPoint);
                }
            } else {
                currentHitPoint = null;
                currentHitObject = null;
                currentHitUV = null;
                currentHitFace = null;
            }
        }

        // ================= 11. 魔法与结算 =================
        function castSpell() {
            milkStreamMesh.visible = false;
            pitcherGroup.visible = false;
            stirSpoonGroup.visible = false;
            penGroup.visible = false;
            setLocalizedText(document.getElementById('modePill'), "✨ 变得香甜美味吧~ 萌萌啾！💖");

            for (let i = 0; i < 24; i++) {
                setTimeout(() => {
                    const sp = document.createElement('div');
                    sp.className = 'sparkle-heart';
                    sp.innerText = ['🍨', '☕', '💖', '✨', '🐾'][Math.floor(Math.random() * 5)];
                    sp.style.left = (Math.random() * (window.innerWidth - 60) + 30) + 'px';
                    sp.style.top = (window.innerHeight * 0.5 + (Math.random() * 80 - 40)) + 'px';
                    document.body.appendChild(sp);
                    setTimeout(() => sp.remove(), 1200);
                }, i * 65);
            }

            setCamPreset('SIDE');

            setTimeout(() => {
                setBubble("主人亲手放上的冰淇淋球和拉花太诱人啦！请尽情享用这份甜蜜吧~ 🍨💕");
            }, 1600);
        }

        function toggleBubble() {
            const b = document.getElementById('maidBubble');
            b.style.display = b.style.display === 'block' ? 'none' : 'block';
        }

        // 适配：底部工具坞会盖住画布下沿，把画面整体上移一点，让杯子落在可视区中间
        function applyStageFraming() {
            if (!camera || !renderer) return;
            const box = document.getElementById('webgl-box');
            const w = box.clientWidth, h = box.clientHeight;
            if (!w || !h) return;
            const dock = document.querySelector('.bottom-dock');
            const nav = document.querySelector('.top-nav');
            const dockH = dock ? dock.offsetHeight : 0;
            const navH = nav ? nav.offsetHeight : 0;
            // 雕琢台面板打开时，它也是遮挡画面的“底部”，取景按它计算
            let bottomBlock = dockH;
            const sheet = document.getElementById('sculptSheet');
            if (sheet && sheet.classList.contains('open')) {
                const sr = sheet.getBoundingClientRect();
                const br = box.getBoundingClientRect();
                bottomBlock = Math.max(bottomBlock, Math.round(br.bottom - sr.top));
            }
            const shift = Math.round(Math.max(0, (bottomBlock - navH) * 0.5));
            if (shift > 0) camera.setViewOffset(w, h, 0, shift, w, h);
            else camera.clearViewOffset();
            // 可视区太矮时（横屏手机、小窗口）整体缩小模型，保证杯子和冰淇淋都在工具坞上方
            const freeH = Math.max(120, h - dockH - navH);
            const freeFrac = freeH / h;
            camera.zoom = Math.max(0.45, Math.min(1, Math.pow(Math.min(1, freeFrac / 0.62), 0.9)));
            camera.updateProjectionMatrix();
        }
        window.applyStageFraming = applyStageFraming;

        function onResize() {
            if (window.fitModePill) requestAnimationFrame(window.fitModePill);
            // 雕琢台里自己转过 / 缩放过镜头，就不因为窗口变化（比如手机地址栏收起）把镜头拉回去
            // 窗口大小常常连着变好几次，停下来再取景
            if (currentMode === 'SCULPT' && !camUserMoved && window.fitSculptCamera) {
                clearTimeout(onResize.fitTimer);
                onResize.fitTimer = setTimeout(() => { if (!camUserMoved) window.fitSculptCamera(); }, 200);
            }
            const box = document.getElementById('webgl-box');
            camera.aspect = box.clientWidth / box.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(box.clientWidth, box.clientHeight);
            applyStageFraming();
            updateCameraPosition();
        }

        function animate() {
            requestAnimationFrame(animate);
            stepCamTween();
            if (currentMode !== 'ORBIT') {
                updateContinuousInteraction();
            }
            applyToolPose();
            renderer.render(scene, camera);
        }

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            }
        });

        function start() {
            try {
                init();
            } catch (err) {
                console.error(err);
                const b = document.getElementById('maidBubble');
                setLocalizedText(b, '这台设备暂时显示不了 3D 画面（WebGL 不可用），换个浏览器或设备再试试吧~');
                b.style.display = 'block';
            }
        }

        // ================= 小工具适配：事件与样式绑定（不用内联事件，严格安全策略下也能点） =================
        (function bindDeclarativeHandlers() {
            function parseCall(code) {
                const m = code.trim().match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
                if (!m) throw new Error('无法识别的事件写法：' + code);
                const args = m[2].trim() === '' ? [] : m[2].split(',').map(a => a.trim());
                return { fn: m[1], args: args };
            }

            function argValue(raw, el) {
                if (raw === 'this') return el;
                if (raw === 'this.value') return el.value;
                const q = raw.match(/^'(.*)'$/) || raw.match(/^"(.*)"$/);
                if (q) return q[1];
                if (!isNaN(Number(raw))) return Number(raw);
                throw new Error('无法识别的参数：' + raw);
            }

            ['click', 'input'].forEach(type => {
                document.querySelectorAll('[data-on' + type + ']').forEach(el => {
                    const call = parseCall(el.getAttribute('data-on' + type));
                    el.addEventListener(type, (e) => {
                        const fn = window[call.fn];
                        if (typeof fn !== 'function') {
                            console.error('找不到函数：' + call.fn);
                            return;
                        }
                        fn.apply(el, call.args.map(a => argValue(a, el)));
                    });
                });
            });

            // 内联样式改由脚本设置（CSSOM 不受 style-src 限制）
            document.querySelectorAll('[data-style]').forEach(el => {
                el.style.cssText = el.getAttribute('data-style');
            });
        })();

        // ================= 12. 冰淇淋雕琢台 =================
        // 桌上浮起一个小转台，用零件拼一个 3D 小人出来，再贴到冰淇淋上；
        // 贴上去之后可以拖动位置、改大小和朝向，也能撤回。
        const sculpts = [];              // 已经贴到场景里的模型
        let benchFigure = null;          // 转台上正在雕的模型
        let benchPlatform = null;        // 转台圆盘
        let grabbedSculpt = null;        // 正在拖动的模型
        let modeBeforeSculpt = 'ORBIT';  // 进雕琢台前的工具模式
        let activeSculpt = null;         // 滑条作用的模型
        let sculptPrevCam = null;        // 进入雕琢台前的机位
        let camLookLift = 0;             // 视线抬升量
        let sculptEditing = false;       // 这一下是在给模型上色 / 揉捏
        let spinSculpt = null;           // 正在用手指转的转台模型
        let sculptTool = 'push';         // 揉捏工具
        // 转台和杯子并排放在桌面上（杯把在右边，转台放左边）。
        // 宽屏放正左边；手机竖屏横向放不下，挪到左前方，杯子不会被缩得很小
        const BENCH_SPOTS = { side: { x: -4.75, z: 0.6 }, front: { x: -2.55, z: 4.25 } };
        const benchPos = { x: BENCH_SPOTS.side.x, z: BENCH_SPOTS.side.z };
        const BENCH_Y = 0;
        const BENCH_R = 0.95;
        const BENCH_TOP = 0.2;           // 转台台面高度，模型站在上面

        const SCULPT_GEO = {
            sphere: new THREE.SphereGeometry(1, 32, 22),
            cone: new THREE.ConeGeometry(1, 1, 18),
            cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
            arc: new THREE.TorusGeometry(1, 0.32, 8, 20, Math.PI),   // 半环：笑眼 / 微笑
            octa: new THREE.OctahedronGeometry(1, 0)                 // 星星眼
        };
        const SCULPT_TONES = {
            fur: null, dark: '#3b1d0e', white: '#fffaf3', pink: '#ff9ebb', gold: '#f4c14b',
            hair: '#4a2b18', hair2: '#6d4225', cherry: '#c0392b', green2: '#4a8f52'
        };

        function sculptMaterial(color) {
            return new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(color),
                roughness: 0.4,
                metalness: 0,
                clearcoat: 0.35,
                clearcoatRoughness: 0.45
            });
        }

        function sculptPart(parent, geo, color, p, s, r, tag, side) {
            let material;
            // 身体/头部打了 'paint' 标签：给它一张画布贴图，之后可以直接在上面画色块
            if (tag === 'paint') {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 160;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const tex = new THREE.CanvasTexture(canvas);
                tex.encoding = THREE.sRGBEncoding;
                material = new THREE.MeshPhysicalMaterial({
                    map: tex, color: 0xffffff, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.45
                });
                material.userData = { canvas, ctx, tex };
            } else {
                material = sculptMaterial(color);
            }
            // 每块零件用自己的一份网格，之后才能单独揉捏
            const own = (SCULPT_GEO[geo] || SCULPT_GEO.sphere).clone();
            own.userData = {};
            const m = new THREE.Mesh(own, material);
            m.position.set(p[0], p[1], p[2]);
            m.scale.set(s[0], s[1], s[2]);
            if (r) m.rotation.set(r[0], r[1], r[2]);
            m.castShadow = true;
            m.receiveShadow = true;
            if (tag === 'paint') {
                m.userData.paintable = true;
                m.userData.canvas = material.userData.canvas;
                m.userData.ctx = material.userData.ctx;
                m.userData.tex = material.userData.tex;
            } else if (tag) {
                m.userData.tag = tag;
                m.userData.side = side || 1;
                m.userData.home = {
                    pos: m.position.clone(),
                    rot: m.rotation.clone()
                };
            }
            parent.add(m);
            return m;
        }

        // 四种角色身体：坐标以脚底 y=0 为基准，整体约 1.3 个单位高。
        // 只拼“骨架”（身体、头、耳朵、手、脚），五官和头发由下面按槽位叠上去，
        // 所以换眼睛 / 嘴巴 / 发型 / 手势都不用重做模型，像贴纸一样换就行。
        const SCULPT_BASES = {
            cat: {
                head: { x: 0, y: 0.90, z: 0.04, r: 0.29 },
                parts: [
                    ['sphere', 'fur', [0, 0.40, 0], [0.36, 0.38, 0.32], null, 'paint'],
                    ['sphere', 'fur', [0, 0.90, 0.04], [0.31, 0.29, 0.29]],
                    ['cone', 'fur', [-0.19, 1.14, 0.02], [0.10, 0.22, 0.10], [0, 0, -0.18]],
                    ['cone', 'fur', [0.19, 1.14, 0.02], [0.10, 0.22, 0.10], [0, 0, 0.18]],
                    ['sphere', 'fur', [-0.34, 0.44, 0.08], [0.12, 0.17, 0.12], null, 'arm', -1],
                    ['sphere', 'fur', [0.34, 0.44, 0.08], [0.12, 0.17, 0.12], null, 'arm', 1],
                    ['sphere', 'fur', [-0.19, 0.09, 0.16], [0.11, 0.07, 0.13]],
                    ['sphere', 'fur', [0.19, 0.09, 0.16], [0.11, 0.07, 0.13]],
                    ['sphere', 'fur', [0.30, 0.34, -0.20], [0.05, 0.16, 0.05], [0.7, 0, 0.5]]
                ]
            },
            bear: {
                head: { x: 0, y: 0.98, z: 0.03, r: 0.30 },
                muzzle: { y: 0.91, z: 0.37, r: 0.15 },
                parts: [
                    ['sphere', 'fur', [0, 0.44, 0], [0.40, 0.42, 0.35], null, 'paint'],
                    ['sphere', 'fur', [0, 0.98, 0.03], [0.32, 0.30, 0.30]],
                    ['sphere', 'fur', [-0.24, 1.20, 0], [0.11, 0.11, 0.08]],
                    ['sphere', 'fur', [0.24, 1.20, 0], [0.11, 0.11, 0.08]],
                    ['sphere', 'white', [0, 0.91, 0.29], [0.16, 0.12, 0.12]],
                    ['sphere', 'fur', [-0.36, 0.54, 0.10], [0.13, 0.20, 0.13], null, 'arm', -1],
                    ['sphere', 'fur', [0.36, 0.54, 0.10], [0.13, 0.20, 0.13], null, 'arm', 1],
                    ['sphere', 'fur', [-0.19, 0.10, 0.14], [0.14, 0.09, 0.16]],
                    ['sphere', 'fur', [0.19, 0.10, 0.14], [0.14, 0.09, 0.16]]
                ]
            },
            person: {
                head: { x: 0, y: 1.06, z: 0, r: 0.19 },
                parts: [
                    ['cyl', 'fur', [-0.10, 0.24, 0], [0.06, 0.44, 0.06]],
                    ['cyl', 'fur', [0.10, 0.24, 0], [0.06, 0.44, 0.06]],
                    ['sphere', 'fur', [0, 0.66, 0], [0.19, 0.26, 0.15], null, 'paint'],
                    ['cyl', 'fur', [-0.23, 0.70, 0], [0.045, 0.32, 0.045], [0, 0, 0.35], 'arm', -1],
                    ['cyl', 'fur', [0.23, 0.70, 0], [0.045, 0.32, 0.045], [0, 0, -0.35], 'arm', 1],
                    ['sphere', 'white', [0, 1.06, 0], [0.19, 0.20, 0.18]]
                ]
            },
            bunny: {
                head: { x: 0, y: 0.86, z: 0.03, r: 0.25 },
                parts: [
                    ['sphere', 'fur', [0, 0.42, 0], [0.30, 0.36, 0.28], null, 'paint'],
                    ['sphere', 'fur', [0, 0.86, 0.03], [0.26, 0.25, 0.24]],
                    ['cyl', 'fur', [-0.11, 1.28, 0.02], [0.07, 0.34, 0.05], [0, 0, 0.12]],
                    ['cyl', 'fur', [0.11, 1.28, 0.02], [0.07, 0.34, 0.05], [0, 0, -0.12]],
                    ['sphere', 'fur', [-0.28, 0.44, 0.08], [0.10, 0.14, 0.10], null, 'arm', -1],
                    ['sphere', 'fur', [0.28, 0.44, 0.08], [0.10, 0.14, 0.10], null, 'arm', 1],
                    ['sphere', 'white', [0, 0.36, -0.26], [0.08, 0.08, 0.08]]
                ]
            },
            penguin: {
                head: { x: 0, y: 0.92, z: 0.04, r: 0.27 },
                parts: [
                    ['sphere', 'dark', [0, 0.42, 0], [0.33, 0.40, 0.30], null, 'paint'],
                    ['sphere', 'white', [0, 0.40, 0.14], [0.24, 0.32, 0.18]],
                    ['sphere', 'dark', [0, 0.92, 0.04], [0.28, 0.27, 0.27]],
                    ['sphere', 'white', [0, 0.90, 0.17], [0.20, 0.19, 0.12]],
                    ['cone', 'gold', [0, 0.84, 0.30], [0.08, 0.14, 0.08], [Math.PI / 2 + 0.2, 0, 0]],
                    ['cone', 'dark', [-0.28, 0.46, 0.04], [0.09, 0.26, 0.14], [0, 0, 0.5], 'arm', -1],
                    ['cone', 'dark', [0.28, 0.46, 0.04], [0.09, 0.26, 0.14], [0, 0, -0.5], 'arm', 1],
                    ['sphere', 'gold', [-0.14, 0.06, 0.12], [0.1, 0.05, 0.14]],
                    ['sphere', 'gold', [0.14, 0.06, 0.12], [0.1, 0.05, 0.14]]
                ]
            },
            dino: {
                head: { x: 0, y: 0.84, z: 0.06, r: 0.26 },
                muzzle: { y: 0.80, z: 0.33, r: 0.14 },
                parts: [
                    ['sphere', 'fur', [0, 0.40, 0], [0.34, 0.38, 0.34], null, 'paint'],
                    ['sphere', 'fur', [0, 0.84, 0.06], [0.28, 0.26, 0.30]],
                    ['cone', 'green2', [-0.1, 1.16, -0.1], [0.07, 0.2, 0.07]],
                    ['cone', 'green2', [0.08, 1.2, -0.02], [0.06, 0.16, 0.06]],
                    ['cone', 'green2', [0.16, 1.1, 0.12], [0.05, 0.12, 0.05]],
                    ['sphere', 'fur', [-0.30, 0.42, 0.10], [0.10, 0.15, 0.10], null, 'arm', -1],
                    ['sphere', 'fur', [0.30, 0.42, 0.10], [0.10, 0.15, 0.10], null, 'arm', 1],
                    ['sphere', 'fur', [-0.16, 0.08, 0.16], [0.11, 0.07, 0.15]],
                    ['sphere', 'fur', [0.16, 0.08, 0.16], [0.11, 0.07, 0.15]],
                    ['cyl', 'fur', [0, 0.30, -0.42], [0.08, 0.32, 0.08], [1.3, 0, 0]]
                ]
            }
        };

        // 默认长相：像拼贴一样，每个槽位先给一个选项，点一下就换
        const DEFAULT_LOOK = { base: 'cat', eyes: 'dot', mouth: 'smile', hair: 'none', arms: 'down', acc: 'none' };

        function buildFigureFromLook(look, furColor) {
            const cfg = Object.assign({}, DEFAULT_LOOK, look || {});
            const base = SCULPT_BASES[cfg.base] || SCULPT_BASES.cat;
            const g = new THREE.Group();
            const arms = [];
            for (const part of base.parts) {
                const [geo, tone, p, sc, rot, tag, side] = part;
                const color = tone === 'fur' ? furColor : SCULPT_TONES[tone];
                const m = sculptPart(g, geo, color, p, sc, rot, tag, side);
                if (tag === 'arm') arms.push(m);
            }
            buildEyes(g, base, cfg.eyes);
            buildMouth(g, base, cfg.mouth);
            buildHair(g, base, cfg.hair);
            buildAcc(g, base, cfg.acc);
            applyArmPose(arms, base.head, cfg.arms);
            g.userData.look = cfg;
            g.userData.base = cfg.base;
            return g;
        }

        // ---- 配饰：眼镜 / 蝴蝶结 / 围巾 / 爱心手持，叠在拼好的角色上 ----
        function buildAcc(g, base, kind) {
            if (!kind || kind === 'none') return;
            const h = base.head, r = h.r;
            if (kind === 'glasses') {
                const dark = SCULPT_TONES.dark;
                const z = h.z + r * 0.92, y = h.y + r * 0.08, x = r * 0.40;
                sculptPart(g, 'cyl', dark, [-x, y, z], [r * 0.30, r * 0.30, r * 0.05], [Math.PI / 2, 0, 0]);
                sculptPart(g, 'cyl', dark, [x, y, z], [r * 0.30, r * 0.30, r * 0.05], [Math.PI / 2, 0, 0]);
                sculptPart(g, 'cyl', dark, [0, y, z - r * 0.05], [r * 0.06, r * 0.42, r * 0.06], [0, 0, Math.PI / 2]);
            } else if (kind === 'bow') {
                const pink = SCULPT_TONES.pink;
                const y = h.y + r * 1.0, z = h.z;
                sculptPart(g, 'cone', pink, [-r * 0.22, y, z], [r * 0.22, r * 0.16, r * 0.22], [0, 0, Math.PI / 2]);
                sculptPart(g, 'cone', pink, [r * 0.22, y, z], [r * 0.22, r * 0.16, r * 0.22], [0, 0, -Math.PI / 2]);
                sculptPart(g, 'sphere', pink, [0, y, z], [r * 0.12, r * 0.12, r * 0.12]);
            } else if (kind === 'scarf') {
                const cherry = SCULPT_TONES.cherry;
                const neckY = h.y - r * 1.05;
                sculptPart(g, 'cyl', cherry, [h.x, neckY, h.z], [r * 1.05, r * 0.26, r * 1.05]);
                sculptPart(g, 'cyl', cherry, [h.x, neckY - r * 0.55, h.z + r * 0.55], [r * 0.20, r * 0.6, r * 0.14]);
            } else if (kind === 'heart') {
                const pink = SCULPT_TONES.pink;
                const side = -1;
                const x = side * r * 0.95, y = h.y - r * 1.0, z = h.z + r * 0.3;
                sculptPart(g, 'sphere', pink, [x - r * 0.12, y + r * 0.1, z], [r * 0.2, r * 0.2, r * 0.16]);
                sculptPart(g, 'sphere', pink, [x + r * 0.12, y + r * 0.1, z], [r * 0.2, r * 0.2, r * 0.16]);
                sculptPart(g, 'cone', pink, [x, y - r * 0.1, z], [r * 0.3, r * 0.3, r * 0.16], [Math.PI, 0, 0]);
            }
        }


        // ---- 眼睛：位置按头的大小算，换角色也不会错位 ----
        function buildEyes(g, base, kind) {
            const h = base.head, r = h.r;
            const y = h.y + r * 0.10;
            const z = h.z + r * 0.94;
            const x = r * 0.40;
            const s = r * 0.20;
            const dark = SCULPT_TONES.dark;

            const one = (cx, type) => {
                if (type === 'happy') {
                    sculptPart(g, 'arc', dark, [cx, y, z], [s * 1.0, s * 1.0, s * 0.5]);
                } else if (type === 'closed') {
                    sculptPart(g, 'sphere', dark, [cx, y, z], [s * 1.15, s * 0.26, s * 0.4]);
                } else if (type === 'star') {
                    sculptPart(g, 'octa', dark, [cx, y, z], [s * 0.95, s * 1.25, s * 0.45]);
                } else if (type === 'heart') {
                    sculptPart(g, 'sphere', SCULPT_TONES.pink, [cx - s * 0.36, y + s * 0.16, z], [s * 0.55, s * 0.55, s * 0.4]);
                    sculptPart(g, 'sphere', SCULPT_TONES.pink, [cx + s * 0.36, y + s * 0.16, z], [s * 0.55, s * 0.55, s * 0.4]);
                    sculptPart(g, 'cone', SCULPT_TONES.pink, [cx, y - s * 0.38, z], [s * 0.92, s * 0.9, s * 0.4], [Math.PI, 0, 0]);
                } else {
                    sculptPart(g, 'sphere', dark, [cx, y, z], [s * 0.78, s * 1.15, s * 0.45]);
                }
            };

            if (kind === 'none') return;
            if (kind === 'wink') {
                one(-x, 'dot');
                one(x, 'happy');
                return;
            }
            one(-x, kind);
            one(x, kind);
        }

        // ---- 嘴巴：⌣ 微笑 / ω 猫嘴 / ○ 惊讶 / 吐舌 ----
        function buildMouth(g, base, kind) {
            if (kind === 'none') return;
            const h = base.head, r = h.r;
            const mz = base.muzzle ? base.muzzle.z : h.z + r * 0.92;
            const my = base.muzzle ? base.muzzle.y : h.y - r * 0.30;
            const s = r * 0.22;
            const dark = SCULPT_TONES.dark;
            if (kind === 'cat') {
                sculptPart(g, 'arc', dark, [-s * 0.55, my + s * 0.18, mz], [s * 0.78, s * 0.68, s * 0.5], [0, 0, Math.PI]);
                sculptPart(g, 'arc', dark, [s * 0.55, my + s * 0.18, mz], [s * 0.78, s * 0.68, s * 0.5], [0, 0, Math.PI]);
            } else if (kind === 'o') {
                sculptPart(g, 'sphere', dark, [0, my, mz], [s * 0.55, s * 0.72, s * 0.35]);
            } else if (kind === 'tongue') {
                sculptPart(g, 'arc', dark, [0, my, mz], [s, s * 0.9, s * 0.5], [0, 0, Math.PI]);
                sculptPart(g, 'sphere', SCULPT_TONES.pink, [0, my - s * 0.42, mz + 0.01], [s * 0.45, s * 0.5, s * 0.28]);
            } else {
                sculptPart(g, 'arc', dark, [0, my, mz], [s, s * 0.9, s * 0.5], [0, 0, Math.PI]);
            }
        }

        // ---- 头发 / 帽子：都盖在头顶上，不挡脸 ----
        function buildHair(g, base, kind) {
            if (!kind || kind === 'none') return;
            const h = base.head, r = h.r;
            const hair = SCULPT_TONES.hair;

            if (kind === 'hat' || kind === 'chef') {
                const cloth = kind === 'chef' ? SCULPT_TONES.white : SCULPT_TONES.dark;
                sculptPart(g, 'cyl', cloth, [h.x, h.y + r * 0.86, h.z], [r * 1.16, r * 0.05, r * 1.16]);
                sculptPart(g, 'cyl', cloth, [h.x, h.y + r * 1.02, h.z], [r * 0.62, r * 0.22, r * 0.62]);
                if (kind === 'chef') {
                    sculptPart(g, 'sphere', SCULPT_TONES.white, [h.x, h.y + r * 1.34, h.z], [r * 0.78, r * 0.52, r * 0.78]);
                }
                return;
            }

            // 所有发型共用的“头顶罩”
            sculptPart(g, 'sphere', hair, [h.x, h.y + r * 0.24, h.z - r * 0.18], [r * 1.04, r * 0.86, r * 1.0]);

            if (kind === 'bob') {
                sculptPart(g, 'sphere', hair, [h.x - r * 0.92, h.y - r * 0.10, h.z - r * 0.05], [r * 0.30, r * 0.72, r * 0.62]);
                sculptPart(g, 'sphere', hair, [h.x + r * 0.92, h.y - r * 0.10, h.z - r * 0.05], [r * 0.30, r * 0.72, r * 0.62]);
            } else if (kind === 'twintail') {
                sculptPart(g, 'sphere', hair, [h.x - r * 1.18, h.y - r * 0.30, h.z - r * 0.22], [r * 0.26, r * 0.66, r * 0.26]);
                sculptPart(g, 'sphere', hair, [h.x + r * 1.18, h.y - r * 0.30, h.z - r * 0.22], [r * 0.26, r * 0.66, r * 0.26]);
                sculptPart(g, 'sphere', SCULPT_TONES.pink, [h.x - r * 1.18, h.y + r * 0.06, h.z - r * 0.22], [r * 0.13, r * 0.10, r * 0.13]);
                sculptPart(g, 'sphere', SCULPT_TONES.pink, [h.x + r * 1.18, h.y + r * 0.06, h.z - r * 0.22], [r * 0.13, r * 0.10, r * 0.13]);
            } else if (kind === 'bun') {
                sculptPart(g, 'sphere', hair, [h.x, h.y + r * 1.06, h.z - r * 0.24], [r * 0.42, r * 0.40, r * 0.42]);
            } else if (kind === 'long') {
                sculptPart(g, 'sphere', hair, [h.x, h.y - r * 0.85, h.z - r * 0.52], [r * 1.0, r * 1.35, r * 0.55]);
                sculptPart(g, 'sphere', hair, [h.x - r * 0.78, h.y - r * 0.20, h.z - r * 0.30], [r * 0.36, r * 0.95, r * 0.42]);
                sculptPart(g, 'sphere', hair, [h.x + r * 0.78, h.y - r * 0.20, h.z - r * 0.30], [r * 0.36, r * 0.95, r * 0.42]);
            }
        }

        // ---- 手势：举起 / 挥手 / 托腮，只是把手挪个位置，模型不用重拼 ----
        function applyArmPose(arms, head, kind) {
            for (const a of arms) {
                const home = a.userData.home;
                if (!home) continue;
                const side = a.userData.side || 1;
                a.position.copy(home.pos);
                a.rotation.copy(home.rot);
                if (kind === 'up') {
                    a.position.y += 0.12;
                    a.rotation.z += -side * 0.95;
                } else if (kind === 'wave') {
                    if (side > 0) {
                        a.position.y += 0.16;
                        a.rotation.z += -1.5;
                    }
                } else if (kind === 'cheek') {
                    a.position.set(side * head.r * 0.92, head.y - head.r * 0.34, head.z + head.r * 0.42);
                    a.rotation.set(0, 0, side * 0.5);
                }
            }
        }

        function disposeSculpt(g) {
            if (!g) return;
            scene.remove(g);
            g.traverse(o => {
                if (o.isMesh && o.material) o.material.dispose();
                if (o.isMesh && o.geometry) o.geometry.dispose();
            });
        }

        // 给模型里的每块网格打上归属，射线打中任何一块都能找回整个模型
        function markSculpt(group) {
            const meshes = [];
            group.traverse(o => {
                if (o.isMesh) {
                    o.userData.sculptRoot = group;
                    meshes.push(o);
                }
            });
            group.userData.meshes = meshes;
            return group;
        }

        // 转台：一块矮矮的圆台放在桌上，和杯碟并排
        function ensureBenchPlatform() {
            if (benchPlatform) return benchPlatform;
            const g = new THREE.Group();
            const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 });
            const base = new THREE.Mesh(new THREE.CylinderGeometry(BENCH_R * 0.72, BENCH_R * 0.82, BENCH_TOP - 0.05, 44), porcelain);
            base.position.y = (BENCH_TOP - 0.05) / 2;
            base.castShadow = true;
            base.receiveShadow = true;
            g.add(base);
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(BENCH_R, BENCH_R, 0.05, 48), porcelain);
            disc.position.y = BENCH_TOP - 0.025;
            disc.castShadow = true;
            disc.receiveShadow = true;
            g.add(disc);
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(BENCH_R, 0.025, 10, 64),
                new THREE.MeshBasicMaterial({ color: 0xff8fab })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = BENCH_TOP - 0.01;
            g.add(ring);
            g.position.set(benchPos.x, BENCH_Y, benchPos.z);
            benchPlatform = g;
            return g;
        }

        // 画面里没被面板挡住的那块区域（相对画布的像素）
        function sculptFreeRect() {
            const box = document.getElementById('webgl-box');
            const br = box.getBoundingClientRect();
            const nav = document.querySelector('.top-nav');
            const hud = document.querySelector('.hud-top');
            const dock = document.querySelector('.bottom-dock');
            // 缩放按钮很小又半透明，杯碟边可以从它下面经过，不用为它让出一整条
            return {
                w: br.width || 1,
                h: br.height || 1,
                left: 6,
                right: br.width - 6,
                top: Math.max(nav ? nav.getBoundingClientRect().bottom : 0, hud ? hud.getBoundingClientRect().bottom : 0) - br.top + 6,
                bottom: (dock ? dock.getBoundingClientRect().top : br.bottom) - br.top - 6
            };
        }

        // 按可用区域的横竖选转台的位置，转台和上面的模型一起挪过去
        function placeBench(free) {
            const spot = (free.right - free.left) / Math.max(1, free.bottom - free.top) < 0.85 ? BENCH_SPOTS.front : BENCH_SPOTS.side;
            if (spot.x === benchPos.x && spot.z === benchPos.z) return;
            const dx = spot.x - benchPos.x, dz = spot.z - benchPos.z;
            benchPos.x = spot.x;
            benchPos.z = spot.z;
            if (benchPlatform) benchPlatform.position.set(benchPos.x, BENCH_Y, benchPos.z);
            if (benchFigure) {
                benchFigure.position.x += dx;
                benchFigure.position.z += dz;
            }
        }

        // 滑条和长相按钮作用在“当前选中”的模型上：转台上的，或点选过的已贴模型
        function sculptTarget() {
            return activeSculpt || benchFigure || null;
        }

        function newBenchFigure(look) {
            benchFigure = markSculpt(buildFigureFromLook(look || DEFAULT_LOOK, currentGelatoColor));
            benchFigure.position.set(benchPos.x, BENCH_Y + BENCH_TOP, benchPos.z);
            scene.add(benchFigure);
            activeSculpt = benchFigure;
        }

        // 打开雕琢台：转台出现在杯子旁边，镜头慢慢退一点，把杯子和转台一起装进画面
        function openSculptBench() {
            placeBench(sculptFreeRect());
            if (!benchPlatform) scene.add(ensureBenchPlatform());
            benchPlatform.visible = true;
            if (benchFigure) {
                benchFigure.visible = true;
                activeSculpt = benchFigure;
            } else {
                newBenchFigure();
            }
            if (!sculptPrevCam) {
                sculptPrevCam = { x: camTarget.x, z: camTarget.z, radius: camRadius, phi: camPhi, theta: camTheta };
                // 等面板排版结束再按剩余可视区算距离
                requestAnimationFrame(() => requestAnimationFrame(() => fitSculptCamera(true)));
            }
            syncSculptSliders();
            syncLookChips(sculptTarget() ? sculptTarget().userData.look : DEFAULT_LOOK);
        }

        // 取景：找一个最近的距离，让杯碟、冰淇淋和转台都落在没被面板挡住的那块画面里
        function fitSculptCamera(animated) {
            if (currentMode !== 'SCULPT' || !camera) return;
            camUserMoved = false;
            const free = sculptFreeRect();
            const { w, h, left, right, top, bottom } = free;
            placeBench(free);

            // 要装进画面的点：杯碟外沿、杯口、最高的冰淇淋、转台和上面的模型
            const pts = [];
            for (let i = 0; i < 12; i++) {
                const a = i / 12 * Math.PI * 2;
                pts.push(new THREE.Vector3(Math.cos(a) * 3.3, 0.3, Math.sin(a) * 3.3));   // 杯碟最外一圈允许稍微出画
                pts.push(new THREE.Vector3(Math.cos(a) * 2.2, 1.8, Math.sin(a) * 2.2));
                pts.push(new THREE.Vector3(benchPos.x + Math.cos(a) * BENCH_R, BENCH_Y, benchPos.z + Math.sin(a) * BENCH_R));
            }
            let topY = 1.8;
            for (const m of scoops) {
                m.geometry.computeBoundingSphere();
                const bs = m.geometry.boundingSphere;
                topY = Math.max(topY, m.position.y + bs.radius * m.scale.y);
            }
            pts.push(new THREE.Vector3(0, topY, 0));
            const figH = benchFigure ? 1.45 * benchFigure.scale.x : 1.45;
            pts.push(new THREE.Vector3(benchPos.x, BENCH_Y + BENCH_TOP + figH, benchPos.z));

            const save = { x: camTarget.x, z: camTarget.z, r: camRadius, phi: camPhi, theta: camTheta };
            const to = {
                x: (Math.min(-3.5, benchPos.x - BENCH_R) + 3.5) / 2,
                z: (Math.max(3.5, benchPos.z + BENCH_R) - 3.5) * 0.3,
                phi: 0.92,
                // 回到正面最近的那一圈，避免绕一大圈转回来
                theta: Math.round(camTheta / (Math.PI * 2)) * Math.PI * 2
            };
            const fits = (r) => {
                camTarget.x = to.x; camTarget.z = to.z;
                camRadius = r; camPhi = to.phi; camTheta = to.theta;
                updateCameraPosition();
                camera.updateMatrixWorld();
                const v = new THREE.Vector3();
                for (const p of pts) {
                    v.copy(p).project(camera);
                    const sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * h;
                    if (sx < left || sx > right || sy < top || sy > bottom) return false;
                }
                return true;
            };
            let lo = CAM_MIN, hi = camMax();
            if (!fits(hi)) lo = hi;
            for (let i = 0; i < 18 && hi - lo > 0.05; i++) {
                const mid = (lo + hi) / 2;
                if (fits(mid)) hi = mid; else lo = mid;
            }
            to.r = hi;
            camTarget.x = save.x; camTarget.z = save.z;
            camRadius = save.r; camPhi = save.phi; camTheta = save.theta;
            if (animated) {
                tweenCamera(to, 520);
            } else {
                camTarget.x = to.x; camTarget.z = to.z;
                camRadius = to.r; camPhi = to.phi; camTheta = to.theta;
                updateCameraPosition();
            }
        }
        window.fitSculptCamera = fitSculptCamera;

        // 离开雕琢台：转台和上面没贴的模型先收起来（下次进来还在），镜头慢慢回到原来的位置
        function closeSculptBench() {
            if (benchPlatform) benchPlatform.visible = false;
            if (benchFigure) benchFigure.visible = false;
            if (activeSculpt === benchFigure) activeSculpt = null;
            grabbedSculpt = null;
            spinSculpt = null;
            if (sculptPrevCam) {
                const p = sculptPrevCam;
                sculptPrevCam = null;
                tweenCamera({ x: p.x, z: p.z, r: p.radius, phi: p.phi, theta: p.theta }, 480);
            }
        }

        // 换一个槽位（角色 / 眼睛 / 嘴巴 / 头发 / 手）：就地重建，位置、大小、朝向都不动
        function setSculptLook(slot, value) {
            let g = sculptTarget();
            if (!g) {
                newBenchFigure();
                g = benchFigure;
            }
            if (!g) return;
            const look = Object.assign({}, DEFAULT_LOOK, g.userData.look || {});
            look[slot] = value;
            // 换成人形时默认给个头发，不然光头有点怪
            if (slot === 'base' && value === 'person' && look.hair === 'none') look.hair = 'bob';
            applyLook(g, look);
        }

        function applyLook(oldGroup, look) {
            const pos = oldGroup.position.clone();
            const ry = oldGroup.rotation.y;
            const sc = oldGroup.scale.x;
            const isBench = oldGroup === benchFigure;
            const idx = sculpts.indexOf(oldGroup);
            disposeSculpt(oldGroup);
            if (idx >= 0) sculpts.splice(idx, 1);

            const g = markSculpt(buildFigureFromLook(look, currentGelatoColor));
            g.position.copy(pos);
            g.rotation.y = ry;
            g.scale.setScalar(sc);
            scene.add(g);
            if (idx >= 0) sculpts.splice(idx, 0, g);
            if (isBench) benchFigure = g;
            activeSculpt = g;
            grabbedSculpt = null;
            syncSculptSliders();
            syncLookChips(g.userData.look);
        }

        // 面板一次只显示一个槽位的选项，省高度、模型也能看得大一点
        let sculptSlot = 'base';
        function setSculptSlot(slot) {
            sculptSlot = slot;
            document.querySelectorAll('.slot-tab').forEach(b => {
                b.classList.toggle('on', b.getAttribute('data-slot') === slot);
            });
            document.querySelectorAll('.look-group').forEach(g => {
                g.classList.toggle('active', g.getAttribute('data-group') === slot);
            });
            // 不重新取景：换页签时镜头保持不动
        }

        // 揉捏工具：推 / 挤 / 戳 / 抹 / 捏尖，和冰淇淋的橡皮泥是同一套手感
        function setSculptTool(tool, elem) {
            sculptTool = tool;
            clayGrab = null;
            document.querySelectorAll('.sculpt-tool').forEach(b => b.classList.toggle('on', b === elem));
        }
        window.setSculptTool = setSculptTool;
        window.setSculptSlot = setSculptSlot;

        // 把当前长相同步到面板的选中态
        function syncLookChips(look) {
            const cfg = Object.assign({}, DEFAULT_LOOK, look || {});
            document.querySelectorAll('.look-btn[data-look]').forEach(btn => {
                const key = btn.getAttribute('data-look');
                const [slot, value] = key.split(':');
                btn.classList.toggle('on', cfg[slot] === value);
            });
        }
        window.syncLookChips = syncLookChips;

        function syncSculptSliders() {
            const t = sculptTarget();
            const sEl = document.getElementById('sculptScale');
            const yEl = document.getElementById('sculptYaw');
            if (!t) return;
            if (sEl) {
                sEl.value = String(Math.round(t.scale.x * 100) / 100);
                const lab = document.getElementById('sculptScaleVal');
                if (lab) lab.textContent = Number(sEl.value).toFixed(1) + '×';
            }
            if (yEl) {
                let deg = Math.round(THREE.MathUtils.radToDeg(t.rotation.y)) % 360;
                if (deg > 180) deg -= 360;
                yEl.value = String(deg);
                const lab = document.getElementById('sculptYawVal');
                if (lab) lab.textContent = deg + '°';
            }
        }

        function setSculptScale(v) {
            const t = sculptTarget();
            if (!t) return;
            t.scale.setScalar(Number(v));
            const lab = document.getElementById('sculptScaleVal');
            if (lab) lab.textContent = Number(v).toFixed(1) + '×';
        }

        function setSculptYaw(deg) {
            const t = sculptTarget();
            if (!t) return;
            t.rotation.y = THREE.MathUtils.degToRad(Number(deg));
            const lab = document.getElementById('sculptYawVal');
            if (lab) lab.textContent = Math.round(Number(deg)) + '°';
        }

        function selectSculpt(g) {
            if (!g) return;
            activeSculpt = g;
            syncSculptSliders();
            if (typeof syncLookChips === 'function' && g.userData.look) syncLookChips(g.userData.look);
        }

        // 从正上方往下打，把模型稳稳放在最高的那颗冰淇淋（或咖啡液面）上
        function creamTopAt(x, z) {
            const ro = new THREE.Raycaster(new THREE.Vector3(x, 9, z), new THREE.Vector3(0, -1, 0), 0, 20);
            const hits = ro.intersectObjects([...scoops, liquidMesh], false);
            if (hits.length) return hits[0].point.y;
            return LIQUID_Y;
        }

        function placeSculptOnCream() {
            const g = benchFigure;
            if (!g) {
                setBubble('雕琢台上还没有模型哦，先选一个小人或者加点零件吧~');
                return;
            }
            const before = captureState();
            const x = 0, z = 0;   // 转台在一侧，贴的时候落回杯子中心
            const y = creamTopAt(x, z);
            g.position.set(x, y - 0.02, z);
            markSculpt(g);
            sculpts.push(g);
            benchFigure = null;
            activeSculpt = g;
            pushUndo(before);
            syncSculptSliders();
            setBubble('贴好啦！点一下它选中，再拖动就能挪位置；「雕琢台」里还能改大小和朝向~');
            setMainMode('ORBIT');   // 回到转视角模式：画面干净，点一下模型就能选中/拖动
        }

        function removeActiveSculpt() {
            if (!activeSculpt) {
                setBubble('先点一下场景里的模型，再把它去掉~');
                return;
            }
            const g = activeSculpt;
            const before = captureState();
            scene.remove(g);
            const i = sculpts.indexOf(g);
            if (i >= 0) sculpts.splice(i, 1);
            if (g === benchFigure) benchFigure = null;
            activeSculpt = null;
            grabbedSculpt = null;
            pushUndo(before);
            setBubble('这个模型已经拿掉啦，想找回可以点"撤回"~');
        }

        // 清空雕琢台：转台上换回一个默认的小猫，重新开始拼
        function clearSculptBench() {
            if (benchFigure) {
                disposeSculpt(benchFigure);
                benchFigure = null;
            }
            newBenchFigure();
            syncSculptSliders();
            syncLookChips(DEFAULT_LOOK);
            setBubble('雕琢台清空啦，重新拼一个吧~');
        }

        // ---- 揉捏模型：和冰淇淋一样推、挤、戳、抹、捏尖 ----
        // 模型的零件被缩放过（还可能被整体放大），所以笔刷范围按世界距离算，再换回零件自己的坐标写回去
        function isSculptMesh(obj) {
            return !!(obj && obj.isMesh && obj.userData.sculptRoot);
        }

        // 本次操作第一次揉这块零件时，先存一份形状，撤回时用
        function snapshotSculptGeo(mesh) {
            if (pendingUndo && pendingUndo.sculptGeo && !pendingUndo.sculptGeo.has(mesh)) {
                pendingUndo.sculptGeo.set(mesh, mesh.geometry.attributes.position.array.slice());
            }
        }

        function sculptBrushRadius(mesh) {
            const root = mesh.userData.sculptRoot;
            return (0.05 + 0.13 * brushScale()) * (root ? root.scale.x : 1);
        }

        function sculptBrush(mesh, pointW, mode) {
            snapshotSculptGeo(mesh);
            const s = brushScale();
            const root = mesh.userData.sculptRoot;
            const gs = root ? root.scale.x : 1;
            const R = sculptBrushRadius(mesh);
            mesh.updateMatrixWorld();
            const mw = mesh.matrixWorld;
            const inv = new THREE.Matrix4().copy(mw).invert();
            const center = new THREE.Vector3().setFromMatrixPosition(mw);
            const pos = mesh.geometry.attributes.position;
            const v = new THREE.Vector3();
            const near = [];
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(mw);
                const w = clayFalloff(v.distanceTo(pointW), R);
                if (w > 0) near.push(i, w);
            }
            if (!near.length) return;

            if (mode === 'smooth') {
                // 抹：每个点往相邻点的平均位置靠（在零件自己的坐标里算就行）
                if (!mesh.geometry.index) return;
                const { rep, members, nb } = clayNeighbors(mesh.geometry);
                const rate = 0.15 + 0.35 * s;
                const seen = new Set(), targets = [];
                for (let i = 0; i < near.length; i += 2) {
                    const r = rep[near[i]];
                    if (seen.has(r)) continue;
                    seen.add(r);
                    const list = nb.get(r);
                    if (!list.length) continue;
                    let ax = 0, ay = 0, az = 0;
                    for (const u of list) { ax += pos.getX(u); ay += pos.getY(u); az += pos.getZ(u); }
                    targets.push(r, near[i + 1], ax / list.length, ay / list.length, az / list.length);
                }
                for (let i = 0; i < targets.length; i += 5) {
                    const r = targets[i], k = rate * targets[i + 1];
                    const nx = pos.getX(r) + (targets[i + 2] - pos.getX(r)) * k;
                    const ny = pos.getY(r) + (targets[i + 3] - pos.getY(r)) * k;
                    const nz = pos.getZ(r) + (targets[i + 4] - pos.getZ(r)) * k;
                    for (const m of members.get(r)) pos.setXYZ(m, nx, ny, nz);
                }
                finishClayEdit(mesh);
                return;
            }

            // 零件“原本”有多大：捏尖最多拉到这个距离的两倍，不会无限变长
            if (!mesh.userData.reach) {
                mesh.geometry.computeBoundingSphere();
                const sc = new THREE.Vector3().setFromMatrixScale(mw);
                mesh.userData.reach = mesh.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) / gs;
            }
            const maxReach = mesh.userData.reach * gs * 2.0;
            const step = (mode === 'peak' ? 0.004 + 0.012 * s : mode === 'poke' ? 0.002 + 0.006 * s : 0.003 + 0.009 * s) * gs;
            const dir = new THREE.Vector3();
            for (let i = 0; i < near.length; i += 2) {
                const idx = near[i], k = step * near[i + 1];
                v.fromBufferAttribute(pos, idx).applyMatrix4(mw);
                if (mode === 'poke') {
                    // 戳：往零件中心按出一个圆圆的小坑，不戳穿
                    dir.subVectors(center, v);
                    if (dir.length() < mesh.userData.reach * gs * 0.3) continue;
                    v.addScaledVector(dir.normalize(), k);
                } else if (mode === 'peak') {
                    // 捏尖：往外拉出一个柔和的尖
                    dir.subVectors(v, center);
                    if (dir.length() > maxReach) continue;
                    v.addScaledVector(dir.normalize(), k);
                } else {
                    // 挤：往零件的竖轴收，被挤的部分往上鼓
                    dir.set(center.x - v.x, 0, center.z - v.z);
                    if (dir.length() < 0.01 * gs) continue;
                    v.addScaledVector(dir.normalize(), k);
                    v.y += k * 0.8;
                }
                v.applyMatrix4(inv);
                pos.setXYZ(idx, v.x, v.y, v.z);
            }
            finishClayEdit(mesh);
        }

        // 推：按下时记下范围内的点（世界坐标），拖动时这一块跟着手指平移
        function startSculptGrab(mesh, pointW) {
            snapshotSculptGeo(mesh);
            const R = sculptBrushRadius(mesh) * 1.3;
            mesh.updateMatrixWorld();
            const mw = mesh.matrixWorld;
            const pos = mesh.geometry.attributes.position;
            const v = new THREE.Vector3();
            const verts = [], weights = [], orig = [];
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i).applyMatrix4(mw);
                const w = clayFalloff(v.distanceTo(pointW), R);
                if (w > 0) {
                    verts.push(i);
                    weights.push(w);
                    orig.push(v.x, v.y, v.z);
                }
            }
            const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
            clayGrab = {
                world: true,
                mesh: mesh,
                plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pointW),
                start: pointW.clone(),
                maxPull: R * 1.4,
                inv: new THREE.Matrix4().copy(mw).invert(),
                verts: verts, weights: weights, orig: orig
            };
        }

        function updateSculptGrab(g, hitW) {
            const delta = hitW.clone().sub(g.start);
            if (delta.length() > g.maxPull) delta.setLength(g.maxPull);
            const pos = g.mesh.geometry.attributes.position;
            const v = new THREE.Vector3();
            for (let i = 0; i < g.verts.length; i++) {
                const w = g.weights[i];
                v.set(g.orig[i * 3] + delta.x * w, g.orig[i * 3 + 1] + delta.y * w, g.orig[i * 3 + 2] + delta.z * w).applyMatrix4(g.inv);
                pos.setXYZ(g.verts[i], v.x, v.y, v.z);
            }
            finishClayEdit(g.mesh);
        }

        // 模式提示一行放不下时点一下展开全文，再点收起
        function togglePill() {
            const el = document.getElementById('modePill');
            if (!el) return;
            el.classList.toggle('expanded');
            const src = el.getAttribute('data-i18n-src');
            if (src) el.textContent = window.t ? window.t(src) : src;
        }
        window.togglePill = togglePill;

        // 启动放在文件最后：上面所有 let / const 都已经声明，页面加载完才执行脚本时也不会出错
        if (document.readyState === 'complete') {
            start();
        } else {
            window.addEventListener('load', start);
        }