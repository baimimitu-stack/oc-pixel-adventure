/* 冰淇淋拉花工坊 · 双语支持（中文 / English）
   零依赖：把页面上出现的中文原文当作 key，切换语言时整页替换。 */
(function () {
    'use strict';

    var STORAGE_KEY = 'gelato-lang';

    var EN = {
        /* 页面与顶部导航 */
        '女仆咖啡厅 - 冰淇淋球与拉花工坊': 'Maid Café - Gelato & Latte Art Workshop',
        '🍨 点一下杯子，放上一颗冰淇淋球': '🍨 Tap the cup to drop a gelato scoop',
        '切换相机机位': 'Switch camera angle',
        '换桌布颜色': 'Change tablecloth color',
        '女仆提示': 'Maid tips',
        '切换语言': 'Switch language',
        '跟随系统': 'System',
        '中文': '中文',
        'English': 'English',

        /* 相机预设 */
        '📐 45° 咖啡师视角': '📐 45° barista view',
        '☕ 侧面平视冰淇淋球': '☕ Side view of the scoops',
        '👀 正上俯视全览': '👀 Top-down overview',

        /* 桌布 */
        '🌸 樱花粉格纹桌布': '🌸 Sakura pink checkered cloth',
        '🌿 薄荷绿格纹桌布': '🌿 Mint green checkered cloth',
        '💜 薰衣草紫格桌布': '💜 Lavender purple cloth',
        '🍋 蜜糖柠檬黄桌布': '🍋 Honey lemon yellow cloth',
        '☕ 复古焦糖木纹桌面': '☕ Vintage caramel wood table',

        /* 女仆气泡 */
        '主人！先点一下杯子，放上第一颗冰淇淋球吧~ 每颗都可以选不同的口味哦 🍨✨': 'Welcome back, master! Tap the cup to drop your first gelato scoop — each one can be a different flavor 🍨✨',

        /* 口味与参数 */
        '口味:': 'Flavor:',
        '香草白': 'Vanilla',
        '草莓甜心': 'Strawberry',
        '宇治抹茶': 'Matcha',
        '蓝蝶海盐': 'Blue sea salt',
        '香芋浓郁': 'Taro',
        '芒果乳酪': 'Mango cheese',
        '幅度': 'Strength',
        '朝向': 'Facing',
        '倾斜': 'Tilt',
        '拉近': 'Zoom in',
        '拉远': 'Zoom out',

        /* 冰淇淋形状 / 大小 */
        '形状': 'Shape',
        '⚪ 圆球': '⚪ Ball',
        '🥞 扁圆': '🥞 Flat round',
        '🧊 方块': '🧊 Cube',
        '💗 爱心': '💗 Heart',
        '⭐ 星星': '⭐ Star',
        '🐱 猫头': '🐱 Cat head',
        '💧 水滴': '💧 Drop',
        '🍦 甜筒': '🍦 Swirl',
        '大小': 'Size',
        '小': 'S',
        '中': 'M',
        '大': 'L',

        /* 橡皮泥 / 捏起来 */
        '手法': 'Method',
        '👉 推': '👉 Push',
        '🤲 挤': '🤲 Squeeze',
        '☝️ 戳': '☝️ Poke',
        '🫳 抹': '🫳 Smooth',
        '捏': 'Pinch',
        '🫳 捏出尖角': '🫳 Pinch a peak',
        '✋ 挪动冰淇淋球': '✋ Move a scoop',

        /* 彩笔颜色 */
        '颜色': 'Color',
        '草莓红': 'Strawberry red',
        '柠檬黄': 'Lemon yellow',
        '抹茶绿': 'Matcha green',
        '蓝莓蓝': 'Blueberry blue',
        '紫薯紫': 'Purple yam',
        '樱花粉': 'Sakura pink',
        '奶白': 'Cream white',
        '巧克力': 'Chocolate',

        /* 小装饰 */
        '🍋 柠檬片': '🍋 Lemon slice',
        '🍓 草莓': '🍓 Strawberry',
        '🍒 樱桃': '🍒 Cherry',
        '🌿 薄荷叶': '🌿 Mint leaf',
        '🍪 饼干': '🍪 Cookie',
        '🍫 巧克力碎': '🍫 Choco chips',
        '📷 上传图片': '📷 Upload photo',

        /* 工具模式 */
        '放冰淇淋': 'Scoop',
        '捏起来': 'Pinch',
        '橡皮泥': 'Clay',
        '勺背压平': 'Flatten',
        '旋涡乳化': 'Stir',
        '金边拉花': 'Pour art',
        '描边彩笔': 'Pens',
        '小装饰': 'Toppings',
        '画画': 'Draw',
        '转视角': 'Orbit',

        /* 底部操作 */
        '↩️ 撤回': '↩️ Undo',
        '🧹 清空重来': '🧹 Start over',
        '✨ 美味魔法': '✨ Magic finish'
    };

    /* 脚本动态生成的文案（同样以中文原文为 key） */
    Object.assign(EN, {
        '🍨 选好形状和大小，点一下杯子放一颗（每颗都能换口味）': '🍨 Pick a shape and size, then tap the cup to drop a scoop (mix flavors freely)',
        '🤏 捏起来 (下方选：捏出尖角，或挪动冰淇淋球)': '🤏 Pinch (choose below: pinch a peak, or move a scoop)',
        '🧸 橡皮泥 (下方选推、挤、戳、抹，按住冰淇淋球揉一揉)': '🧸 Clay (pick push, squeeze, poke or smooth, then knead the scoop)',
        '🥄 勺背压平 (按住冰淇淋球上方滑动，压成柔软的一层)': '🥄 Back of spoon (press and slide over a scoop to flatten it)',
        '🌪️ 旋涡乳化 (在咖啡中搅拌，把冰淇淋与咖啡融匀)': '🌪️ Whisk (stir the coffee to blend gelato and espresso)',
        '🥛 金边拉花 (按住不动会鼓起奶泡，移动就画出纹路)': '🥛 Latte art (hold still to build foam, move to draw patterns)',
        '🍫 描边彩笔 (下方选颜色，在咖啡液面上画线条)': '🍫 Etching pen (pick a color and draw on the coffee surface)',
        '🍋 小装饰 (下方选一种，点在冰淇淋或咖啡上；也能上传自己的图片当贴纸)': '🍋 Toppings (pick one and tap the gelato or coffee; you can upload your own photo too)',
        '🎨 画画 (选颜色画；选自己的图片，点一下印到杯子、冰淇淋或咖啡上)': '🎨 Draw (paint with a color, or pick your own photo and stamp it on the cup, gelato or coffee)',
        '🖐️ 转视角 (拖动旋转，Shift+拖动平移；其他模式下右键或双指拖动也能转)': '🖐️ Orbit (drag to rotate, Shift+drag to pan; right-drag or two-finger drag works in other modes)',
        '杯子已经装满啦，先清空再来吧~': 'The cup is full — clear it and try again~',
        '素材最多放 {n} 张啦~': 'You can add up to {n} photos~',
        '图片已经变成印章啦，点一下杯子、冰淇淋或咖啡就能印上去~': 'Your photo is a stamp now — tap the cup, gelato or coffee to print it~',
        '图片已经变成贴纸啦，点在冰淇淋或咖啡上就能贴上去~': 'Your photo is a sticker now — tap the gelato or coffee to place it~',
        '有 {n} 张图片打不开，换成 PNG 或 JPG 再试试~': '{n} photo(s) could not be opened. Try PNG or JPG~',
        '现在没有可以撤回的步骤啦~': 'There is nothing to undo yet~',
        '杯子已经清空啦，可以点"撤回"找回刚才的内容~ 🍨': 'The cup is empty — tap Undo to bring your work back~ 🍨',
        '✨ 变得香甜美味吧~ 萌萌啾！💖': '✨ Time to taste the magic~ mwah! 💖',
        '主人亲手放上的冰淇淋球和拉花太诱人啦！请尽情享用这份甜蜜吧~ 🍨💕': 'Your gelato and latte art look irresistible! Enjoy every sweet bite~ 🍨💕',
        '这台设备暂时显示不了 3D 画面（WebGL 不可用），换个浏览器或设备再试试吧~': 'This device cannot show the 3D scene (WebGL unavailable). Try another browser or device~'
    });

    /* 雕琢台 */
    Object.assign(EN, {
        '雕琢台': 'Studio',
        '模板': 'Templates',
        '加零件': 'Add part',
        '头': 'Head',
        '身': 'Body',
        '手': 'Arms',
        '脚': 'Feet',
        '耳': 'Ears',
        '尾': 'Tail',
        '帽': 'Hat',
        '旋转': 'Rotate',
        '🐱 猫咪': '🐱 Cat',
        '🐻 小熊': '🐻 Bear',
        '🧍 小人': '🧍 Person',
        '🐰 兔子': '🐰 Bunny',
        '✅ 贴到冰淇淋上': '✅ Stick it on the cream',
        '🗑 去掉所选': '🗑 Remove selected',
        '🧹 清空雕琢台': '🧹 Clear studio',
        '🗿 雕琢台：拼小人 → 贴到冰淇淋上，还能拖': '🗿 Studio: build a figure → stick it on the cream',
        '雕琢台上还没有模型哦，先选一个小人或者加点零件吧~': 'The studio bench is empty — pick a figure or add some parts~',
        '贴好啦！点一下它选中，再拖动就能挪位置；「雕琢台」里还能改大小和朝向~': 'Done! Tap it to select, then drag to move it — the Studio can change its size and rotation~',
        '先点一下场景里的模型，再把它去掉~': 'Tap a figure in the scene first, then remove it~',
        '这个模型已经拿掉啦，想找回可以点"撤回"~': 'That figure is gone — tap Undo to bring it back~',
        '雕琢台清空啦，重新拼一个吧~': 'Studio cleared — build another one~',
        '冰淇淋球已经放满 {n} 颗啦，先清空再来吧~': 'That is {n} scoops already — clear the scene and add more~',
        /* 拼贴面板 */
        '角色': 'Figure',
        '眼睛': 'Eyes',
        '嘴巴': 'Mouth',
        '头发': 'Hair',
        '手': 'Hands',
        '● 圆眼': '● Round',
        '︶ 笑眼': '︶ Happy',
        '★ 星星眼': '★ Star',
        '— 眯眼': '— Closed',
        '♥ 爱心眼': '♥ Heart',
        '◡ 眨眼': '◡ Wink',
        '‿ 微笑': '‿ Smile',
        'ω 猫嘴': 'ω Cat',
        '○ 惊讶': '○ Surprised',
        '👅 吐舌': '👅 Tongue',
        '无': 'None',
        '蘑菇头': 'Bob',
        '双马尾': 'Twin tails',
        '丸子头': 'Bun',
        '长发': 'Long',
        '小礼帽': 'Top hat',
        '厨师帽': 'Chef hat',
        '放下': 'Down',
        '举起': 'Up',
        '挥手': 'Wave',
        '托腮': 'Cheek',
        '✅ 贴到咖啡上': '✅ Stick it on the drink',
        '🧹 清空雕琢台': '🧹 Clear studio',
        '🗑 去掉所选': '🗑 Remove selected',
        '🐧 企鹅': '🐧 Penguin',
        '🦖 恐龙': '🦖 Dino',
        '配饰': 'Accessories',
        '上色': 'Paint',
        '👓 眼镜': '👓 Glasses',
        '🎀 蝴蝶结': '🎀 Bow',
        '🧣 围巾': '🧣 Scarf',
        '💗 爱心手持': '💗 Heart prop',
        '在小人身上涂色：': 'Paint directly on the figure:',
        '🫐 蓝莓': '🫐 Blueberry',
        '☁️ 棉花糖': '☁️ Marshmallow',
        '⭐ 糖霜星星': '⭐ Sugar star',
        '🥨 威化卷': '🥨 Wafer roll',
        '揉捏': 'Sculpt',
        '🤏 捏尖': '🤏 Peak',
        '🗿 雕琢台：在杯子旁边拼小人，拖它转一圈，「揉捏」能像冰淇淋一样捏形状': '🗿 Studio: build a figure beside the cup, drag to spin it, and use Sculpt to shape it like gelato',
        '回游戏盒子': 'Back to game box',
        '点一下看完整提示': 'Tap to see the full tip'
    });


    var pref = 'system';
    var lang = 'zh';

    function systemLang() {
        var n = (navigator.language || 'zh').toLowerCase();
        return n.indexOf('zh') === 0 ? 'zh' : 'en';
    }

    function resolveLang() {
        return pref === 'system' ? systemLang() : pref;
    }

    function format(str, params) {
        if (!params) return str;
        return str.replace(/\{(\w+)\}/g, function (m, k) {
            return params[k] === undefined ? m : String(params[k]);
        });
    }

    /* 把中文原文翻成当前语言 */
    function t(zh, params) {
        var out = lang === 'zh' ? zh : (EN[zh] || zh);
        return format(out, params);
    }

    function setI18nText(el, zh, params) {
        if (!el) return;
        el.setAttribute('data-i18n-src', zh);
        if (params) el.setAttribute('data-i18n-params', JSON.stringify(params));
        else el.removeAttribute('data-i18n-params');
        el.textContent = t(zh, params);
    }

    var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];

    function translateNode(node) {
        if (node.__i18nSrc === undefined) node.__i18nSrc = node.nodeValue.trim();
        var src = node.__i18nSrc;
        if (!src) return;
        var out = t(src);
        var raw = node.nodeValue;
        var lead = (raw.match(/^\s*/) || [''])[0];
        var tail = (raw.match(/\s*$/) || [''])[0];
        var next = lead + out + tail;
        if (node.nodeValue !== next) node.nodeValue = next;
    }

    function apply(root) {
        root = root || document.body;
        if (!root) return;
        var dyn = root.querySelectorAll('[data-i18n-src]');
        for (var i = 0; i < dyn.length; i++) {
            var el = dyn[i];
            var p = el.getAttribute('data-i18n-params');
            el.textContent = t(el.getAttribute('data-i18n-src'), p ? JSON.parse(p) : null);
        }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                var p = n.parentNode;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (p.closest && (p.closest('[data-i18n-src]') || p.closest('[data-i18n-skip]'))) {
                    return NodeFilter.FILTER_REJECT;
                }
                return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });
        var n;
        while ((n = walker.nextNode())) translateNode(n);
        var els = root.querySelectorAll('[title], [aria-label], [placeholder], [alt]');
        for (var j = 0; j < els.length; j++) {
            for (var k = 0; k < ATTRS.length; k++) {
                var a = ATTRS[k];
                var v = els[j].getAttribute(a);
                if (!v) continue;
                if (els[j]['__i18nAttr_' + a] === undefined) els[j]['__i18nAttr_' + a] = v;
                var src = els[j]['__i18nAttr_' + a];
                var out = t(src);
                if (v !== out) els[j].setAttribute(a, out);
            }
        }
    }

    function updateSwitcher() {
        var opts = document.querySelectorAll('.lang-opt');
        for (var i = 0; i < opts.length; i++) {
            opts[i].classList.toggle('active', opts[i].getAttribute('data-lang') === pref);
        }
    }

    function setPref(next) {
        pref = (next === 'zh' || next === 'en') ? next : 'system';
        try { localStorage.setItem(STORAGE_KEY, pref); } catch (e) {}
        lang = resolveLang();
        document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en-US');
        apply(document.body);
        document.title = t('女仆咖啡厅 - 冰淇淋球与拉花工坊');
        updateSwitcher();
        document.dispatchEvent(new CustomEvent('gelato:langchange', { detail: { lang: lang } }));
    }

    function boot() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'zh' || saved === 'en' || saved === 'system') pref = saved;
        } catch (e) {}
        lang = resolveLang();
        document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en-US');
        apply(document.body);
        document.title = t('女仆咖啡厅 - 冰淇淋球与拉花工坊');
        updateSwitcher();

        var pop = document.getElementById('langPop');
        var btn = document.getElementById('langBtn');
        function closePop() { if (pop) pop.classList.remove('open'); }
        if (btn && pop) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                pop.classList.toggle('open');
            });
            var opts = pop.querySelectorAll('.lang-opt');
            for (var i = 0; i < opts.length; i++) {
                opts[i].addEventListener('click', function (e) {
                    e.stopPropagation();
                    setPref(this.getAttribute('data-lang'));
                    closePop();
                });
            }
            document.addEventListener('click', closePop);
        }
    }

    window.t = t;
    window.setI18nText = setI18nText;
    window.applyI18n = apply;
    window.setGelatoLang = setPref;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
