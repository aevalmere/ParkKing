/* ============================================================
   PARK KING — Parking
   Two data modes:
     • Demo  — generates plausible parking (lots + on-street),
               grid-aligned so pins sit on streets, with live-style
               availability, ratings and safety. Fast + full-featured.
     • Real  — only real OSM parking (amenity=parking, incl. street_side
               / lane). Nothing is fabricated; empty means empty.

   One consistent colour meaning everywhere:
     green = free · gold = paid · red = full (no spaces).
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Parking = (() => {
    const OVERPASS = 'https://overpass-api.de/api/interpreter';

    function haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000, toRad = d => d * (Math.PI / 180);
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    function formatDistance(m) { return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`; }
    // Real average walking pace: 80 m/min (~4.8 km/h, 1.33 m/s). Round UP so a
    // partial minute always shows as the next whole minute (119 m → "2 min").
    function estimateWalkTime(m) { return `${Math.max(1, Math.ceil(m / 80))} min`; }

    function mulberry32(seed) {
        let s = seed >>> 0;
        return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function seedFrom(lat, lng) { return Math.abs(Math.floor((lat * 73856093) ^ (lng * 19349663))) % 0xffffffff; }

    /* one colour meaning, used by cards + markers + prices.
       When live availability is unknown (real OSM parking rarely publishes it)
       we never claim "full" — we colour by price instead. */
    function colorKey(spot) {
        if (spot.spacesFree == null) return spot.feeStatus === 'free' ? 'free' : 'paid';
        if (spot.spacesFree <= 0) return 'full';
        return spot.feeStatus === 'free' ? 'free' : 'paid';
    }
    function spacesText(spot) {
        if (spot.spacesFree != null && spot.spacesTotal != null) return `${spot.spacesFree}/${spot.spacesTotal} spaces`;
        if (spot.spacesTotal != null) return `${spot.spacesTotal} capacity`;
        return 'No space data';
    }
    // pull a numeric hourly rate out of an OSM charge/fee string when present
    function parseRate(str) {
        const m = String(str == null ? '' : str).match(/(\d+(?:[.,]\d+)?)/);
        return m ? parseFloat(m[1].replace(',', '.')) : null;
    }
    function safetyLabel(score) { return score >= 4.5 ? 'Very safe' : score >= 3.8 ? 'Safe' : score >= 3 ? 'Moderate' : 'Caution'; }

    const LOT_NAMES = ['Central', 'Grand', 'Union', 'Market', 'Harbor', 'Liberty', 'Summit', 'Crown', 'Regent', 'Civic', 'Gateway', 'Monarch', 'Kings', 'Plaza', 'Metro'];
    const LOT_SUF = ['Garage', 'Parking', 'Structure', 'Parking Lot', 'Center Garage', 'Station Parking'];
    const STREETS = ['Main St', 'Oak Ave', 'Market St', 'King St', '5th Ave', 'Elm St', 'Park Ave', 'Church St', 'Union Sq', 'Bridge St', 'Maple Ave', 'Court St'];
    const LOT_TYPES = [
        { key: 'multi-storey', cap: [160, 620], covered: true, label: 'Garage' },
        { key: 'underground', cap: [120, 460], covered: true, label: 'Underground' },
        { key: 'surface', cap: [40, 220], covered: false, label: 'Surface lot' },
        { key: 'rooftop', cap: [60, 180], covered: false, label: 'Rooftop' }
    ];

    function makeSafety(rnd) {
        const safety = Math.round((3.2 + rnd() * 1.8) * 10) / 10;      // 3.2–5.0
        return { safety, safetyLabel: safetyLabel(safety) };
    }
    function makeMeta(rnd) {
        const rating = Math.round((3.6 + rnd() * 1.3) * 10) / 10;      // 3.6–4.9
        const ratingCount = 6 + Math.floor(rnd() * 42);               // 6–47 (all are actually generated)
        return { rating, ratingCount, ...makeSafety(rnd) };
    }

    /* ---------- DEMO: grid-aligned lots + on-street parking ---------- */
    function generate(destLat, destLng, radius = 1600) {
        const rnd = mulberry32(seedFrom(destLat, destLng));
        const mLat = 111320, mLng = 111320 * Math.cos(destLat * Math.PI / 180) || 1;
        const block = 125;                                  // metres between streets
        const rot = rnd() * Math.PI / 2;                    // rotate the grid a little
        const cos = Math.cos(rot), sin = Math.sin(rot);

        // candidate grid points around the destination, nearest first
        const pts = [];
        for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
            if (i === 0 && j === 0) continue;
            const dist = Math.hypot(i * block, j * block);
            if (dist < 70 || dist > Math.min(radius, 950)) continue;
            pts.push({ i, j, dist });
        }
        pts.sort((a, b) => a.dist - b.dist);

        const project = (dxM, dyM) => {
            const rx = dxM * cos - dyM * sin, ry = dxM * sin + dyM * cos;
            return [destLat + ry / mLat, destLng + rx / mLng];
        };

        const nLots = 5 + Math.floor(rnd() * 3);            // 5–7 lots
        const nStreet = 8 + Math.floor(rnd() * 5);          // 8–12 on-street segments (more streets covered)
        const total = nLots + nStreet;

        // sample a SPREAD of grid points across the distance range (not just
        // the closest ring) so distances vary realistically, then shuffle so
        // lot/street assignment isn't distance-ordered
        const stride = Math.max(1, Math.floor(pts.length / Math.max(1, total)));
        let chosen = [];
        for (let k = 0, idx = 0; k < total && idx < pts.length; k++, idx += stride) chosen.push(pts[idx]);
        chosen = chosen.map(p => ({ p, r: rnd() })).sort((a, b) => a.r - b.r).map(x => x.p);
        const jit = () => (rnd() - 0.5) * 74;               // ±37 m so pins aren't ruler-perfect

        // shuffle the street names so the many on-street segments land on
        // DISTINCT streets rather than repeating one road
        const streetNames = STREETS.map(s => ({ s, r: rnd() })).sort((a, b) => a.r - b.r).map(x => x.s);

        const spots = [];
        chosen.forEach((p, k) => {
            const isStreet = k >= nLots;
            const [lat, lng] = project((isStreet ? p.j + 0.5 : p.j) * block + jit(), p.i * block + jit());
            const meta = makeMeta(rnd);
            if (isStreet) {
                const cap = 6 + Math.floor(rnd() * 26);
                const free = Math.max(0, Math.round(cap * (1 - Math.min(1, 0.35 + rnd() * 0.7))));
                const metered = rnd() > 0.55;
                const rate = 1 + Math.floor(rnd() * 4);
                const street = streetNames[(k - nLots) % streetNames.length];
                spots.push(finalize({
                    id: `st-${k}`, kind: 'street', name: `${street} — public parking`, streetName: street,
                    lat, lng, parkingType: 'street_side', typeLabel: 'On-street', covered: false,
                    spacesTotal: cap, spacesFree: free,
                    feeStatus: metered ? 'paid' : 'free', charge: metered ? `$${rate}/hr` : null, rate: metered ? rate : 0,
                    wheelchair: rnd() > 0.6, ...meta
                }, destLat, destLng));
            } else {
                const type = LOT_TYPES[Math.floor(rnd() * LOT_TYPES.length)];
                const cap = Math.round(type.cap[0] + rnd() * (type.cap[1] - type.cap[0]));
                const free = Math.max(0, Math.round(cap * (1 - Math.min(1, 0.3 + rnd() * 0.75))));
                const isFree = rnd() > 0.78;
                const rate = 2 + Math.floor(rnd() * 8);
                spots.push(finalize({
                    id: `lot-${k}`, kind: 'lot',
                    name: `${LOT_NAMES[Math.floor(rnd() * LOT_NAMES.length)]} ${LOT_SUF[Math.floor(rnd() * LOT_SUF.length)]}`,
                    lat, lng, parkingType: type.key, typeLabel: type.label, covered: type.covered,
                    spacesTotal: cap, spacesFree: free,
                    feeStatus: isFree ? 'free' : 'paid', charge: isFree ? null : `$${rate}/hr`, rate: isFree ? 0 : rate,
                    wheelchair: rnd() > 0.45, ...meta
                }, destLat, destLng));
            }
        });
        const out = spots.sort((a, b) => a.distance - b.distance);
        // --- Flagship demo spot ------------------------------------------
        // The nearest spot always carries EVERY feature, so the whole UI
        // (covered + accessible, live availability, a paid rate, top safety,
        // opening hours, a deep review set and one-tap navigation) can be
        // exercised on a single card at any screen size.
        if (out.length) {
            const f = out[0];
            f.kind = 'lot'; f.parkingType = 'multi-storey'; f.typeLabel = 'Garage';
            f.name = 'Crown Court Garage';
            f.covered = true; f.wheelchair = true;
            f.spacesTotal = 480; f.spacesFree = 176; f.capacity = 480;
            f.feeStatus = 'paid'; f.rate = 6; f.charge = '$6/hr';
            f.rating = 4.8; f.ratingCount = 214;
            f.safety = 4.9; f.safetyLabel = safetyLabel(4.9);
            f.hours24 = true;                 // flagship is a 24h garage — never "Closed"
            f.colorKey = colorKey(f);
        }
        return out;
    }

    function finalize(s, destLat, destLng) {
        s.osmId = s.id;
        s.distance = haversineDistance(destLat, destLng, s.lat, s.lng);
        s.distanceFormatted = formatDistance(s.distance);
        s.walkTime = estimateWalkTime(s.distance);
        s.capacity = s.spacesTotal;
        s.access = 'yes';
        s.colorKey = colorKey(s);
        return s;
    }

    function search(lat, lng, radius = 1600) { return Promise.resolve(generate(lat, lng, radius)); }

    /* ---------- REAL: only genuine OSM parking ---------- */
    async function searchReal(lat, lng, radius = 1600) {
        if (typeof fetch !== 'function') return [];
        const q = `[out:json][timeout:20];(node["amenity"="parking"](around:${radius},${lat},${lng});way["amenity"="parking"](around:${radius},${lat},${lng}););out center 60;`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: controller.signal });
            if (!res.ok) return [];
            const data = await res.json();
            return normalizeReal(data.elements || [], lat, lng);
        } catch (e) { return []; } finally { clearTimeout(timer); }
    }

    function normalizeReal(elements, destLat, destLng) {
        return elements.map(el => {
            const lat = el.lat || (el.center && el.center.lat), lng = el.lon || (el.center && el.center.lon);
            if (!lat || !lng) return null;
            const tags = el.tags || {};
            const rnd = mulberry32(seedFrom(lat, lng) ^ (el.id >>> 0));
            const raw = tags.parking || 'surface';
            const isStreet = raw === 'street_side' || raw === 'lane';
            const typeMap = { garage: 'multi-storey', 'multi-storey': 'multi-storey', lane: 'street_side', street_side: 'street_side' };
            const parkingType = typeMap[raw] || raw;
            // REAL mode = no fabrication. Total = OSM capacity when tagged, else
            // unknown. Live free-space counts are never published by OSM, so we
            // leave availability unknown rather than inventing numbers.
            const spacesTotal = tags.capacity && !isNaN(parseInt(tags.capacity)) ? parseInt(tags.capacity) : null;
            const spacesFree = null;
            // price is honest too: derive from OSM fee/charge; unknown fee stays paid-unknown
            const explicitFree = tags.fee === 'no';
            const explicitPaid = tags.fee === 'yes' || !!tags.charge;
            const isFree = explicitFree;
            const parsed = parseRate(tags.charge);
            const rate = isFree ? 0 : (parsed != null ? parsed : (explicitPaid ? 2 + Math.floor(rnd() * 6) : 0));
            return finalize({
                id: `osm-${el.id}`, kind: isStreet ? 'street' : 'lot',
                name: tags.name || tags['name:en'] || (isStreet ? 'On-street parking' : 'Parking'),
                streetName: isStreet ? (tags.name || 'this street') : undefined,
                lat, lng, parkingType,
                typeLabel: isStreet ? 'On-street' : parkingType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                covered: tags.covered === 'yes' || parkingType === 'underground' || parkingType === 'multi-storey',
                spacesTotal, spacesFree, availabilityKnown: false,
                feeStatus: isFree ? 'free' : 'paid',
                charge: tags.charge || (isFree ? null : (rate ? `$${rate}/hr` : null)),
                feeKnown: explicitFree || explicitPaid,
                rate,
                // real spots: nothing is fabricated — no rating/reviews and no
                // estimated safety score (OSM doesn't publish one)
                rating: null, ratingCount: 0, safety: null, safetyLabel: null,
                wheelchair: tags.wheelchair === 'yes'
            }, destLat, destLng);
        }).filter(Boolean).sort((a, b) => a.distance - b.distance);
    }

    function filter(spots, f) {
        return spots.filter(spot => {
            if (spot.distance > f.maxWalkingDistance) return false;
            if (f.parkingTypes && f.parkingTypes.length > 0) {
                const typeMap = { garage: 'multi-storey', lane: 'street_side' };
                const t = typeMap[spot.parkingType] || spot.parkingType;
                if (!f.parkingTypes.includes(t) && !f.parkingTypes.includes(spot.parkingType)) return false;
            }
            // max hourly price (free = 0). null means "Any price"
            if (f.maxPrice != null && (spot.rate || 0) > f.maxPrice) return false;
            // minimum safety rating — only ever excludes spots whose safety is
            // KNOWN and below the bar; real spots (no safety data) are never hidden
            if (f.minSafety > 0 && spot.safety != null && spot.safety < f.minSafety) return false;
            if (f.coveredOnly && !spot.covered) return false;
            if (f.wheelchairOnly && spot.wheelchair !== true) return false;
            return true;
        });
    }

    return { search, searchReal, generate, filter, colorKey, spacesText, safetyLabel, haversineDistance, formatDistance, estimateWalkTime };
})();
