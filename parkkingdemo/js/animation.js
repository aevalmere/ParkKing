/* ============================================================
   PARK KING — Nav
   On-demand real-road routing. Pressing "Navigate" computes ONE
   fastest route with ParkSmart.Router (A* over the real OSM road
   network, hosted road-routing service fallback) — driving to the parking, then walking
   to the destination — draws it with a smooth reveal, frames it,
   and exposes the geometry for the journey simulation.

   Selecting a spot never routes. Heavy work happens here, on
   Navigate — never on select.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Nav = (() => {
    const state = { active: false, busy: false };
    let runId = 0;
    let current = null; // { start, garage, destination, drive, walk }

    function summaryFrom(garageName, drive, walk) {
        return {
            garageName,
            drive: pick(drive), walk: pick(walk),
            total: { distance: drive.distance + walk.distance, duration: drive.duration + walk.duration },
            source: drive.source, engine: drive.engine,
            explored: (drive.explored || 0) + (walk.explored || 0)
        };
    }
    function pick(r) { return { distance: r.distance, duration: r.duration, engine: r.engine, source: r.source, explored: r.explored, nodes: r.nodes }; }

    async function navigate(startPoint, parkingSpot, destination, cb = {}, demo = true) {
        clear();
        const myRun = ++runId;
        state.busy = true;

        const from = { lat: startPoint.lat, lng: startPoint.lng };
        const park = { lat: parkingSpot.lat, lng: parkingSpot.lng };
        const dest = { lat: destination.lat, lng: destination.lng };

        // Both modes route on the REAL road network: the hosted road-routing
        // service first (fast), A* over OSM as fallback.
        const routeFn = ParkSmart.Router.routeReal;

        try {
            const [drive, walk] = await Promise.all([
                routeFn('driving', from, park),
                routeFn('foot', park, dest)
            ]);
            if (myRun !== runId) return; // superseded

            state.active = true; state.busy = false;
            current = { start: from, garage: { lat: park.lat, lng: park.lng, name: parkingSpot.name }, destination: dest, drive, walk };

            ParkSmart.Map.clearRoutes();
            const driveLine = ParkSmart.Map.addRoute(drive.coords, 'drive');
            const walkLine = ParkSmart.Map.addRoute(walk.coords, 'walk');
            ParkSmart.Map.setStartMarker(from.lat, from.lng, 'Starting point');

            const map = ParkSmart.Map.getMap();
            const bounds = L.latLngBounds([...drive.coords, ...walk.coords, [from.lat, from.lng], [dest.lat, dest.lng]]);
            let revealed = false;
            const reveal = () => {
                if (revealed) return; revealed = true;
                ParkSmart.Map.revealPolyline(driveLine, 720);
                ParkSmart.Map.fadeInPolyline(walkLine, 480);
            };
            map.once('moveend', reveal);
            ParkSmart.Map.fitBounds(bounds, [96, 96]);
            setTimeout(reveal, 520);

            const summary = summaryFrom(parkingSpot.name, drive, walk);
            if (cb.onReady) cb.onReady(summary);
            return summary;
        } catch (err) {
            state.busy = false; state.active = false;
            if (typeof console !== 'undefined') console.error('[Nav] route failed:', err);
            if (cb.onError) cb.onError(err);
        }
    }

    function getRoute() { return current; }

    function clear() {
        runId++;
        state.active = false; state.busy = false; current = null;
        if (ParkSmart.Map) ParkSmart.Map.clearRoutes();
    }

    function isActive() { return state.active || state.busy; }

    return { navigate, clear, isActive, getRoute };
})();
