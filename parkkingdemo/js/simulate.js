/* ============================================================
   PARK KING — Simulate
   Plays the computed journey: a vehicle drives the road route to
   the parking, then a walker continues to the destination.
   Constant-speed interpolation (rAF, GPU transforms), a live
   real-time ETA countdown, play / pause / restart / speed, and a
   gentle keep-in-view camera. Honours prefers-reduced-motion.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Simulate = (() => {
    let bound = false;
    let raf = 0;
    let mover = null;
    let legs = [];
    let legIdx = 0;
    let acc = 0;           // ms elapsed within current leg (speed-scaled)
    let lastNow = 0;
    let camLat = 0, camLng = 0, camReady = false, followStart = 0;
    let playing = false;
    let speed = 1;
    let totalRealDur = 0;
    let running = false;

    const R = 6371000;
    function haversine(a, b) {
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
    function fmtDur(sec) {
        const m = Math.max(0, Math.round(sec / 60));
        if (m < 1) return '<1 min';
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60), mm = m % 60;
        return mm ? `${h} hr ${mm} min` : `${h} hr`;
    }
    function fmtDist(m) { return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`; }
    const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function el(id) { return document.getElementById(id); }

    function buildLeg(type, coords, realDur) {
        if (!coords || coords.length < 2) return null;
        const cum = [0];
        for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
        const total = cum[cum.length - 1];
        if (total < 1) return null;
        // base (1×) is deliberately gentle; the 2×/4× buttons are there to speed up
        const screenMs = reduced() ? 700 : Math.max(3400, Math.min(16000, realDur * 34));
        return { type, coords, cum, total, realDur, screenMs };
    }

    // position + heading at fraction f (0..1) along a leg
    function at(leg, f) {
        const target = Math.max(0, Math.min(1, f)) * leg.total;
        const cum = leg.cum;
        let i = 1;
        while (i < cum.length && cum[i] < target) i++;
        if (i >= cum.length) return leg.coords[leg.coords.length - 1];
        const segLen = cum[i] - cum[i - 1] || 1;
        const t = (target - cum[i - 1]) / segLen;
        const a = leg.coords[i - 1], b = leg.coords[i];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    function distBefore(idx) {
        let d = 0; for (let i = 0; i < idx; i++) d += legs[i].realDur; return d;
    }

    function setMoverType(type) {
        if (mover) ParkSmart.Map.removeMover(mover);
        mover = ParkSmart.Map.createMover(type === 'walk' ? 'walker' : 'vehicle');
    }

    // smooth chase camera: ease the centre toward the vehicle every frame so the
    // map glides instead of stepping. `now` gates the intro zoom-in.
    function follow(pos, now) {
        try {
            const map = ParkSmart.Map.getMap && ParkSmart.Map.getMap();
            if (!map || now < followStart) return;
            if (!camReady) { camLat = pos[0]; camLng = pos[1]; camReady = true; }
            else {
                const k = 0.14 + 0.03 * speed;           // ease factor, a touch tighter at higher speeds
                camLat += (pos[0] - camLat) * k;
                camLng += (pos[1] - camLng) * k;
            }
            map.panTo([camLat, camLng], { animate: false });
        } catch (e) { /* no-op */ }
    }

    function updateHud() {
        const leg = legs[legIdx];
        const f = Math.max(0, Math.min(1, acc / leg.screenMs));
        const legDone = f * leg.realDur;
        const realElapsed = distBefore(legIdx) + legDone;
        const remaining = Math.max(0, totalRealDur - realElapsed);
        const globalFrac = totalRealDur > 0 ? realElapsed / totalRealDur : f;

        const isWalk = leg.type === 'walk';
        const badge = el('hud-badge');
        if (badge) badge.classList.toggle('walk', isWalk);
        const phase = el('hud-phase');
        if (phase) phase.textContent = isWalk ? 'Walking to destination' : 'Driving to parking';
        const sub = el('hud-sub');
        if (sub) sub.textContent = `${fmtDist(leg.total * (1 - f))} left on this leg`;
        const eta = el('hud-eta');
        if (eta) eta.textContent = fmtDur(remaining);
        const bar = el('hud-bar');
        if (bar) bar.style.width = (globalFrac * 100).toFixed(1) + '%';
    }

    function tick(now) {
        if (!running) return;
        const dt = now - lastNow; lastNow = now;
        if (playing) acc += dt * speed;

        let leg = legs[legIdx];
        // advance across finished legs
        while (acc >= leg.screenMs && legIdx < legs.length - 1) {
            acc -= leg.screenMs;
            legIdx++;
            leg = legs[legIdx];
            setMoverType(leg.type);
        }

        const f = Math.min(1, acc / leg.screenMs);
        const pos = at(leg, f);
        if (mover) mover.setLatLng(pos);
        // lay the gold "already-travelled" trail behind the mover (throttled)
        if (playing && ParkSmart.Map.pushTrail) ParkSmart.Map.pushTrail(pos[0], pos[1]);
        // follow the vehicle every frame (smoothly eased) so the map never jumps
        if (playing) follow(pos, now);
        updateHud();

        if (legIdx >= legs.length - 1 && f >= 1) { finish(); return; }
        raf = requestAnimationFrame(tick);
    }

    function finish() {
        playing = false;
        setPlayIcon(false);
        const bar = el('hud-bar'); if (bar) bar.style.width = '100%';
        const phase = el('hud-phase'); if (phase) phase.textContent = 'Arrived at destination';
        const sub = el('hud-sub'); if (sub) sub.textContent = 'Journey complete';
        const eta = el('hud-eta'); if (eta) eta.textContent = fmtDur(0);
        if (mover && legs.length) mover.setLatLng(legs[legs.length - 1].coords.slice(-1)[0]);
    }

    function setPlayIcon(isPlaying) {
        const pause = el('hud-icon-pause'), play = el('hud-icon-play'), btn = el('hud-playpause');
        if (pause) pause.classList.toggle('hidden', !isPlaying);
        if (play) play.classList.toggle('hidden', isPlaying);
        if (btn) btn.setAttribute('aria-label', isPlaying ? 'Pause simulation' : 'Play simulation');
    }

    function bindControls() {
        if (bound) return; bound = true;
        const pp = el('hud-playpause'); if (pp) pp.addEventListener('click', toggle);
        const rs = el('hud-restart'); if (rs) rs.addEventListener('click', restart);
        const st = el('hud-stop'); if (st) st.addEventListener('click', () => stop(true));
        const sp = el('hud-speed');
        if (sp) sp.addEventListener('click', (e) => {
            const opt = e.target.closest('.speed-opt'); if (!opt) return;
            setSpeed(parseInt(opt.dataset.speed, 10) || 1);
        });
    }

    function start(route) {
        if (!route || !route.drive) { ParkSmart.UI && ParkSmart.UI.showToast('Compute a route first', 'error'); return; }
        stop();
        bindControls();

        legs = [
            buildLeg('drive', route.drive.coords, route.drive.duration || 0),
            buildLeg('walk', route.walk && route.walk.coords, (route.walk && route.walk.duration) || 0)
        ].filter(Boolean);
        if (!legs.length) { ParkSmart.UI && ParkSmart.UI.showToast('Route too short to simulate', 'error'); return; }

        totalRealDur = legs.reduce((s, l) => s + l.realDur, 0);
        legIdx = 0; acc = 0; speed = 1; playing = true; running = true;

        // reflect default speed in UI
        document.querySelectorAll('#hud-speed .speed-opt').forEach(o => o.classList.toggle('active', o.dataset.speed === '1'));
        setPlayIcon(true);
        setMoverType(legs[0].type);
        mover.setLatLng(legs[0].coords[0]);
        if (ParkSmart.Map.startTrail) { ParkSmart.Map.startTrail(); ParkSmart.Map.pushTrail(legs[0].coords[0][0], legs[0].coords[0][1]); }

        const hud = el('sim-hud'); if (hud) hud.classList.remove('hidden');
        updateHud();

        lastNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        // chase camera: zoom to the vehicle, then ease-follow it (delay the follow
        // so it doesn't fight the intro zoom-in)
        camReady = false;
        try {
            const mp = ParkSmart.Map.getMap();
            if (mp && !reduced()) { mp.flyTo(legs[0].coords[0], Math.max(mp.getZoom(), 16), { duration: 0.7 }); followStart = lastNow + 760; }
            else followStart = 0;
        } catch (e) { followStart = 0; }
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    }

    function toggle() {
        if (!running) return;
        // if finished, toggle acts as restart
        if (legIdx >= legs.length - 1 && acc >= legs[legs.length - 1].screenMs) { restart(); return; }
        playing = !playing;
        setPlayIcon(playing);
        lastNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    }

    function restart() {
        if (!legs.length) return;
        legIdx = 0; acc = 0; playing = true; running = true;
        setPlayIcon(true);
        setMoverType(legs[0].type);
        mover.setLatLng(legs[0].coords[0]);
        if (ParkSmart.Map.startTrail) { ParkSmart.Map.startTrail(); ParkSmart.Map.pushTrail(legs[0].coords[0][0], legs[0].coords[0][1]); }
        updateHud();
        lastNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        camReady = false; followStart = lastNow;   // re-centre cleanly on restart
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    }

    function setSpeed(n) {
        speed = n;
        document.querySelectorAll('#hud-speed .speed-opt').forEach(o => o.classList.toggle('active', parseInt(o.dataset.speed, 10) === n));
    }

    function stop(refit) {
        running = false; playing = false;
        cancelAnimationFrame(raf); raf = 0;
        if (mover) { ParkSmart.Map.removeMover(mover); mover = null; }
        if (ParkSmart.Map.clearTrail) ParkSmart.Map.clearTrail();
        const hud = el('sim-hud'); if (hud) hud.classList.add('hidden');
        // when the user explicitly stops, restore the whole-route overview
        if (refit === true) {
            try {
                const all = legs.flatMap(l => l.coords);
                if (all.length) ParkSmart.Map.fitBounds(L.latLngBounds(all), [90, 90]);
            } catch (e) { /* no-op */ }
        }
    }

    function isRunning() { return running; }

    return { start, stop, toggle, restart, setSpeed, isRunning };
})();
