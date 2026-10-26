// Hero constellation: tools and certifications orbit the profile photo,
// linked by curved "wires" with data packets flowing along them.
// Every bubble can be dragged; positions are remembered in this browser.
(function () {
    var stage = document.querySelector('[data-orbit]');
    if (!stage) return;

    var canvas = stage.querySelector('.orbit-canvas');
    var ctx = canvas.getContext('2d');
    var resetBtn = document.querySelector('[data-orbit-reset]');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STORAGE_KEY = 'orbit-layout';

    // Brand colours from the AH logo ring.
    var COLORS = ['#1e9bd7', '#1fae57', '#e3ae2b', '#e5304f'];
    var LIGHT_COLORS = ['#0e72a0', '#128c3a', '#be8f18', '#ca0e2f'];

    var outer = Array.prototype.slice.call(stage.querySelectorAll('[data-ring="outer"]'));
    var inner = Array.prototype.slice.call(stage.querySelectorAll('[data-ring="inner"]'));

    var nodes = [];
    outer.forEach(function (el, i) {
        nodes.push(makeNode(el, 'outer', i, -Math.PI / 2 + (i * 2 * Math.PI) / outer.length));
    });
    // Each certification sits halfway between two neighbouring tools, spread evenly around the ring.
    inner.forEach(function (el, i) {
        var angle;
        if (outer.length >= inner.length) {
            var gap = Math.round((i * outer.length) / inner.length);
            angle = -Math.PI / 2 + ((gap + 0.5) * 2 * Math.PI) / outer.length;
        } else {
            angle = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / inner.length;
        }
        nodes.push(makeNode(el, 'inner', i, angle));
    });

    function makeNode(el, ring, i, angle) {
        var node = {
            el: el,
            ring: ring,
            baseAngle: angle,
            phase: Math.random() * Math.PI * 2,
            speed: 0.6 + Math.random() * 0.5,
            colorIndex: (ring === 'outer' ? i : i + 2) % COLORS.length,
            packet: Math.random(),
            packetSpeed: 0.16 + Math.random() * 0.12,
            hover: 0,
            hovered: false,
            appear: 0,
            custom: null, // dragged position as a share of the stage: { fx, fy }
            dragging: false,
            x: 0,
            y: 0,
            placed: false,
            w: 0,
            h: 0
        };
        // Tool labels go on the outer side of the icon: above it in the top half of the ring.
        if (ring === 'outer' && Math.sin(angle) < -0.2) el.classList.add('label-above');
        el.setAttribute('draggable', 'false');
        el.addEventListener('mouseenter', function () { node.hovered = true; });
        el.addEventListener('mouseleave', function () { if (!node.dragging) node.hovered = false; });
        el.addEventListener('focus', function () { node.hovered = true; });
        el.addEventListener('blur', function () { node.hovered = false; });
        return node;
    }

    // Each certification is wired to the two closest tools.
    var crossLinks = [];
    nodes.filter(function (n) { return n.ring === 'inner'; }).forEach(function (cert) {
        var tools = nodes.filter(function (n) { return n.ring === 'outer'; });
        tools.sort(function (a, b) { return angleGap(a.baseAngle, cert.baseAngle) - angleGap(b.baseAngle, cert.baseAngle); });
        tools.slice(0, 2).forEach(function (tool) {
            crossLinks.push({ a: cert, b: tool, packet: Math.random(), speed: 0.12 + Math.random() * 0.1 });
        });
    });

    function angleGap(a, b) {
        var d = Math.abs(a - b) % (Math.PI * 2);
        return d > Math.PI ? Math.PI * 2 - d : d;
    }

    var size = 0;
    var dpr = 1;
    var palette = COLORS;

    function readTheme() {
        palette = document.documentElement.getAttribute('data-theme') === 'light' ? LIGHT_COLORS : COLORS;
        nodes.forEach(function (n) { n.el.style.setProperty('--c', palette[n.colorIndex]); });
    }

    function resize() {
        size = stage.clientWidth;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        nodes.forEach(function (n) {
            n.w = n.el.offsetWidth;
            n.h = n.el.offsetHeight;
        });
    }

    // Ring radii as a share of the stage size; they must clear the core (--core in CSS).
    function radii() {
        var small = size < 420;
        return {
            rx: size * (small ? 0.455 : 0.445),
            ry: size * (small ? 0.455 : 0.435),
            inner: size * (small ? 0.345 : 0.34)
        };
    }

    // ---------- Saved layout ----------
    function saveLayout() {
        var data = {};
        nodes.forEach(function (n, i) { if (n.custom) data[i] = [n.custom.fx, n.custom.fy]; });
        try {
            if (Object.keys(data).length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: nodes.length, nodes: data }));
            else localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        updateResetButton();
    }

    function loadLayout() {
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!saved || saved.count !== nodes.length) return;
            Object.keys(saved.nodes).forEach(function (i) {
                var p = saved.nodes[i];
                if (nodes[i]) nodes[i].custom = { fx: p[0], fy: p[1] };
            });
        } catch (e) {}
    }

    function updateResetButton() {
        if (!resetBtn) return;
        var moved = nodes.some(function (n) { return n.custom; });
        resetBtn.classList.toggle('is-reset', moved);
        resetBtn.disabled = !moved;
        resetBtn.querySelector('[data-label]').textContent = moved ? 'Reset layout' : 'Drag the bubbles around';
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            nodes.forEach(function (n) { n.custom = null; });
            saveLayout();
        });
    }

    // ---------- Dragging ----------
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    nodes.forEach(function (n) {
        var drag = null;
        var suppressClick = false;

        n.el.addEventListener('dragstart', function (e) { e.preventDefault(); });

        n.el.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            var r = stage.getBoundingClientRect();
            drag = {
                x: e.clientX,
                y: e.clientY,
                dx: e.clientX - r.left - n.x,
                dy: e.clientY - r.top - n.y,
                moved: false
            };
            n.el.setPointerCapture(e.pointerId);
        });

        n.el.addEventListener('pointermove', function (e) {
            if (!drag) return;
            if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
            drag.moved = true;
            n.dragging = true;
            n.hovered = true;
            n.el.classList.add('dragging');
            var r = stage.getBoundingClientRect();
            n.custom = {
                fx: clamp((e.clientX - r.left - drag.dx) / size, 0.05, 0.95),
                fy: clamp((e.clientY - r.top - drag.dy) / size, 0.05, 0.95)
            };
        });

        function end(e) {
            if (!drag) return;
            if (drag.moved) {
                suppressClick = true;
                saveLayout();
            }
            drag = null;
            n.dragging = false;
            n.el.classList.remove('dragging');
            if (e.type === 'pointercancel' || e.pointerType !== 'mouse') n.hovered = false;
        }

        n.el.addEventListener('pointerup', end);
        n.el.addEventListener('pointercancel', end);

        // A drag must not open the tool's link.
        n.el.addEventListener('click', function (e) {
            if (suppressClick) {
                e.preventDefault();
                suppressClick = false;
            }
        }, true);
    });

    // ---------- Pointer parallax ----------
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        pointer.tx = (e.clientX - r.left) / r.width - 0.5;
        pointer.ty = (e.clientY - r.top) / r.height - 0.5;
    });
    stage.addEventListener('pointerleave', function () { pointer.tx = 0; pointer.ty = 0; });

    function layout(t) {
        var c = size / 2;
        var small = size < 420;
        var r = radii();
        var drift = reduceMotion ? 0 : Math.sin(t * 0.07) * 0.09; // slow sway of the whole constellation
        var motion = reduceMotion ? 0 : 1;

        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;

        nodes.forEach(function (n) {
            var depth = n.ring === 'outer' ? 18 : 10;
            var bobX = Math.sin(t * n.speed + n.phase) * 6 * motion;
            var bobY = Math.cos(t * n.speed * 0.8 + n.phase) * 8 * motion;
            var tx;
            var ty;

            if (n.custom) {
                tx = n.custom.fx * size;
                ty = n.custom.fy * size;
                if (!n.dragging) {
                    tx += bobX + pointer.x * depth * motion;
                    ty += bobY + pointer.y * depth * motion;
                }
            } else {
                var angle = n.baseAngle + (n.ring === 'outer' ? drift : -drift * 1.4);
                var rx = n.ring === 'outer' ? r.rx : r.inner;
                var ry = n.ring === 'outer' ? r.ry : r.inner;
                // Entrance: nodes fly out from the core.
                var ease = 1 - Math.pow(1 - n.appear, 3);
                tx = c + Math.cos(angle) * rx * ease + bobX + pointer.x * depth * motion;
                ty = c + Math.sin(angle) * ry * ease + bobY + pointer.y * depth * motion;
            }

            // Ease towards the target once placed, so drags, drops and resets glide.
            if (!n.placed) {
                n.x = tx;
                n.y = ty;
                n.placed = n.appear >= 1;
            } else {
                var k = n.dragging ? 0.45 : 0.14;
                n.x += (tx - n.x) * k;
                n.y += (ty - n.y) * k;
            }

            // Anchor the icon (not the label) on the position for tool nodes.
            var anchorY = n.h / 2;
            if (n.ring === 'outer' && !small) anchorY = n.el.classList.contains('label-above') ? n.h - 24 : 24;
            n.el.style.transform = 'translate(' + (n.x - n.w / 2).toFixed(1) + 'px,' + (n.y - anchorY).toFixed(1) + 'px)';
        });
    }

    function rgba(hex, a) {
        var v = parseInt(hex.slice(1), 16);
        return 'rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
    }

    // Quadratic curve between two points, bent sideways for an organic look.
    function curve(ax, ay, bx, by, bend) {
        var mx = (ax + bx) / 2;
        var my = (ay + by) / 2;
        var dx = bx - ax;
        var dy = by - ay;
        return { ax: ax, ay: ay, cx: mx - dy * bend, cy: my + dx * bend, bx: bx, by: by };
    }

    function pointOn(q, p) {
        var u = 1 - p;
        return {
            x: u * u * q.ax + 2 * u * p * q.cx + p * p * q.bx,
            y: u * u * q.ay + 2 * u * p * q.cy + p * p * q.by
        };
    }

    function strokeCurve(q) {
        ctx.beginPath();
        ctx.moveTo(q.ax, q.ay);
        ctx.quadraticCurveTo(q.cx, q.cy, q.bx, q.by);
        ctx.stroke();
    }

    function drawPacket(q, p, color, radius) {
        var pt = pointOn(q, p);
        var glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius * 4);
        glow.addColorStop(0, rgba(color, 0.9));
        glow.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    function draw(t, dt) {
        ctx.clearRect(0, 0, size, size);
        var c = size / 2;
        var r = radii();
        var anyHover = nodes.some(function (n) { return n.hovered; });

        // Faint orbit guides.
        ctx.setLineDash([2, 7]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(palette[0], 0.16);
        ctx.beginPath();
        ctx.arc(c, c, r.inner, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = rgba(palette[3], 0.1);
        ctx.beginPath();
        ctx.ellipse(c, c, r.rx, r.ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Cross links: certification <-> tools.
        crossLinks.forEach(function (l) {
            var active = l.a.hovered || l.b.hovered;
            var alpha = Math.min(l.a.appear, l.b.appear) * (active ? 0.8 : anyHover ? 0.08 : 0.26);
            var q = curve(l.a.x, l.a.y, l.b.x, l.b.y, 0.18);
            ctx.setLineDash([3, 6]);
            ctx.lineDashOffset = reduceMotion ? 0 : -t * 14;
            ctx.lineWidth = active ? 1.4 : 1;
            ctx.strokeStyle = rgba(palette[l.a.colorIndex], alpha);
            strokeCurve(q);
            if (!reduceMotion && alpha > 0.05) {
                l.packet = (l.packet + dt * l.speed) % 1;
                drawPacket(q, l.packet, palette[l.b.colorIndex], active ? 2.4 : 1.6);
            }
        });

        // Spokes: core <-> every node.
        nodes.forEach(function (n, i) {
            n.hover += ((n.hovered ? 1 : 0) - n.hover) * 0.15;
            var color = palette[n.colorIndex];
            var q = curve(c, c, n.x, n.y, i % 2 ? 0.14 : -0.14);
            var base = anyHover && !n.hovered ? 0.14 : 0.45;
            var alpha = n.appear * (base + n.hover * 0.55);

            var grad = ctx.createLinearGradient(c, c, n.x, n.y);
            grad.addColorStop(0, rgba(color, 0));
            grad.addColorStop(0.35, rgba(color, alpha * 0.6));
            grad.addColorStop(1, rgba(color, alpha));
            ctx.setLineDash([]);
            ctx.lineWidth = 1.2 + n.hover * 1.2;
            ctx.strokeStyle = grad;
            strokeCurve(q);

            // Flowing dashes over the wire.
            ctx.setLineDash([4, 12]);
            ctx.lineDashOffset = reduceMotion ? 0 : -t * 26;
            ctx.lineWidth = 1.4 + n.hover;
            ctx.strokeStyle = rgba(color, alpha * 0.9);
            strokeCurve(q);

            if (!reduceMotion && n.appear > 0.9) {
                n.packet = (n.packet + dt * n.packetSpeed * (1 + n.hover)) % 1;
                // Packets travel outwards from the core to the tools and certifications.
                drawPacket(q, 0.25 + n.packet * 0.75, color, 2 + n.hover);
            }
        });
        ctx.setLineDash([]);
    }

    var last = 0;
    var start = 0;
    var running = false;
    var visible = true;

    function frame(now) {
        if (!start) start = now;
        var t = (now - start) / 1000;
        var dt = Math.min((now - last) / 1000, 0.05) || 0.016;
        last = now;

        nodes.forEach(function (n, i) {
            // Staggered entrance (instant when motion is reduced).
            n.appear = reduceMotion ? 1 : Math.max(0, Math.min(1, (t - 0.25 - i * 0.08) / 0.9));
        });

        layout(t);
        draw(t, dt);

        if (running) requestAnimationFrame(frame);
    }

    function play() {
        if (running || !visible || document.hidden) return;
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
    }

    function pause() {
        running = false;
    }

    loadLayout();
    readTheme();
    resize();
    updateResetButton();
    stage.classList.add('ready');

    window.addEventListener('resize', resize);
    new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.addEventListener('visibilitychange', function () { document.hidden ? pause() : play(); });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            visible ? play() : pause();
        }).observe(stage);
    }
    play();
})();
