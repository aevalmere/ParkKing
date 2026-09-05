/* ============================================================
   PARK KING — App
   State + orchestration. Selecting a destination is INSTANT
   (deterministic parking, no blocking network). Navigate is the
   only action that runs the A* pathfinding. A background live-OSM
   pass upgrades parking without ever blocking or yanking the list.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

(() => {
    const state = {
        destination: null,   // { lat, lng, name }
        start: null,         // { lat, lng, name }
        allSpots: [],
        filteredSpots: [],
        selectedSpot: null,
        mapPickTarget: 'destination',
        pickArmed: false,
        hasInteracted: false,
        demo: true,           // demo mode: generated live-style data. off = real OSM only
        searchGen: 0
    };
    ParkSmart.state = state;
    const el = id => document.getElementById(id);
    const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 720px)').matches;

    function init() {
        ParkSmart.Map.init();
        ParkSmart.UI.init();
        ParkSmart.UI.showToast('Set a destination, then press Navigate — we start from your location by default.', 'info');
        // default the START to the user's current location (and bias search locally)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    if (!state.start) {
                        const name = (await reverseGeocode(latitude, longitude)) || 'My location';
                        setStart(latitude, longitude, name);
                    }
                    if (!state.destination) ParkSmart.Map.flyTo(latitude, longitude, 14);
                },
                () => { },
                { timeout: 6000, maximumAge: 300000 }
            );
        }
    }

    /* ---------- recenter controls ---------- */
    function recenterDestination() {
        if (state.destination) ParkSmart.Map.flyTo(state.destination.lat, state.destination.lng, Math.max(ParkSmart.Map.getMap().getZoom(), 15));
        else ParkSmart.UI.showToast('Set a destination first', 'error');
    }
    function recenterStart() {
        if (state.start) ParkSmart.Map.flyTo(state.start.lat, state.start.lng, Math.max(ParkSmart.Map.getMap().getZoom(), 15));
        else useMyLocation();
    }

    /* ---------- destination ---------- */
    async function setDestination(lat, lng, name) {
        state.destination = { lat, lng, name };
        state.selectedSpot = null;
        state.hasInteracted = false;
        state.allSpots = [];
        state.filteredSpots = [];

        clearRoute();
        if (ParkSmart.Detail && ParkSmart.Detail.close) ParkSmart.Detail.close();
        ParkSmart.UI.disarmPick();
        ParkSmart.UI.hideMapHint();
        const input = el('search-input');
        if (input && name) input.value = name;
        el('search-clear')?.classList.remove('hidden');

        ParkSmart.Map.setDestination(lat, lng, name);
        await searchParking();
    }

    async function searchParking() {
        if (!state.destination) return;
        const d = state.destination;
        const gen = ++state.searchGen;
        let spots;
        if (state.demo) {
            spots = await ParkSmart.Parking.search(d.lat, d.lng, 1600);   // instant, generated
        } else {
            ParkSmart.UI.progressStart();
            try { spots = await ParkSmart.Parking.searchReal(d.lat, d.lng, 1600); }  // real OSM only
            finally { ParkSmart.UI.progressDone(); }
        }
        if (gen !== state.searchGen || state.destination !== d) return;
        state.allSpots = spots || [];
        applyFilters();
        const n = state.filteredSpots.length;
        ParkSmart.UI.showToast(
            n > 0 ? `${n} parking option${n !== 1 ? 's' : ''} nearby` :
                (state.demo ? 'No parking matches your filters' : 'No real parking found here — try Demo mode or another area'),
            n > 0 ? 'info' : 'error'
        );
        if (isMobile()) ParkSmart.UI.openPanel();
    }

    function setDemoMode(on) {
        if (state.demo === on) return;
        state.demo = on;
        // full reset so stale markers/cards/detail never linger between modes
        clearRoute();
        if (ParkSmart.Detail && ParkSmart.Detail.close) ParkSmart.Detail.close();
        state.selectedSpot = null;
        state.hasInteracted = false;
        state.allSpots = [];
        state.filteredSpots = [];
        ParkSmart.Map.clearSpots();
        ParkSmart.UI.renderResults([], state.destination);
        ParkSmart.UI.showToast(on ? 'Demo mode — live-style sample parking' : 'Real mode — genuine OSM parking only', 'info');
        // re-find nearby parking for the current destination
        if (state.destination) searchParking();
    }

    function applyFilters() {
        const filters = ParkSmart.UI.getFilters();
        state.filteredSpots = ParkSmart.Parking.filter(state.allSpots, filters);
        // renderResults scores the list and stamps each spot's recommendation
        // flags (isBest / isClosest / isCheapest) FIRST, so the map can read
        // spot.isBest as it draws the pins.
        ParkSmart.UI.renderResults(state.filteredSpots, state.destination);
        ParkSmart.Map.showSpots(state.filteredSpots);
        if (state.selectedSpot) {
            const still = state.filteredSpots.find(s => s.id === state.selectedSpot.id);
            if (still) { ParkSmart.Map.highlightSpot(state.selectedSpot.id); ParkSmart.UI.selectCard(state.selectedSpot.id); }
            else state.selectedSpot = null;
        }
    }

    /* ---------- start ---------- */
    function setStart(lat, lng, name) {
        clearRoute();
        state.start = { lat, lng, name: name || null };
        ParkSmart.Map.setStartMarker(lat, lng, name);
        const input = el('start-input');
        if (input && name) input.value = name;
        ParkSmart.UI.disarmPick();
        ParkSmart.UI.hideMapHint();
    }

    async function reverseGeocode(lat, lng) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } });
            const data = await res.json();
            return data.display_name ? data.display_name.split(',').slice(0, 2).join(',') : null;
        } catch (e) { return null; }
    }

    function tryGeolocate() {
        return new Promise((resolve) => {
            if (!('geolocation' in navigator)) { resolve(false); return; }
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const name = (await reverseGeocode(latitude, longitude)) || 'My location';
                    setStart(latitude, longitude, name);
                    ParkSmart.Map.flyTo(latitude, longitude, 15);
                    resolve(true);
                },
                () => resolve(false),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
        });
    }
    async function useMyLocation() {
        ParkSmart.UI.showToast('Locating you…', 'info');
        const ok = await tryGeolocate();
        if (!ok) { ParkSmart.UI.showToast('Location unavailable — set your start manually', 'error'); ParkSmart.UI.armStartPick(); }
    }

    /* ---------- swap ---------- */
    function swapEndpoints() {
        if (!state.start && !state.destination) return;
        const s = state.start, d = state.destination;
        state.start = d ? { lat: d.lat, lng: d.lng, name: d.name } : null;
        state.destination = s ? { lat: s.lat, lng: s.lng, name: s.name } : null;

        el('start-input').value = state.start ? (state.start.name || '') : '';
        el('search-input').value = state.destination ? (state.destination.name || '') : '';
        el('search-clear')?.classList.toggle('hidden', !state.destination);

        if (state.start) ParkSmart.Map.setStartMarker(state.start.lat, state.start.lng, state.start.name);
        else ParkSmart.Map.clearStartMarker();

        clearRoute();
        state.selectedSpot = null;
        state.hasInteracted = false;

        if (state.destination) {
            ParkSmart.Map.setDestination(state.destination.lat, state.destination.lng, state.destination.name);
            searchParking();
        } else {
            ParkSmart.Map.clearDestination();
            state.allSpots = []; state.filteredSpots = [];
            applyFilters();
        }
    }

    /* ---------- map-pick targeting ---------- */
    function setMapPickTarget(target) {
        state.mapPickTarget = target;
        state.pickArmed = true;
        ParkSmart.UI.showMapHint(target === 'start' ? 'Tap the map to set your starting point' : 'Tap the map to set your destination');
    }
    function resetMapPick() { state.pickArmed = false; state.mapPickTarget = 'destination'; }

    async function onMapClick(lat, lng) {
        const target = state.mapPickTarget || 'destination';
        const wasArmed = state.pickArmed;
        state.pickArmed = false;
        state.mapPickTarget = 'destination';
        if (wasArmed) { ParkSmart.UI.disarmPick(); ParkSmart.UI.hideMapHint(); }
        else if (target === 'destination' && state.destination) return; // ignore stray clicks once a destination exists

        const name = (await reverseGeocode(lat, lng)) || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (target === 'start') { setStart(lat, lng, name); ParkSmart.UI.showToast('Starting point set', 'success'); }
        else setDestination(lat, lng, name);
    }

    // double-click the map: always drop the DESTINATION pin here and re-run the
    // nearby search, exactly like choosing a destination (single-click is unchanged)
    async function onMapDblClick(lat, lng) {
        state.pickArmed = false;
        state.mapPickTarget = 'destination';
        ParkSmart.UI.disarmPick();
        ParkSmart.UI.hideMapHint();
        const name = (await reverseGeocode(lat, lng)) || 'Dropped pin';
        setDestination(lat, lng, name);
    }

    /* ---------- navigation (A* route) ---------- */
    async function startNavigation(spotId) {
        const spot = state.filteredSpots.find(s => s.id === spotId) || state.allSpots.find(s => s.id === spotId);
        if (!spot || !state.destination) return;

        state.selectedSpot = spot;
        state.hasInteracted = true;
        ParkSmart.Map.highlightSpot(spot.id);
        ParkSmart.UI.selectCard(spot.id);

        if (!state.start) {
            ParkSmart.UI.showToast('Finding your location…', 'info');
            const ok = await tryGeolocate();
            if (!ok) {
                ParkSmart.UI.showToast('Set a starting point to navigate', 'error');
                ParkSmart.UI.armStartPick();
                el('start-input')?.focus();
                return;
            }
        }

        ParkSmart.UI.progressStart();
        ParkSmart.Nav.navigate(state.start, spot, state.destination, {
            onReady: (summary) => { ParkSmart.UI.progressDone(); ParkSmart.UI.showRouteSummary(summary); },
            onError: () => { ParkSmart.UI.progressDone(); ParkSmart.UI.showToast('Could not compute a route. Try another spot.', 'error'); }
        }, state.demo);
    }

    // clicking a spot (card or pin) pans to it and slides out the detail pane
    function onSpotClick(spot) {
        state.selectedSpot = spot;
        state.hasInteracted = true;
        ParkSmart.Map.highlightSpot(spot.id);
        ParkSmart.Map.panTo(spot.lat, spot.lng, { animate: true });
        ParkSmart.UI.selectCard(spot.id);
        if (ParkSmart.Detail) ParkSmart.Detail.open(spot);
        const card = document.querySelector(`.p-card[data-id="${spot.id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function simulateJourney() {
        const route = ParkSmart.Nav.getRoute();
        if (!route || !route.drive) { ParkSmart.UI.showToast('Navigate to a parking spot first', 'error'); return; }
        ParkSmart.Simulate.start(route);
    }

    function clearRoute() {
        ParkSmart.Nav.clear();
        if (ParkSmart.Simulate && ParkSmart.Simulate.isRunning()) ParkSmart.Simulate.stop();
        ParkSmart.UI.hideRouteSummary();
    }

    // --- Public API ---
    ParkSmart.init = init;
    ParkSmart.setDestination = setDestination;
    ParkSmart.setStart = setStart;
    ParkSmart.useMyLocation = useMyLocation;
    ParkSmart.setDemoMode = setDemoMode;
    ParkSmart.swapEndpoints = swapEndpoints;
    ParkSmart.setMapPickTarget = setMapPickTarget;
    ParkSmart.resetMapPick = resetMapPick;
    ParkSmart.searchParking = searchParking;
    ParkSmart.applyFilters = applyFilters;
    ParkSmart.onSpotClick = onSpotClick;
    ParkSmart.startNavigation = startNavigation;
    ParkSmart.simulateJourney = simulateJourney;
    ParkSmart.clearRoute = clearRoute;
    ParkSmart.recenterDestination = recenterDestination;
    ParkSmart.recenterStart = recenterStart;
    ParkSmart.onMapClick = onMapClick;
    ParkSmart.onMapDblClick = onMapDblClick;
    ParkSmart.showToast = (m, t) => ParkSmart.UI.showToast(m, t);

    document.addEventListener('DOMContentLoaded', init);
})();
