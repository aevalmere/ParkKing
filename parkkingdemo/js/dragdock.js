/* ============================================================
   PARK KING — Drag-Dock (laptop only)
   The floating map bubbles (unified map-controls, the route summary,
   the simulation HUD) can be dragged and dropped between 8 snap
   anchors — the 4 corners + 4 edge midpoints of the map viewport.

   Each anchor is an invisible flex "dock" positioned with insets, so
   multiple bubbles at one anchor stack cleanly and window resizes
   reflow automatically. Bubbles live INSIDE a dock; on load each is
   assigned to the dock matching its current visual position so nothing
   moves until the user drags. Mouse / fine-pointer only, viewport
   >= 900px. Transform/opacity animations only.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.DragDock = (() => {
    const STORE_KEY = 'pk-dock-v1';
    const ANCHORS = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
    // bubbleId -> its default anchor (its natural CSS position).
    // NOTE: #map-controls (recenter + zoom stack) is intentionally NOT in this
    // set — it must stay fixed in its normal bottom-right position and is never
    // draggable. Only the route summary and the sim HUD dock/snap.
    const DEFAULTS = { 'route-summary': 'tr', 'sim-hud': 'tc' };
    const BUBBLES = Object.keys(DEFAULTS);
    // must match the dock insets in styles.css
    const SIDE = 18, TOP = 74, BOTTOM = 24, DOT = 10;

    const mqFine = window.matchMedia ? window.matchMedia('(pointer: fine)') : { matches: false, addEventListener: () => {} };
    let active = false;
    let docks = {};              // anchor -> dock element
    let dotWrap = null, dotEls = {};
    const orig = {};             // bubbleId -> { parent, next } original DOM slot
    let resizeTimer = null;

    function el(id) { return document.getElementById(id); }
    function shouldActivate() { return mqFine.matches && window.innerWidth >= 900; }

    /* ---------- persistence ---------- */
    function loadSaved() {
        try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
    }
    function saveAnchor(id, anchor) {
        try {
            const s = loadSaved(); s[id] = anchor;
            sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
        } catch (e) { /* private mode / quota — persistence is best-effort */ }
    }

    /* ---------- anchor geometry (viewport px) ---------- */
    function anchorPoints() {
        const W = window.innerWidth, H = window.innerHeight;
        const cx = W / 2, cy = H / 2;
        return {
            tl: [SIDE, TOP], tc: [cx, TOP], tr: [W - SIDE, TOP],
            ml: [SIDE, cy], mr: [W - SIDE, cy],
            bl: [SIDE, H - BOTTOM], bc: [cx, H - BOTTOM], br: [W - SIDE, H - BOTTOM]
        };
    }
    function nearestAnchor(x, y) {
        const pts = anchorPoints();
        let best = ANCHORS[0], bestD = Infinity;
        for (const a of ANCHORS) {
            const p = pts[a], d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
            if (d < bestD) { bestD = d; best = a; }
        }
        return best;
    }

    /* ---------- docks + hint dots ---------- */
    function buildDocks() {
        docks = {};
        for (const a of ANCHORS) {
            const d = document.createElement('div');
            d.className = 'pk-dock pk-dock--' + a;
            d.dataset.anchor = a;
            document.body.appendChild(d);
            docks[a] = d;
        }
    }
    function buildDots() {
        dotWrap = document.createElement('div');
        dotWrap.className = 'pk-dots';
        dotWrap.setAttribute('aria-hidden', 'true');
        dotEls = {};
        for (const a of ANCHORS) {
            const dot = document.createElement('div');
            dot.className = 'pk-dot';
            dot.dataset.anchor = a;
            dotWrap.appendChild(dot);
            dotEls[a] = dot;
        }
        document.body.appendChild(dotWrap);
        positionDots();
    }
    function positionDots() {
        if (!dotWrap) return;
        const pts = anchorPoints();
        for (const a of ANCHORS) { dotEls[a].style.left = pts[a][0] + 'px'; dotEls[a].style.top = pts[a][1] + 'px'; }
    }
    function showDots() { if (dotWrap) dotWrap.classList.add('show'); }
    function hideDots() { if (dotWrap) { dotWrap.classList.remove('show'); ANCHORS.forEach(a => dotEls[a].classList.remove('near')); } }
    function highlightDot(anchor) { ANCHORS.forEach(a => dotEls[a].classList.toggle('near', a === anchor)); }

    function dockBubble(bubble, anchor) {
        const dock = docks[anchor] || docks[DEFAULTS[bubble.id]] || docks.br;
        if (!dock) return;
        dock.appendChild(bubble);
        bubble.classList.add('pk-docked');
    }

    /* ---------- drag ---------- */
    function beginDrag(bubble, rect0) {
        bubble.classList.remove('pk-docked');
        bubble.classList.add('pk-dragging');
        bubble.style.position = 'fixed';
        bubble.style.margin = '0';
        bubble.style.width = rect0.width + 'px';
        bubble.style.left = rect0.left + 'px';
        bubble.style.top = rect0.top + 'px';
        bubble.style.right = 'auto';
        bubble.style.bottom = 'auto';
        bubble.style.transform = 'translate3d(0,0,0) scale(1.03)';
        document.body.classList.add('pk-dragging-active');
        showDots();
    }
    function updateDrag(bubble, rect0, dx, dy) {
        bubble.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.03)`;
        const cx = rect0.left + dx + rect0.width / 2;
        const cy = rect0.top + dy + rect0.height / 2;
        const near = nearestAnchor(cx, cy);
        highlightDot(near);
        bubble._pkNear = near;
    }
    function endDrag(bubble) {
        const anchor = bubble._pkNear || DEFAULTS[bubble.id] || 'br';
        // FLIP — record the lifted (first) rect before re-parenting
        const first = bubble.getBoundingClientRect();
        bubble.classList.remove('pk-dragging');
        ['position', 'margin', 'width', 'left', 'top', 'right', 'bottom', 'transform', 'transition'].forEach(p => { bubble.style[p] = ''; });
        dockBubble(bubble, anchor);
        // last rect (final docked position), then invert + play
        const last = bubble.getBoundingClientRect();
        const dx = first.left - last.left, dy = first.top - last.top;
        bubble.style.transition = 'none';
        bubble.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        void bubble.getBoundingClientRect();   // reflow so the invert is committed
        bubble.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        bubble.style.transform = 'translate3d(0,0,0)';
        const cleanup = () => { bubble.style.transition = ''; bubble.style.transform = ''; bubble.removeEventListener('transitionend', cleanup); };
        bubble.addEventListener('transitionend', cleanup);
        setTimeout(cleanup, 340);
        hideDots();
        document.body.classList.remove('pk-dragging-active');
        saveAnchor(bubble.id, anchor);
    }

    function attachDrag(bubble) {
        bubble.addEventListener('pointerdown', (e) => {
            if (!active || e.button !== 0 || e.pointerType === 'touch') return;
            const startX = e.clientX, startY = e.clientY;
            const rect0 = bubble.getBoundingClientRect();
            let dragging = false;
            const onMove = (ev) => {
                const dx = ev.clientX - startX, dy = ev.clientY - startY;
                if (!dragging) {
                    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;  // 5px threshold — clicks still work
                    dragging = true;
                    beginDrag(bubble, rect0);
                }
                ev.preventDefault();
                updateDrag(bubble, rect0, dx, dy);
            };
            const onUp = (ev) => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                document.removeEventListener('pointercancel', onUp);
                if (dragging) {
                    ev.preventDefault();
                    bubble._pkJustDragged = true;
                    setTimeout(() => { bubble._pkJustDragged = false; }, 400);
                    endDrag(bubble);
                }
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            document.addEventListener('pointercancel', onUp);
        });
        // swallow the click that fires right after a drag so a moved bubble's
        // buttons don't also activate (a plain click without a drag is untouched)
        bubble.addEventListener('click', (e) => {
            if (bubble._pkJustDragged) { e.stopPropagation(); e.preventDefault(); bubble._pkJustDragged = false; }
        }, true);
    }

    /* ---------- setup / teardown across the desktop breakpoint ---------- */
    function setup() {
        if (active) return;
        active = true;
        buildDocks();
        buildDots();
        const saved = loadSaved();
        BUBBLES.forEach(id => {
            const b = el(id); if (!b) return;
            dockBubble(b, saved[id] || DEFAULTS[id]);
        });
    }
    function teardown() {
        if (!active) return;
        active = false;
        BUBBLES.forEach(id => {
            const b = el(id); if (!b) return;
            b.classList.remove('pk-docked', 'pk-dragging');
            b.style.cssText = '';
            const o = orig[id];
            if (o && o.parent) o.parent.insertBefore(b, o.next);
        });
        Object.values(docks).forEach(d => d.remove());
        docks = {};
        if (dotWrap) { dotWrap.remove(); dotWrap = null; dotEls = {}; }
    }
    function evaluate() { if (shouldActivate()) setup(); else teardown(); }

    function init() {
        // purge any stale saved position for the (now non-draggable) map-controls
        // so a previously-docked session can never move it.
        try { const s = loadSaved(); if (s && 'map-controls' in s) { delete s['map-controls']; sessionStorage.setItem(STORE_KEY, JSON.stringify(s)); } } catch (e) { /* best-effort */ }
        BUBBLES.forEach(id => {
            const b = el(id); if (!b) return;
            orig[id] = { parent: b.parentNode, next: b.nextSibling };
            attachDrag(b);
        });
        evaluate();
        if (mqFine.addEventListener) mqFine.addEventListener('change', evaluate);
        else if (mqFine.addListener) mqFine.addListener(evaluate);
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { evaluate(); positionDots(); }, 120);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return { init };
})();
