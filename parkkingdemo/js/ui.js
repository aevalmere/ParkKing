/* ============================================================
   PARK KING — UI
   DOM wiring: theme, geocode fields, pick/swap, collapsible
   filters, availability-rich result cards, the route summary
   (with a visible A* / nodes-explored readout), and a genuine
   top progress bar (no fake spinner).
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.UI = (() => {
    const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
    const el = id => document.getElementById(id);

    /* ---------- METRIC ICON SET ----------
       One consistent 1.8px-stroke, currentColor glyph set used everywhere a
       stat appears (result cards, detail stat boxes, hours row). The star is
       the sole filled glyph — a rating is conventionally a solid star. Shared
       on ParkSmart.icon so the detail pane draws the exact same set. */
    const ICON = {
        car: '<path d="M5 11l1.5-4.3A2 2 0 0 1 8.4 5.4h7.2a2 2 0 0 1 1.9 1.3L19 11"/><path d="M4 11h16a1 1 0 0 1 1 1v3.1a1 1 0 0 1-1 1h-1.1a1 1 0 0 1-1-1V15H6.1v.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1z"/><circle cx="7.4" cy="13.2" r="1.05"/><circle cx="16.6" cy="13.2" r="1.05"/>',
        tag: '<path d="M20.6 13.4l-7.1 7.1a1.7 1.7 0 0 1-2.4 0l-6.7-6.7a1.7 1.7 0 0 1-.5-1.2V5.1A1.1 1.1 0 0 1 4.9 4h7.4c.5 0 .9.2 1.2.5l6.9 6.5a1.7 1.7 0 0 1 .1 2.4z"/><circle cx="8.3" cy="8.3" r="1.25"/>',
        walk: '<circle cx="13" cy="4" r="1.7"/><path d="M12.6 8.1l-2.2 4.1 2 1.7.7 4.9"/><path d="M11.5 12.2l-2.1 4.4"/><path d="M13.9 10.4l2.7 1.2"/>',
        shield: '<path d="M12 21.5s7.2-3.6 7.2-9V5L12 2.4 4.8 5v7.5c0 5.4 7.2 9 7.2 9z"/>',
        star: '<path d="M12 3.3l2.6 5.35 5.9.86-4.25 4.14 1 5.89L12 16.9l-5.25 2.74 1-5.89L4.5 9.51l5.9-.86z"/>',
        clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.1 1.9"/>'
    };
    function ic(name, size, opts) {
        const filled = !!(opts && opts.fill);
        const s = size || 13;
        return `<svg class="ic ic-${name}" viewBox="0 0 24 24" width="${s}" height="${s}" ${filled ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8"'} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
    }
    ParkSmart.icon = ic;

    /* ---------- RECOMMENDATION SCORING ----------
       Composite score per spot, each factor normalized 0–1 within the current
       result set: distance 0.40 (closest best), price 0.25 (free best), safety
       0.20 (unknown = neutral 0.5), availability 0.15 (unknown = neutral 0.5).
       Also picks the single Closest and Cheapest (free wins; tie → closer).
       Stamps spot.isBest / isClosest / isCheapest — read by the cards, the
       detail header chips and the map's best-pin gold ring. */
    const WEIGHTS = { distance: 0.40, price: 0.25, safety: 0.20, availability: 0.15 };
    const effectiveRate = s => (s.feeStatus === 'free' ? 0 : (s.rate || 0));
    function rankRecommendations(spots) {
        spots.forEach(s => { s.isBest = false; s.isClosest = false; s.isCheapest = false; });
        if (!spots.length) return { bestId: null, closestId: null, cheapestId: null };
        const dists = spots.map(s => s.distance);
        const rates = spots.map(effectiveRate);
        const minD = Math.min(...dists), maxD = Math.max(...dists);
        const minR = Math.min(...rates), maxR = Math.max(...rates);
        let bestId = null, bestScore = -Infinity;
        let closestId = null, closestD = Infinity;
        let cheapestId = null, cheapestR = Infinity, cheapestTieD = Infinity;
        spots.forEach(s => {
            const distScore = maxD > minD ? (maxD - s.distance) / (maxD - minD) : 1;
            const rate = effectiveRate(s);
            const priceScore = maxR > minR ? (maxR - rate) / (maxR - minR) : 1;
            const safetyScore = s.safety != null ? Math.max(0, Math.min(1, s.safety / 5)) : 0.5;
            const availScore = (s.spacesFree != null && s.spacesTotal)
                ? Math.max(0, Math.min(1, s.spacesFree / s.spacesTotal)) : 0.5;
            const score = WEIGHTS.distance * distScore + WEIGHTS.price * priceScore
                + WEIGHTS.safety * safetyScore + WEIGHTS.availability * availScore;
            if (score > bestScore) { bestScore = score; bestId = s.id; }
            if (s.distance < closestD) { closestD = s.distance; closestId = s.id; }
            if (rate < cheapestR || (rate === cheapestR && s.distance < cheapestTieD)) { cheapestR = rate; cheapestId = s.id; cheapestTieD = s.distance; }
        });
        spots.forEach(s => { s.isBest = s.id === bestId; s.isClosest = s.id === closestId; s.isCheapest = s.id === cheapestId; });
        return { bestId, closestId, cheapestId };
    }
    // gold crown for the "Best match" chip
    function crownSvg() { return '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M4 8l3.7 2.8L12 4.6l4.3 6.2L20 8l-1.3 9H5.3z"/></svg>'; }
    function recChipsHtml(spot) {
        if (!spot) return '';
        const chips = [];
        if (spot.isBest) chips.push(`<span class="p-chip p-chip--best">${crownSvg()}Best match</span>`);
        if (spot.isClosest) chips.push(`<span class="p-chip p-chip--closest">Closest</span>`);
        if (spot.isCheapest) chips.push(`<span class="p-chip p-chip--cheap">Cheapest</span>`);
        return chips.length ? `<div class="p-chips">${chips.join('')}</div>` : '';
    }
    ParkSmart.recChips = recChipsHtml;

    function init() {
        bindTheme();
        bindDemoToggle();
        bindBrandToggle();
        bindGeocodeFields();
        bindStartControls();
        bindPickButtons();
        bindSwap();
        bindFilters();
        bindNearby();
        bindRouteSummary();
        bindPanelToggle();
        bindMapFabs();
        bindResponsiveDock();
        bindOutsideClose();
    }

    /* ---------- UNIFIED MAP CONTROLS (recenter + zoom) ---------- */
    function bindMapFabs() {
        el('fab-dest')?.addEventListener('click', () => { if (ParkSmart.recenterDestination) ParkSmart.recenterDestination(); });
        el('fab-start')?.addEventListener('click', () => { if (ParkSmart.recenterStart) ParkSmart.recenterStart(); });
        el('zoom-in')?.addEventListener('click', () => { if (ParkSmart.Map && ParkSmart.Map.zoomIn) ParkSmart.Map.zoomIn(); });
        el('zoom-out')?.addEventListener('click', () => { if (ParkSmart.Map && ParkSmart.Map.zoomOut) ParkSmart.Map.zoomOut(); });
    }

    /* ---------- RESPONSIVE DIRECTIONS DOCK ----------
       On mobile the Directions card lives at the TOP of the screen; on desktop
       it sits inside the panel. We physically relocate the node (rather than
       CSS-fix it) because the panel is a transformed bottom sheet, which would
       otherwise trap a position:fixed child. */
    function placeDirections() {
        const dir = document.querySelector('.directions');
        const dock = el('mobile-dir-dock');
        const body = document.querySelector('.panel-body');
        if (!dir || !dock || !body) return;
        const mobile = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
        if (mobile) {
            if (dir.parentElement !== dock) dock.appendChild(dir);
            dock.setAttribute('aria-hidden', 'false');
        } else {
            if (dir.parentElement !== body) body.insertBefore(dir, body.firstChild);
            dock.setAttribute('aria-hidden', 'true');
        }
    }
    function bindResponsiveDock() {
        placeDirections();
        let t = null;
        window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(placeDirections, 150); });
        if (window.matchMedia) {
            const mq = window.matchMedia('(max-width: 720px)');
            const onChange = () => placeDirections();
            if (mq.addEventListener) mq.addEventListener('change', onChange);
            else if (mq.addListener) mq.addListener(onChange);
        }
    }

    /* ---------- BRAND LOGO → slide the panel away / back ---------- */
    function bindBrandToggle() {
        const logo = el('brand-logo');
        const target = (logo && logo.closest('.brand')) || logo;
        if (!target) return;
        target.classList.add('brand-btn');
        target.setAttribute('role', 'button');
        target.setAttribute('tabindex', '0');
        target.setAttribute('aria-label', 'Hide or show the panel');
        target.setAttribute('aria-pressed', 'false');
        const toggle = () => {
            const p = el('panel'); if (!p) return;
            const hidden = p.classList.toggle('nav-collapsed');
            target.setAttribute('aria-pressed', String(hidden));
        };
        target.addEventListener('click', toggle);
        target.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    }

    /* ---------- DEMO / REAL MODE ---------- */
    function bindDemoToggle() {
        const seg = el('mode-toggle');
        if (!seg) return;
        seg.addEventListener('click', (e) => {
            const b = e.target.closest('[data-mode]'); if (!b) return;
            const demo = b.dataset.mode === 'demo';
            seg.querySelectorAll('[data-mode]').forEach(x => {
                const on = x === b;
                x.classList.toggle('active', on);
                x.setAttribute('aria-pressed', String(on));
            });
            if (ParkSmart.setDemoMode) ParkSmart.setDemoMode(demo);
        });
    }

    /* ---------- THEME ---------- */
    function setBrandLogo() {
        // The brand mark is now an inline crown + wordmark that adapts to the
        // theme via CSS (currentColor), so there is no raster logo to swap.
    }
    function bindTheme() {
        const btn = el('theme-toggle');
        const iDark = el('theme-icon-dark'), iLight = el('theme-icon-light');
        // default to LIGHT mode
        if (!document.documentElement.hasAttribute('data-theme')) document.documentElement.setAttribute('data-theme', 'light');
        setBrandLogo(document.documentElement.getAttribute('data-theme') || 'light');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') || 'light';
            const next = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#eef2f7' : '#070b14');
            setBrandLogo(next);
            if (iDark && iLight) { iDark.classList.toggle('hidden', next === 'light'); iLight.classList.toggle('hidden', next !== 'light'); }
            if (ParkSmart.Map && ParkSmart.Map.setTheme) ParkSmart.Map.setTheme(next);
        });
    }

    /* ---------- GEOCODE FIELDS ---------- */
    function bindGeocodeFields() {
        bindField('start-input', 'start-results', null, (lat, lng, name) => {
            if (ParkSmart.setStart) { ParkSmart.setStart(lat, lng, name); ParkSmart.Map.flyTo(lat, lng, 15); }
        });
        bindField('search-input', 'search-results', 'search-clear', (lat, lng, name) => {
            if (ParkSmart.setDestination) ParkSmart.setDestination(lat, lng, name);
        });
    }

    function bindField(inputId, resultsId, clearId, onPick) {
        const input = el(inputId), results = el(resultsId);
        const clearBtn = clearId ? el(clearId) : null;
        if (!input || !results) return;
        let timer = null;
        input.addEventListener('input', () => {
            const q = input.value.trim();
            if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);
            if (q.length < 3) { results.classList.add('hidden'); return; }
            clearTimeout(timer);
            timer = setTimeout(() => geocode(q, results, input, onPick), 340);
        });
        input.addEventListener('focus', () => {
            // Directions is docked at the top on mobile, so its dropdown always
            // has room — no need to disturb the bottom sheet on focus.
            const q = input.value.trim();
            if (q.length >= 3) { clearTimeout(timer); timer = setTimeout(() => geocode(q, results, input, onPick), 180); }
        });
        if (clearBtn) clearBtn.addEventListener('click', () => {
            input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus();
        });
    }

    function mapCenter() {
        try {
            const map = ParkSmart.Map && ParkSmart.Map.getMap && ParkSmart.Map.getMap();
            if (!map) return null;
            const c = map.getCenter();
            return [c.lat, c.lng];
        } catch (e) { return null; }
    }
    // bias results toward the user's current map area (their town), not the
    // whole world — a tight soft viewbox around the map centre
    function biasParams() {
        const c = mapCenter();
        if (!c) return '';
        const dLat = 0.22, dLng = 0.28; // ~town scale
        return `&viewbox=${(c[1] - dLng).toFixed(4)},${(c[0] + dLat).toFixed(4)},${(c[1] + dLng).toFixed(4)},${(c[0] - dLat).toFixed(4)}&bounded=0`;
    }
    function haversineKm(a, b) {
        const R = 6371, toRad = d => d * Math.PI / 180;
        const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
    /* ---------- SEARCH RANKING (Google-Maps-style) ----------
       Re-rank the Nominatim candidates client-side. Score per result =
         2.2·importance (0.30 when missing)
       + 1.6·proximity (exp(−km_from_map_centre / 25))
       + type boost (city/town/village/suburb +0.35 · amenity/POI +0.25 · road +0.10)
       + name-match boost (+0.40 starts-with · +0.20 word-boundary).
       Sort desc, dedupe (same name + ~same coords), keep the top 8. Robust to
       minimal result objects (missing importance / type / address). `center` is
       optional (defaults to the map centre) so the ranker is unit-testable. */
    function rankGeoResults(results, query, center) {
        const c = center || mapCenter();
        const q = String(query || '').toLowerCase().trim();
        const qEsc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRe = q ? new RegExp('\\b' + qEsc) : null;
        const scored = (Array.isArray(results) ? results : []).map(r => {
            const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
            const importance = (typeof r.importance === 'number') ? r.importance : 0.30;
            let km = null, proximity = 0.5;
            if (c && isFinite(lat) && isFinite(lon)) { km = haversineKm(c, [lat, lon]); proximity = Math.exp(-km / 25); }
            const cls = String(r.class || r.category || '').toLowerCase();
            const typ = String(r.type || '').toLowerCase();
            let typeBoost = 0;
            if (['city', 'town', 'village', 'suburb'].indexOf(typ) >= 0) typeBoost = 0.35;
            else if (['amenity', 'shop', 'tourism', 'leisure', 'office', 'building', 'railway', 'aeroway'].indexOf(cls) >= 0) typeBoost = 0.25;
            else if (cls === 'highway' || typ === 'road' || typ === 'residential') typeBoost = 0.10;
            const primary = String((r.display_name || r.name || '').split(',')[0] || '').toLowerCase().trim();
            let nameBoost = 0;
            if (q && primary) {
                if (primary.indexOf(q) === 0) nameBoost = 0.40;
                else if (wordRe && wordRe.test(primary)) nameBoost = 0.20;
            }
            const score = 2.2 * importance + 1.6 * proximity + typeBoost + nameBoost;
            return { r, km, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const out = [];
        for (const s of scored) {
            const nm = String(s.r.display_name || '').split(',').slice(0, 2).join(',').toLowerCase().trim();
            const la = parseFloat(s.r.lat), lo = parseFloat(s.r.lon);
            const dup = out.some(o => o._nm === nm && Math.abs(o._la - la) < 0.001 && Math.abs(o._lo - lo) < 0.001);
            if (dup) continue;
            s._nm = nm; s._la = la; s._lo = lo;
            out.push(s);
            if (out.length >= 8) break;
        }
        return out;
    }
    function fmtKm(km) { return km >= 1 ? `${km.toFixed(1)} km` : `${Math.max(0, Math.round(km * 1000))} m`; }

    async function geocode(query, listEl, inputEl, onPick) {
        progressStart();
        try {
            // pull more candidates than we show, then rank Maps-style client-side
            const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=12&addressdetails=1${biasParams()}`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const results = await res.json();
            renderGeoResults(rankGeoResults(results, query), listEl, inputEl, onPick);
        } catch (err) {
            console.warn('Geocode failed:', err && err.message);
            renderGeoResults([], listEl, inputEl, onPick);
        } finally { progressDone(); }
    }

    // items: the scored array from rankGeoResults ({ r, km, score })
    function renderGeoResults(items, listEl, inputEl, onPick) {
        listEl.innerHTML = '';
        if (!items || items.length === 0) {
            listEl.innerHTML = '<li class="no-results"><span class="result-name">No matches found</span></li>';
            listEl.classList.remove('hidden');
            return;
        }
        items.forEach((item, i) => {
            const r = item.r;
            const li = document.createElement('li');
            li.style.animationDelay = `${i * 35}ms`;
            li.setAttribute('role', 'option');
            const parts = String(r.display_name || '').split(',');
            const hint = item.km != null ? `<span class="result-dist">${fmtKm(item.km)}</span>` : '';
            li.innerHTML = `
                <span class="result-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
                <div class="result-text"><span class="result-name">${escapeHtml(parts.slice(0, 2).join(','))}</span><span class="result-address">${escapeHtml(parts.slice(2, 4).join(',').trim())}</span></div>
                ${hint}`;
            li.addEventListener('click', () => {
                const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                const name = parts.slice(0, 2).join(',');
                inputEl.value = name;
                listEl.classList.add('hidden');
                onPick(lat, lng, name);
            });
            listEl.appendChild(li);
        });
        listEl.classList.remove('hidden');
    }

    function bindOutsideClose() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#start-field')) el('start-results')?.classList.add('hidden');
            if (!e.target.closest('#dest-field')) el('search-results')?.classList.add('hidden');
        });
    }

    /* ---------- START CONTROLS + PICK ---------- */
    function bindStartControls() {
        const locate = el('start-locate');
        if (locate) locate.addEventListener('click', () => { if (ParkSmart.useMyLocation) ParkSmart.useMyLocation(); });
    }
    function bindPickButtons() {
        const sp = el('start-pick'), dp = el('dest-pick');
        if (sp) sp.addEventListener('click', () => togglePick('start'));
        if (dp) dp.addEventListener('click', () => togglePick('destination'));
    }
    function togglePick(target) {
        const btn = el(target === 'start' ? 'start-pick' : 'dest-pick');
        const willArm = !btn.classList.contains('armed');
        disarmPick();
        if (willArm) {
            btn.classList.add('armed');
            if (target === 'start') btn.classList.add('armed-start');
            btn.setAttribute('aria-pressed', 'true');
            if (ParkSmart.setMapPickTarget) ParkSmart.setMapPickTarget(target);
        } else { hideMapHint(); }
    }
    function disarmPick() {
        ['start-pick', 'dest-pick'].forEach(id => {
            const b = el(id);
            if (b) { b.classList.remove('armed', 'armed-start'); b.setAttribute('aria-pressed', 'false'); }
        });
        if (ParkSmart.resetMapPick) ParkSmart.resetMapPick();
    }
    function armStartPick() {
        disarmPick();
        const sp = el('start-pick');
        if (sp) { sp.classList.add('armed', 'armed-start'); sp.setAttribute('aria-pressed', 'true'); }
        if (ParkSmart.setMapPickTarget) ParkSmart.setMapPickTarget('start');
    }
    function showMapHint(text) { const h = el('map-pick-hint'); if (!h) return; h.textContent = text; h.classList.remove('hidden'); }
    function hideMapHint() { el('map-pick-hint')?.classList.add('hidden'); }

    /* ---------- SWAP ---------- */
    function bindSwap() {
        const b = el('swap-btn');
        if (b) b.addEventListener('click', () => { if (ParkSmart.swapEndpoints) ParkSmart.swapEndpoints(); });
    }

    /* ---------- FILTER DEFAULTS (single source of truth) ----------
       Every place that reads or resets a filter agrees with this: the HTML
       value attributes, the label spans, applyFilters()'s reads, the active-
       filter count, and Reset. "If something is displayed then it is actual." */
    const DEFAULTS = { walk: 1000, price: 12, safety: 0, types: ['surface', 'underground', 'multi-storey', 'street_side', 'rooftop'], features: [] };
    function walkLabel(v) { return v >= 1000 ? `${(v / 1000).toFixed(1)}km` : `${v}m`; }
    function safetyLabelText(v) { return v > 0 ? `${v.toFixed(1)}+ ★` : 'Any'; }   // 0 = Any
    function priceLabel(slider) {
        const v = parseInt(slider.value), max = parseInt(slider.max);
        if (v >= max) return 'Any';   // max = "Any" — and getFilters() filters it as Any
        if (v <= 0) return 'Free';
        return `$${v}/hr`;
    }
    // write every label from the controls' current values — guarantees the
    // labels never drift from what will actually be filtered.
    function syncFilterLabels() {
        const walk = el('walking-distance-slider'); if (walk) { const w = el('walking-distance-value'); if (w) w.textContent = walkLabel(parseInt(walk.value)); }
        const price = el('price-slider'); if (price) { const p = el('price-value'); if (p) p.textContent = priceLabel(price); }
        const safety = el('safety-slider'); if (safety) { const s = el('safety-value'); if (s) s.textContent = safetyLabelText(parseFloat(safety.value)); }
    }
    function resetFilters() {
        const walk = el('walking-distance-slider'); if (walk) walk.value = String(DEFAULTS.walk);
        const price = el('price-slider'); if (price) price.value = String(DEFAULTS.price);
        const safety = el('safety-slider'); if (safety) safety.value = String(DEFAULTS.safety);
        document.querySelectorAll('#parking-type-chips .chip').forEach(c => {
            const on = DEFAULTS.types.includes(c.dataset.value);
            c.classList.toggle('active', on); c.setAttribute('aria-pressed', String(on));
        });
        document.querySelectorAll('#feature-chips .chip').forEach(c => {
            const on = DEFAULTS.features.includes(c.dataset.value);
            c.classList.toggle('active', on); c.setAttribute('aria-pressed', String(on));
        });
        syncFilterLabels();
        onFilterChange();   // re-render results immediately; count returns to 0
    }

    /* ---------- FILTERS ---------- */
    function bindFilters() {
        syncFilterLabels();   // labels match the controls at load
        const head = el('filters-head'), filters = el('filters');
        if (head && filters) {
            const toggle = () => {
                const open = filters.classList.toggle('open');
                head.setAttribute('aria-expanded', String(open));
            };
            head.addEventListener('click', toggle);
            head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        }
        const reset = el('filters-reset');
        if (reset) reset.addEventListener('click', (e) => { e.stopPropagation(); resetFilters(); });
        const walk = el('walking-distance-slider'), walkVal = el('walking-distance-value');
        if (walk) walk.addEventListener('input', () => {
            if (walkVal) walkVal.textContent = walkLabel(parseInt(walk.value));
            onFilterChange();
        });
        const price = el('price-slider'), priceVal = el('price-value');
        if (price) price.addEventListener('input', () => {
            if (priceVal) priceVal.textContent = priceLabel(price);
            onFilterChange();
        });
        const safety = el('safety-slider'), safetyVal = el('safety-value');
        if (safety) safety.addEventListener('input', () => {
            if (safetyVal) safetyVal.textContent = safetyLabelText(parseFloat(safety.value));
            onFilterChange();
        });
        // multi-select chip groups: parking type + features (covered / wheelchair)
        ['parking-type-chips', 'feature-chips'].forEach(id => {
            const grp = el(id);
            if (grp) grp.addEventListener('click', (e) => {
                const chip = e.target.closest('.chip'); if (!chip) return;
                chip.classList.toggle('active');
                chip.setAttribute('aria-pressed', String(chip.classList.contains('active')));
                onFilterChange();
            });
        });
    }
    function onFilterChange() { if (ParkSmart.applyFilters) ParkSmart.applyFilters(); }

    /* ---------- NEARBY PARKING (collapsible) ---------- */
    function bindNearby() {
        const head = el('nearby-head'), nearby = el('nearby');
        if (!head || !nearby) return;
        const toggle = () => {
            const open = nearby.classList.toggle('open');
            head.setAttribute('aria-expanded', String(open));
        };
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    }

    function getFilters() {
        const maxWalkingDistance = parseInt(el('walking-distance-slider').value);
        const parkingTypes = [];
        document.querySelectorAll('#parking-type-chips .chip.active').forEach(c => parkingTypes.push(c.dataset.value));
        const priceEl = el('price-slider');
        const pv = priceEl ? parseInt(priceEl.value) : NaN;
        const maxPrice = (priceEl && pv < parseInt(priceEl.max)) ? pv : null; // null = Any price
        const safetyEl = el('safety-slider');
        const minSafety = safetyEl ? parseFloat(safetyEl.value) : 0;
        const feats = new Set();
        document.querySelectorAll('#feature-chips .chip.active').forEach(c => feats.add(c.dataset.value));
        return {
            maxWalkingDistance, parkingTypes, maxPrice, minSafety,
            coveredOnly: feats.has('covered'),
            wheelchairOnly: feats.has('wheelchair')
        };
    }
    function updateFilterCount() {
        // count non-default filters engaged
        let n = 0;
        const types = document.querySelectorAll('#parking-type-chips .chip').length;
        const activeTypes = document.querySelectorAll('#parking-type-chips .chip.active').length;
        if (types && activeTypes < types) n++;
        const price = el('price-slider'); if (price && parseInt(price.value) < parseInt(price.max)) n++;
        const safety = el('safety-slider'); if (safety && parseFloat(safety.value) > DEFAULTS.safety) n++;
        n += document.querySelectorAll('#feature-chips .chip.active').length;
        const walk = el('walking-distance-slider'); if (walk && parseInt(walk.value) !== DEFAULTS.walk) n++;
        const badge = el('filters-count');
        if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n === 0); }
        const reset = el('filters-reset');
        if (reset) reset.classList.toggle('hidden', n === 0);   // Reset appears only when a filter is engaged
    }

    /* ---------- RESULTS ---------- */
    // one colour meaning everywhere: free = green, paid = gold, full = red
    const KEYC = { free: 'var(--free)', paid: 'var(--paid)', full: 'var(--full)' };

    function renderResults(spots, destination) {
        const list = el('results-list'), count = el('results-count');
        count.textContent = spots.length;
        rankRecommendations(spots);   // stamp isBest / isClosest / isCheapest before drawing
        updateFilterCount();
        list.innerHTML = '';
        if (spots.length === 0) {
            list.innerHTML = `
                <div class="results-placeholder">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <p>No parking matches these filters. Try a wider walking distance or fewer restrictions.</p>
                </div>`;
            return;
        }
        spots.forEach((spot, i) => {
            const ck = spot.colorKey;
            const feeHtml = spot.feeStatus === 'free'
                ? `<span class="p-stat free">${ic('tag')}Free</span>`
                : spot.rate
                    ? `<span class="p-stat price">${ic('tag')}${escapeHtml(spot.charge || ('$' + spot.rate + '/hr'))}</span>`
                    : `<span class="p-stat">${ic('tag')}Fee unknown</span>`;
            const spacesHtml = (spot.spacesFree != null && spot.spacesTotal != null)
                ? `<span class="p-spaces ${ck}" title="Spaces available now">${ic('car', 12)}${spot.spacesFree}/${spot.spacesTotal}<small>spaces</small></span>`
                : spot.spacesTotal != null
                    ? `<span class="p-spaces cap" title="Total capacity — live availability not published">${ic('car', 12)}${spot.spacesTotal}<small>capacity</small></span>`
                    : `<span class="p-spaces nodata" title="No live space data published">No data</span>`;
            const card = document.createElement('div');
            card.className = 'p-card' + (spot.isBest ? ' p-card--best' : '');
            card.dataset.id = spot.id;
            card.style.animationDelay = `${Math.min(i * 45, 400)}ms`;
            card.style.setProperty('--avail', KEYC[ck] || 'var(--fg-faint)');
            card.innerHTML = `
                ${recChipsHtml(spot)}
                <div class="p-card-top">
                    <span class="p-name">${spot.kind === 'street' ? '<svg class="ic-street" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 20 20 4M9 4v3M15 17v3M12 10v3"/></svg>' : ''}${escapeHtml(spot.name)}</span>
                    ${spacesHtml}
                </div>
                <div class="p-meta">
                    <span class="p-stat">${ic('walk')}${spot.distanceFormatted}</span>
                    <span class="p-stat">${ic('clock')}${spot.walkTime} walk</span>
                    <span class="p-stat">${escapeHtml(spot.typeLabel || spot.parkingType)}</span>
                    ${feeHtml}
                    ${spot.rating != null ? `<span class="p-stat rate" title="${spot.ratingCount} reviews">${ic('star', 13, { fill: true })}${spot.rating.toFixed(1)}</span>` : ''}
                    ${spot.safety != null ? `<span class="p-stat safety" title="Safety rating">${ic('shield')}${escapeHtml(spot.safetyLabel)}</span>` : ''}
                </div>
                <div class="p-actions">
                    <button class="btn btn-primary" data-nav aria-label="Navigate to ${escapeHtml(spot.name)}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Navigate
                    </button>
                    <button class="btn btn-ghost" data-details aria-label="View details and reviews for ${escapeHtml(spot.name)}">Details</button>
                </div>`;
            card.querySelector('[data-nav]').addEventListener('click', (e) => { e.stopPropagation(); if (ParkSmart.startNavigation) ParkSmart.startNavigation(spot.id); });
            card.querySelector('[data-details]').addEventListener('click', (e) => { e.stopPropagation(); if (ParkSmart.onSpotClick) ParkSmart.onSpotClick(spot); });
            card.addEventListener('click', () => { if (ParkSmart.onSpotClick) ParkSmart.onSpotClick(spot); });
            list.appendChild(card);
        });
    }
    function selectCard(spotId) {
        document.querySelectorAll('.p-card').forEach(c => c.classList.toggle('selected', c.dataset.id === spotId));
    }

    /* ---------- ROUTE SUMMARY ---------- */
    function fmtDuration(sec) {
        const m = Math.round(sec / 60);
        if (m < 1) return '<1 min';
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60), mm = m % 60;
        return mm ? `${h} hr ${mm} min` : `${h} hr`;
    }
    const SOURCE_LABEL = { osm: 'OSM roads', grid: 'local street grid', road: 'live road router', direct: 'direct line' };
    function legSub(leg) {
        if (leg.engine === 'astar') return `A* · ${SOURCE_LABEL[leg.source] || 'road network'}${leg.explored > 0 ? ` · ${leg.explored} nodes explored` : ''}`;
        if (leg.engine === 'road') return 'Live road router';
        return 'straight-line estimate';
    }

    function showRouteSummary(s) {
        const dist = ParkSmart.Parking.formatDistance;
        el('rs-eta').textContent = fmtDuration(s.total.duration);
        el('rs-dist').textContent = dist(s.total.distance);

        const badge = el('engine-badge');
        badge.className = 'engine-badge' + (s.engine === 'road' ? ' road' : (s.engine === 'direct' ? ' direct' : ''));
        badge.innerHTML = s.engine === 'astar' ? '<span class="star">★</span> A*'
            : s.engine === 'road' ? 'Road' : 'Direct';
        badge.title = s.engine === 'astar' ? `A* search over the OSM road network — explored ${s.explored} nodes`
            : s.engine === 'road' ? 'Fastest route via the live road router'
                : 'Straight-line estimate (road data unavailable)';

        el('drive-meta').textContent = `${dist(s.drive.distance)} · ${fmtDuration(s.drive.duration)}`;
        el('walk-meta').textContent = `${dist(s.walk.distance)} · ${fmtDuration(s.walk.duration)}`;
        const dsub = el('drive-sub'); if (dsub) dsub.textContent = legSub(s.drive);
        const wsub = el('walk-sub'); if (wsub) wsub.textContent = legSub(s.walk);

        el('route-summary').classList.remove('hidden');
        document.body.classList.add('route-open');
    }
    function hideRouteSummary() {
        el('route-summary').classList.add('hidden');
        document.body.classList.remove('route-open');
    }
    function bindRouteSummary() {
        el('rs-clear')?.addEventListener('click', () => { if (ParkSmart.clearRoute) ParkSmart.clearRoute(); });
        el('rs-clear2')?.addEventListener('click', () => { if (ParkSmart.clearRoute) ParkSmart.clearRoute(); });
        el('sim-btn')?.addEventListener('click', () => { if (ParkSmart.simulateJourney) ParkSmart.simulateJourney(); });
    }

    /* ---------- PANEL TOGGLE (mobile) ---------- */
    function bindPanelToggle() {
        const t = el('panel-toggle'), panel = el('panel');
        if (t && panel) {
            t.addEventListener('click', () => panel.classList.toggle('open'));
            // tap the drag handle / header area to collapse on mobile
            panel.addEventListener('click', (e) => {
                if (e.target === panel && panel.classList.contains('open')) panel.classList.remove('open');
            });
        }
    }
    function openPanel() { el('panel')?.classList.add('open'); }

    /* ---------- PROGRESS BAR (genuine work only) ---------- */
    let pCount = 0, pTimer = null;
    function progressStart() {
        pCount++;
        const b = el('progress-bar'); if (!b) return;
        clearTimeout(pTimer);
        b.classList.add('active');
        b.style.width = pCount > 1 ? '85%' : '72%';
    }
    function progressDone() {
        pCount = Math.max(0, pCount - 1);
        if (pCount > 0) return;
        const b = el('progress-bar'); if (!b) return;
        b.style.width = '100%';
        clearTimeout(pTimer);
        pTimer = setTimeout(() => { b.classList.remove('active'); b.style.width = '0'; }, 260);
    }

    /* ---------- TOAST ---------- */
    function showToast(message, type = 'info') {
        const t = el('toast');
        t.textContent = message;
        t.className = '';
        if (type === 'error') t.classList.add('error');
        else if (type === 'success') t.classList.add('success');
        t.classList.remove('hidden');
        // force reflow so the transition runs
        void t.offsetWidth;
        t.classList.add('show');
        clearTimeout(t._timeout);
        t._timeout = setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.classList.add('hidden'), 260);
        }, 3600);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    return {
        init, getFilters,
        renderResults, selectCard,
        showRouteSummary, hideRouteSummary,
        showMapHint, hideMapHint, disarmPick, armStartPick,
        progressStart, progressDone, openPanel,
        showToast, rankGeoResults, recChipsHtml
    };
})();
