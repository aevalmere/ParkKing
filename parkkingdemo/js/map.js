/* ============================================================
   PARK KING — Map
   Leaflet map, themed markers, blue road-route rendering with a
   draw-on reveal, and movers for the journey simulation.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Map = (() => {
    let map = null;
    let destinationMarker = null;
    let startMarker = null;
    let parkingMarkers = [];
    let routeLayers = [];
    let baseTile = null;
    let routeRenderer = null;
    let trailRenderer = null;
    let trailLine = null;
    let trailPts = [];

    function cssVar(name, fallback) {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return v || fallback;
        } catch (e) { return fallback; }
    }

    // Real-world basemaps. CartoDB styled tiles are the primary source; if
    // that CDN can't be reached we fall back to the canonical OpenStreetMap
    // tiles so the map always renders real streets.
    // Light theme = CARTO Voyager (colourful); dark theme = CARTO Dark Matter
    // (a genuine near-black cartography). The base layer's URL is swapped on
    // theme change — no CSS hue filter.
    const CARTO_VOYAGER = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const OSM_STD = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let fellBack = false;
    function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
    function tileUrlFor(theme) { return theme === 'dark' ? CARTO_DARK : CARTO_VOYAGER; }

    function init() {
        map = L.map('map', {
            center: [40.7128, -74.006],
            zoom: 13,
            zoomControl: false,
            attributionControl: true,
            doubleClickZoom: false      // double-click drops the destination pin instead
        });

        const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';
        // start on the basemap that matches the current (saved) theme
        baseTile = L.tileLayer(tileUrlFor(currentTheme()), { attribution, subdomains: 'abcd', maxZoom: 20 });
        let errs = 0;
        baseTile.on('tileerror', () => { if (++errs >= 6) osmFallback(); });
        baseTile.addTo(map);

        // dedicated SVG renderer with generous padding so route lines are never
        // clipped away while the chase-camera pans/zooms during a simulation
        routeRenderer = L.svg({ padding: 2 });

        // a pane ABOVE the route lines for the gold "already-travelled" trail
        map.createPane('pk-trail');
        map.getPane('pk-trail').style.zIndex = 450;         // overlay 400 < trail 450 < markers 600
        trailRenderer = L.svg({ padding: 2, pane: 'pk-trail' });

        // no Leaflet zoom control — a single unified control stack (recenter +
        // zoom) lives in #map-controls and drives the map via zoomIn/zoomOut

        map.on('click', (e) => {
            if (ParkSmart.onMapClick) ParkSmart.onMapClick(e.latlng.lat, e.latlng.lng);
        });
        // double-click anywhere drops the DESTINATION pin there and re-runs the
        // nearby search — exactly like choosing a destination (app.onMapDblClick)
        map.on('dblclick', (e) => {
            if (ParkSmart.onMapDblClick) ParkSmart.onMapDblClick(e.latlng.lat, e.latlng.lng);
        });
        // ensure Leaflet measures the container once layout settles
        setTimeout(() => { if (map) map.invalidateSize(); }, 60);
        return map;
    }

    function osmFallback() {
        if (fellBack || !map) return;
        fellBack = true;
        const osm = L.tileLayer(OSM_STD, { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19, className: 'osm-fallback' });
        osm.addTo(map);
    }

    /* ---------- destination (blue teardrop pin) ---------- */
    function destHtml() {
        const blue = cssVar('--blue', '#3b82f6');
        return `
            <div class="pin-drop">
                <svg viewBox="0 0 32 44" width="32" height="44">
                    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${blue}"/>
                    <circle cx="16" cy="16" r="6.5" fill="#0a0e17"/>
                </svg>
            </div>`;
    }
    function setDestination(lat, lng, name) {
        clearDestination();
        const icon = L.divIcon({ className: '', html: destHtml(), iconSize: [32, 44], iconAnchor: [16, 44], popupAnchor: [0, -42] });
        destinationMarker = L.marker([lat, lng], { icon, zIndexOffset: 500 }).addTo(map);
        if (name) destinationMarker.bindPopup(`<div class="popup-title">${escapeHtml(name)}</div><div class="popup-meta"><span>Destination</span></div>`);
        map.flyTo([lat, lng], 15, { duration: 1.1 });
    }
    function clearDestination() { if (destinationMarker) { map.removeLayer(destinationMarker); destinationMarker = null; } }

    /* ---------- start (green origin dot) ---------- */
    function startHtml() {
        return `<div style="width:20px;height:20px;border-radius:50%;background:#34d39a;border:4px solid #0c1512;box-shadow:0 0 0 3px rgba(52,211,154,0.35),0 3px 8px rgba(0,0,0,0.5);" class="pin-drop"></div>`;
    }
    function setStartMarker(lat, lng, name) {
        clearStartMarker();
        const icon = L.divIcon({ className: '', html: startHtml(), iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12] });
        startMarker = L.marker([lat, lng], { icon, zIndexOffset: 450 }).addTo(map);
        if (name) startMarker.bindPopup(`<div class="popup-title">Starting point</div><div class="popup-meta"><span>${escapeHtml(name)}</span></div>`);
    }
    function clearStartMarker() { if (startMarker) { map.removeLayer(startMarker); startMarker = null; } }
    function getStartLatLng() { return startMarker ? startMarker.getLatLng() : null; }

    /* ---------- parking markers ----------
       Colour = meaning (green free · gold paid · red full).
       Lots use a downward teardrop pin; on-street uses a flat road badge. */
    function lotPinHtml(spot, index) {
        const best = spot.isBest ? ' mk-pin--best' : '';   // best-match spot wears a subtle gold ring
        return `<div class="mk-pin ${spot.colorKey}${best}" data-id="${spot.id}" style="animation-delay:${Math.min(index * 40, 460)}ms">
            <svg viewBox="0 0 28 38" width="28" height="38" aria-hidden="true"><path d="M14 0C6.27 0 0 6.27 0 14c0 10 14 24 14 24s14-14 14-24C28 6.27 21.73 0 14 0z"/><circle cx="14" cy="14" r="5.4" fill="#fff"/></svg>
            <span class="mk-p">P</span></div>`;
    }
    function streetBadgeHtml(spot, index) {
        const best = spot.isBest ? ' mk-street--best' : '';
        return `<div class="mk-street ${spot.colorKey}${best}" data-id="${spot.id}" style="animation-delay:${Math.min(index * 40, 460)}ms" title="On-street parking"><span>P</span></div>`;
    }
    function showSpots(spots) {
        clearSpots();
        spots.forEach((spot, index) => {
            const isStreet = spot.kind === 'street';
            const icon = isStreet
                ? L.divIcon({ className: '', html: streetBadgeHtml(spot, index), iconSize: [26, 20], iconAnchor: [13, 10], popupAnchor: [0, -12] })
                : L.divIcon({ className: '', html: lotPinHtml(spot, index), iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -36] });
            const marker = L.marker([spot.lat, spot.lng], { icon, riseOnHover: true }).addTo(map);
            // no map popup — clicking a pin opens the detail pane instead
            marker.on('click', () => { if (ParkSmart.onSpotClick) ParkSmart.onSpotClick(spot); });
            marker._spotId = spot.id;
            parkingMarkers.push(marker);
        });
    }
    function stars(r) { return r != null ? `★ ${r.toFixed(1)}` : ''; }
    function spotPopup(spot) {
        const ratingBits = [spot.rating != null ? `${stars(spot.rating)} (${spot.ratingCount})` : '', spot.safetyLabel ? `🛡 ${escapeHtml(spot.safetyLabel)}` : ''].filter(Boolean).join(' · ');
        const spaces = (spot.spacesFree != null && spot.spacesTotal != null) ? `${spot.spacesFree}/${spot.spacesTotal} spaces`
            : spot.spacesTotal != null ? `${spot.spacesTotal} capacity`
                : 'No space data';
        const fee = spot.feeStatus === 'free' ? 'Free' : (spot.charge || (spot.feeKnown ? 'Paid' : 'Fee unknown'));
        const head = spot.kind === 'street'
            ? `<div class="popup-sub">Public on-street parking${spot.streetName ? ' · ' + escapeHtml(spot.streetName) : ''}</div>` : '';
        return `
            <div class="popup-title">${escapeHtml(spot.name)}</div>
            ${head}
            <div class="popup-rows">
                <span class="pr ${spot.colorKey}"><b>${spaces}</b></span>
                <span class="pr">${spot.distanceFormatted} · ${escapeHtml(spot.walkTime)} walk</span>
                <span class="pr ${spot.feeStatus === 'free' ? 'free' : 'paid'}">${fee}${spot.typeLabel ? ' · ' + escapeHtml(spot.typeLabel) : ''}</span>
                ${ratingBits ? `<span class="pr">${ratingBits}</span>` : ''}
            </div>
            <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="ParkSmart.startNavigation('${spot.id}')">Navigate here</button>`;
    }
    function markerEl(m) { const el = m.getElement(); return el ? el.querySelector('.mk-pin, .mk-street') : null; }
    function highlightSpot(spotId) {
        parkingMarkers.forEach(m => { const p = markerEl(m); if (p) p.classList.toggle('selected', m._spotId === spotId); });
    }
    function clearHighlight() { parkingMarkers.forEach(m => { const p = markerEl(m); if (p) p.classList.remove('selected'); }); }
    function openSpotPopup(spotId) { const m = parkingMarkers.find(m => m._spotId === spotId); if (m) m.openPopup(); }
    function clearSpots() { parkingMarkers.forEach(m => map.removeLayer(m)); parkingMarkers = []; }

    /* ---------- route drawing ---------- */
    function addRoute(coords, type = 'drive') {
        const isDrive = type === 'drive';
        const color = isDrive ? cssVar('--route-drive', '#3b82f6') : cssVar('--route-walk', '#8896b0');
        // road casing (solid outline under the line) — clean, no glow
        const casing = L.polyline(coords, {
            color: isDrive ? cssVar('--route-casing', '#1a3a78') : color,
            weight: isDrive ? 10 : 7, opacity: isDrive ? 1 : 0.35,
            lineCap: 'round', lineJoin: 'round', interactive: false, renderer: routeRenderer
        }).addTo(map);
        const line = L.polyline(coords, {
            color, weight: isDrive ? 5.5 : 4, opacity: isDrive ? 1 : 0.95,
            dashArray: isDrive ? null : '1, 11',
            lineCap: 'round', lineJoin: 'round', interactive: false, renderer: routeRenderer
        }).addTo(map);
        routeLayers.push(casing, line);
        return line;
    }
    function revealPolyline(polyline, duration = 700) {
        const path = polyline && polyline._path;
        if (!path || typeof path.getTotalLength !== 'function') return;
        let len; try { len = path.getTotalLength(); } catch (e) { return; }
        if (!len || !isFinite(len)) return;
        path.style.transition = 'none';
        path.style.strokeDasharray = len + ' ' + len;
        path.style.strokeDashoffset = String(len);
        void path.getBoundingClientRect();
        path.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        path.style.strokeDashoffset = '0';
        // once drawn, drop the dash entirely — otherwise a later zoom (the sim's
        // fly-in) lengthens the pixel path beyond the dash and the tail would
        // fall into the gap and vanish
        setTimeout(() => { if (path) { path.style.transition = 'none'; path.style.strokeDasharray = 'none'; path.style.strokeDashoffset = '0'; } }, duration + 80);
    }
    function fadeInPolyline(polyline, duration = 450) {
        const path = polyline && polyline._path;
        if (!path) return;
        path.style.transition = 'none';
        path.style.opacity = '0';
        void path.getBoundingClientRect();
        path.style.transition = `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        path.style.opacity = '';
    }
    function clearRoutes() { routeLayers.forEach(l => map.removeLayer(l)); routeLayers = []; clearTrail(); }

    /* ---------- gold "already-travelled" trail (simulation) ----------
       A polyline in the pk-trail pane (above the route lines) that grows behind
       the mover, marking road already driven/walked across both legs. Throttled
       to >3.5 m of travel so it stays light. Restart/stop clears it. */
    function startTrail() {
        clearTrail();
        trailLine = L.polyline([], {
            color: cssVar('--route-trail', '#e8a33d'), weight: 5, opacity: 0.95,
            lineCap: 'round', lineJoin: 'round', interactive: false,
            pane: 'pk-trail', renderer: trailRenderer
        }).addTo(map);
        trailPts = [];
    }
    function pushTrail(lat, lng) {
        if (!trailLine || !map) return;
        const last = trailPts.length ? trailPts[trailPts.length - 1] : null;
        if (last) { try { if (map.distance(last, [lat, lng]) < 3.5) return; } catch (e) { } }
        trailPts.push([lat, lng]);
        trailLine.addLatLng([lat, lng]);
    }
    function clearTrail() {
        if (trailLine) { try { map.removeLayer(trailLine); } catch (e) { } trailLine = null; }
        trailPts = [];
    }
    function trailInfo() { return { active: !!trailLine, points: trailPts.length }; }

    /* ---------- movers (simulation) ---------- */
    function createMover(type = 'vehicle') {
        const isCar = type === 'vehicle';
        const glyph = isCar
            ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>';
        const icon = L.divIcon({ className: '', html: `<div class="${isCar ? 'marker-vehicle' : 'marker-walker'}">${glyph}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] });
        return L.marker([0, 0], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
    }
    function removeMover(m) { if (m) map.removeLayer(m); }

    /* ---------- camera ---------- */
    function flyTo(lat, lng, zoom = 16) { map.flyTo([lat, lng], zoom, { duration: 0.8 }); }
    function panTo(lat, lng, opts) { map.panTo([lat, lng], Object.assign({ animate: true, duration: 0.4, easeLinearity: 0.4 }, opts || {})); }
    function fitBounds(bounds, padding = [60, 60], opts) { map.fitBounds(bounds, Object.assign({ padding, maxZoom: 16 }, opts || {})); }
    function zoomIn() { if (map) map.zoomIn(); }
    function zoomOut() { if (map) map.zoomOut(); }
    function getMap() { return map; }

    /* ---------- theme ----------
       Light = CARTO Voyager, dark = CARTO Dark Matter. Swap the base layer's
       tile URL; attribution (OSM + CARTO) is unchanged. */
    function setTheme(theme) {
        if (!baseTile) return;
        baseTile.setUrl(tileUrlFor(theme || currentTheme()));
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    return {
        init, getMap, setTheme,
        setDestination, clearDestination,
        setStartMarker, clearStartMarker, getStartLatLng,
        showSpots, clearSpots, highlightSpot, clearHighlight, openSpotPopup,
        addRoute, clearRoutes, revealPolyline, fadeInPolyline,
        startTrail, pushTrail, clearTrail, trailInfo,
        createMover, removeMover,
        flyTo, panTo, fitBounds, zoomIn, zoomOut
    };
})();
