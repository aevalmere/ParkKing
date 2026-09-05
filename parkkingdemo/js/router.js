/* ============================================================
   PARK KING — Router
   Real road navigation. Routes follow the actual street network.

     1. A* over the REAL OSM road graph (Overpass), weighted by
        travel TIME so it returns the genuinely fastest route,
        with an admissible + consistent heuristic (optimal).
        Reports engine 'astar' and the nodes explored.
     2. Hosted road-routing service — real streets, fast — if
        Overpass is slow/unreachable. Reports engine 'road'.
     3. Straight line only if both road sources fail, clearly
        labelled 'direct'.

   Heavy pathfinding runs on Navigate, never on select. Browser
   (window.ParkSmart.Router) + Node (module.exports) for tests.
   ============================================================ */

(function (global) {
    'use strict';

    /* ---------- geometry ---------- */
    function haversine(a, b) {
        const R = 6371000, toRad = d => d * (Math.PI / 180);
        const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }
    function pathDistance(coords) {
        let d = 0;
        for (let i = 1; i < coords.length; i++) d += haversine(coords[i - 1], coords[i]);
        return d;
    }

    /* ---------- travel-speed model (m/s) ---------- */
    const DRIVE_SPEED = {
        motorway: 27.8, motorway_link: 13.9, trunk: 22.2, trunk_link: 11.1,
        primary: 16.7, primary_link: 9.7, secondary: 13.9, secondary_link: 8.3,
        tertiary: 11.1, tertiary_link: 8.3, unclassified: 11.1, residential: 8.3,
        living_street: 4.2, service: 5.6, road: 8.3
    };
    const DRIVE_MAX = 27.8, WALK_SPEED = 1.33;   // ~4.8 km/h, matches the 80 m/min walk-time law
    function speedFor(profile, highway) { return profile === 'foot' ? WALK_SPEED : (DRIVE_SPEED[highway] || DRIVE_SPEED.residential); }

    /* ---------- binary min-heap ---------- */
    class MinHeap {
        constructor() { this._a = []; }
        get size() { return this._a.length; }
        isEmpty() { return this._a.length === 0; }
        peek() { return this._a[0]; }
        push(key, prio) {
            const a = this._a; a.push({ key, prio }); let i = a.length - 1;
            while (i > 0) { const p = (i - 1) >> 1; if (a[p].prio <= a[i].prio) break; const t = a[p]; a[p] = a[i]; a[i] = t; i = p; }
        }
        pop() {
            const a = this._a, top = a[0], last = a.pop();
            if (a.length) {
                a[0] = last; let i = 0; const n = a.length;
                for (; ;) { const l = 2 * i + 1, r = 2 * i + 2; let s = i; if (l < n && a[l].prio < a[s].prio) s = l; if (r < n && a[r].prio < a[s].prio) s = r; if (s === i) break; const t = a[s]; a[s] = a[i]; a[i] = t; i = s; }
            }
            return top;
        }
    }

    /* ---------- graph from real OSM ways ---------- */
    function nodeKey(lat, lng) { return lat.toFixed(6) + ',' + lng.toFixed(6); }

    function graphFromWays(elements, profile) {
        const nodes = new Map(), adj = new Map(), isFoot = profile === 'foot';
        const ensure = (k, c) => { if (!nodes.has(k)) { nodes.set(k, c); adj.set(k, []); } };
        for (const el of elements) {
            if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
            const tags = el.tags || {}; if (!tags.highway) continue;
            const speed = speedFor(profile, tags.highway);
            const owVal = (tags.oneway || '').toLowerCase(), hw = tags.highway;
            const impliedOneway = (hw === 'motorway' || hw === 'motorway_link') && owVal !== 'no';
            const forwardOnly = !isFoot && (owVal === 'yes' || owVal === 'true' || owVal === '1' || impliedOneway || (tags.junction === 'roundabout' && owVal !== 'no'));
            const reverseOnly = !isFoot && (owVal === '-1' || owVal === 'reverse');
            const g = el.geometry;
            for (let i = 0; i < g.length - 1; i++) {
                const aC = [g[i].lat, g[i].lon], bC = [g[i + 1].lat, g[i + 1].lon];
                const aK = nodeKey(aC[0], aC[1]), bK = nodeKey(bC[0], bC[1]);
                if (aK === bK) continue;
                ensure(aK, aC); ensure(bK, bC);
                const d = haversine(aC, bC), t = d / speed;
                if (reverseOnly) adj.get(bK).push({ to: aK, t, d });
                else if (forwardOnly) adj.get(aK).push({ to: bK, t, d });
                else { adj.get(aK).push({ to: bK, t, d }); adj.get(bK).push({ to: aK, t, d }); }
            }
        }
        return { nodes, adj, profile, maxSpeed: isFoot ? WALK_SPEED : DRIVE_MAX };
    }

    function nearestNode(graph, lat, lng) {
        let best = null, bestD = Infinity; const p = [lat, lng];
        for (const [key, coord] of graph.nodes) { const d = haversine(coord, p); if (d < bestD) { bestD = d; best = key; } }
        return { key: best, dist: bestD };
    }

    /* ---------- A* (shortest travel TIME) ---------- */
    function aStar(graph, startK, goalK) {
        const { adj, nodes, maxSpeed } = graph;
        if (!nodes.has(startK) || !nodes.has(goalK)) return null;
        if (startK === goalK) return { path: [startK], time: 0, dist: 0, explored: 0 };
        const goal = nodes.get(goalK);
        const h = key => haversine(nodes.get(key), goal) / maxSpeed;
        const gScore = new Map([[startK, 0]]), dScore = new Map([[startK, 0]]);
        const came = new Map(), closed = new Set(), open = new MinHeap();
        // priority = f, with a tiny goal-directed tie-break (prefer larger g so
        // ties resolve toward the goal → fewer expansions). Optimality is
        // preserved: with a consistent heuristic + goal-check-on-pop, any
        // tie-break returns the optimal path.
        const TB = 1e-9;
        open.push(startK, h(startK));
        let reached = false, explored = 0;
        while (!open.isEmpty()) {
            const cur = open.pop().key;
            if (cur === goalK) { reached = true; break; }
            if (closed.has(cur)) continue;
            closed.add(cur); explored++;
            const gCur = gScore.get(cur);
            for (const e of (adj.get(cur) || [])) {
                if (closed.has(e.to)) continue;
                const tentative = gCur + e.t;
                if (tentative < (gScore.has(e.to) ? gScore.get(e.to) : Infinity)) {
                    came.set(e.to, cur); gScore.set(e.to, tentative);
                    dScore.set(e.to, dScore.get(cur) + e.d);
                    open.push(e.to, tentative + h(e.to) - tentative * TB);
                }
            }
        }
        if (!reached) return null;
        const path = [goalK]; let c = goalK;
        while (c !== startK) { c = came.get(c); if (c === undefined) return null; path.unshift(c); }
        return { path, time: gScore.get(goalK), dist: dScore.get(goalK), explored };
    }

    /* ---------- instant local street grid (demo mode, no network) ----------
       A* over a generated grid so demo navigation is effortlessly fast and
       still shows a real search. Deterministic per trip. */
    function mulberry32(seed) { let s = seed >>> 0; return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

    function syntheticGraph(from, to, profile) {
        const isFoot = profile === 'foot';
        const rnd = mulberry32(Math.abs(Math.floor((from.lat * 1e4 + from.lng * 1e3 + to.lat * 1e2 + to.lng) * 1000)) % 0xffffffff ^ (isFoot ? 0x9e3779b9 : 0));
        const minLat = Math.min(from.lat, to.lat), maxLat = Math.max(from.lat, to.lat);
        const minLng = Math.min(from.lng, to.lng), maxLng = Math.max(from.lng, to.lng);
        const midLat = (minLat + maxLat) / 2, mLat = 111320, mLng = 111320 * Math.cos(midLat * Math.PI / 180) || 1;
        const marginM = isFoot ? 60 : 240;
        const halfLatM = (maxLat - minLat) * mLat / 2 + marginM, halfLngM = (maxLng - minLng) * mLng / 2 + marginM;
        const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
        const block = isFoot ? 46 : 110;
        const rows = Math.max(3, Math.min(56, Math.round((halfLatM * 2) / block) + 1));
        const cols = Math.max(3, Math.min(56, Math.round((halfLngM * 2) / block) + 1));
        const nodes = new Map(), adj = new Map(), keyAt = [];
        for (let i = 0; i < rows; i++) {
            keyAt[i] = [];
            const fy = rows === 1 ? 0.5 : i / (rows - 1);
            for (let j = 0; j < cols; j++) {
                const fx = cols === 1 ? 0.5 : j / (cols - 1);
                const jLat = (rnd() - 0.5) * (isFoot ? 6 : 12) / mLat, jLng = (rnd() - 0.5) * (isFoot ? 6 : 12) / mLng;
                const lat = cLat - halfLatM / mLat + fy * (2 * halfLatM / mLat) + jLat;
                const lng = cLng - halfLngM / mLng + fx * (2 * halfLngM / mLng) + jLng;
                const key = nodeKey(lat, lng); nodes.set(key, [lat, lng]); adj.set(key, []); keyAt[i][j] = key;
            }
        }
        const rowSpeed = i => (i % 4 === 0 ? DRIVE_SPEED.secondary : DRIVE_SPEED.residential);
        const colSpeed = j => (j % 4 === 2 ? DRIVE_SPEED.secondary : DRIVE_SPEED.residential);
        const link = (aK, bK, ds) => { const a = nodes.get(aK), b = nodes.get(bK); const d = haversine(a, b); const t = d / (isFoot ? WALK_SPEED : ds); adj.get(aK).push({ to: bK, t, d }); adj.get(bK).push({ to: aK, t, d }); };
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { if (j + 1 < cols) link(keyAt[i][j], keyAt[i][j + 1], rowSpeed(i)); if (i + 1 < rows) link(keyAt[i][j], keyAt[i + 1][j], colSpeed(j)); }
        return { nodes, adj, profile, maxSpeed: isFoot ? WALK_SPEED : DRIVE_MAX };
    }

    function solveOnGraph(graph, profile, from, to, source) {
        if (graph.nodes.size < 2) return null;
        const s = nearestNode(graph, from.lat, from.lng), t = nearestNode(graph, to.lat, to.lng);
        if (!s.key || !t.key) return null;
        const result = aStar(graph, s.key, t.key);
        if (!result) return null;
        const coords = result.path.map(k => graph.nodes.get(k));
        const full = [[from.lat, from.lng], ...coords, [to.lat, to.lng]];
        const speed = profile === 'foot' ? WALK_SPEED : DRIVE_SPEED.residential;
        const connector = s.dist + t.dist;
        return { coords: full, distance: result.dist + connector, duration: result.time + connector / speed, engine: 'astar', source, explored: result.explored, nodes: graph.nodes.size };
    }

    function routeLocal(profile, from, to) {
        return new Promise((resolve) => {
            if (from.lat === to.lat && from.lng === to.lng) { resolve({ coords: [[from.lat, from.lng]], distance: 0, duration: 0, engine: 'astar', source: 'grid', explored: 0, nodes: 0 }); return; }
            const g = syntheticGraph(from, to, profile);
            resolve(solveOnGraph(g, profile, from, to, 'grid') || straightLine(profile, from, to));
        });
    }

    /* ---------- network engines ---------- */
    const OVERPASS_ENDPOINTS = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];
    const ROUTE_HOST = 'https://router.project-osrm.org/route/v1';
    const graphCache = new Map();
    const OVERPASS_TIMEOUT_MS = 8000;

    function bboxFor(from, to, pad) {
        return [Math.min(from.lat, to.lat) - pad, Math.min(from.lng, to.lng) - pad, Math.max(from.lat, to.lat) + pad, Math.max(from.lng, to.lng) + pad];
    }

    async function fetchOverpass(query) {
        let lastErr;
        for (const url of OVERPASS_ENDPOINTS) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
            try {
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query), signal: controller.signal });
                if (!res.ok) throw new Error('overpass ' + res.status);
                return await res.json();
            } catch (e) { lastErr = e; } finally { clearTimeout(timer); }
        }
        throw lastErr || new Error('overpass unreachable');
    }

    async function buildGraph(bbox, profile) {
        const key = profile + '|' + bbox.map(n => n.toFixed(3)).join(',');
        if (graphCache.has(key)) return graphCache.get(key);
        const roadFilter = profile === 'foot'
            ? 'way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed"]["foot"!~"no|private"]'
            : 'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)(_link)?$"]["access"!~"private|no"]["motor_vehicle"!~"no"]';
        const query = `[out:json][timeout:20];(${roadFilter}(${bbox.join(',')}););out geom;`;
        const data = await fetchOverpass(query);
        const graph = graphFromWays(data.elements || [], profile);
        graphCache.set(key, graph);
        return graph;
    }

    async function astarRoute(profile, from, to) {
        const pad = profile === 'foot' ? 0.004 : 0.012;
        const graph = await buildGraph(bboxFor(from, to, pad), profile);
        if (graph.nodes.size < 2) throw new Error('empty graph');
        const s = nearestNode(graph, from.lat, from.lng), t = nearestNode(graph, to.lat, to.lng);
        if (!s.key || !t.key) throw new Error('no snap');
        const result = aStar(graph, s.key, t.key);
        if (!result) throw new Error('no path');
        const coords = result.path.map(k => graph.nodes.get(k));
        const full = [[from.lat, from.lng], ...coords, [to.lat, to.lng]];
        const speed = profile === 'foot' ? WALK_SPEED : DRIVE_SPEED.residential;
        const connector = s.dist + t.dist;
        return { coords: full, distance: result.dist + connector, duration: result.time + connector / speed, engine: 'astar', source: 'osm', explored: result.explored, nodes: graph.nodes.size };
    }

    async function roadRoute(profile, from, to) {
        if (typeof fetch !== 'function') throw new Error('no network');
        const p = profile === 'foot' ? 'foot' : 'driving';
        const url = `${ROUTE_HOST}/${p}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error('road ' + res.status);
            const data = await res.json();
            if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error('road no route');
            const r = data.routes[0];
            return { coords: r.geometry.coordinates.map(c => [c[1], c[0]]), distance: r.distance, duration: r.duration, engine: 'road', source: 'road', explored: 0, nodes: 0 };
        } finally { clearTimeout(timer); }
    }

    function straightLine(profile, from, to) {
        const coords = [[from.lat, from.lng], [to.lat, to.lng]];
        const distance = pathDistance(coords);
        const speed = profile === 'foot' ? WALK_SPEED : DRIVE_SPEED.residential;
        return { coords, distance, duration: distance / speed, engine: 'direct', source: 'direct', explored: 0, nodes: 0 };
    }

    /**
     * Compute a route that follows real roads. A* over OSM first, then
     * the hosted road-routing service, then a straight line. Always resolves.
     * @param {'driving'|'foot'} profile
     */
    async function route(profile, from, to) {
        if (from.lat === to.lat && from.lng === to.lng) return { coords: [[from.lat, from.lng]], distance: 0, duration: 0, engine: 'astar', source: 'osm', explored: 0, nodes: 0 };
        try {
            return await astarRoute(profile, from, to);
        } catch (e1) {
            if (typeof console !== 'undefined') console.warn('[Router] A*/OSM unavailable, trying road service:', e1 && e1.message);
            try {
                return await roadRoute(profile, from, to);
            } catch (e2) {
                if (typeof console !== 'undefined') console.warn('[Router] road service unavailable, straight line:', e2 && e2.message);
                return straightLine(profile, from, to);
            }
        }
    }

    /**
     * REAL mode routing, tuned for speed: the hosted road-routing service
     * first (fast, real streets), then A* over OSM, then a straight line.
     * Always resolves.
     */
    async function routeReal(profile, from, to) {
        if (from.lat === to.lat && from.lng === to.lng) return { coords: [[from.lat, from.lng]], distance: 0, duration: 0, engine: 'road', source: 'road', explored: 0, nodes: 0 };
        try { return await roadRoute(profile, from, to); }
        catch (e1) {
            if (typeof console !== 'undefined') console.warn('[Router] road service unavailable, trying A*/OSM:', e1 && e1.message);
            try { return await astarRoute(profile, from, to); }
            catch (e2) {
                if (typeof console !== 'undefined') console.warn('[Router] road data unavailable, straight line:', e2 && e2.message);
                return straightLine(profile, from, to);
            }
        }
    }

    const api = {
        route, routeReal, routeLocal, astarRoute, roadRoute,
        _internal: { haversine, pathDistance, MinHeap, graphFromWays, syntheticGraph, solveOnGraph, nearestNode, aStar, speedFor, DRIVE_SPEED, WALK_SPEED, DRIVE_MAX, nodeKey, straightLine }
    };
    if (typeof window !== 'undefined') { window.ParkSmart = window.ParkSmart || {}; window.ParkSmart.Router = api; }
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
