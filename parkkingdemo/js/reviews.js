/* ============================================================
   PARK KING — Reviews (SHOW ONLY)
   Generates realistic, deterministic review data per parking spot
   from a template. Nothing is stored or sent anywhere — it exists
   purely on the page to demonstrate a full review experience.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Reviews = (() => {
    function hashStr(s) {
        let h = 2166136261 >>> 0;
        s = String(s);
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function mulberry32(seed) {
        let s = seed >>> 0;
        return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

    const FIRST = ['Maya', 'Daniel', 'Priya', 'Marcus', 'Sofia', 'Liam', 'Amara', 'Noah', 'Elena', 'Jerome', 'Hana', 'Diego', 'Chloe', 'Omar', 'Ivy', 'Theo', 'Nadia', 'Ravi', 'Grace', 'Felix', 'Yuki', 'Sam', 'Bianca', 'Andre'];
    const LAST = ['R.', 'K.', 'M.', 'T.', 'S.', 'L.', 'B.', 'N.', 'P.', 'C.', 'D.', 'V.', 'W.', 'A.'];

    // comments bucketed by sentiment; star rating is drawn within the bucket
    const POS = [
        'Super convenient and easy to get in and out. Always seem to find a spot.',
        'Clean, well-lit and felt safe even late in the evening.',
        'Great value for this part of town. Tap-to-pay worked first time.',
        'Spacious bays — no drama parking a larger car.',
        'Staff were friendly and the signage made it simple to find a space.',
        'Been using this one for months, never had an issue. Highly recommend.',
        'Barrier and app worked flawlessly. In and out in under a minute.'
    ];
    const NEU = [
        'Does the job. Gets busy around lunchtime so time it right.',
        'Fine for a couple of hours. Signage to the exit could be clearer.',
        'Decent spot, though the lift was out when I visited.',
        'Reasonable rates. The entrance is a little tight but manageable.',
        'Okay overall — nothing fancy but it works.'
    ];
    const CRIT = [
        'Pricey for what it is, and the machines only take card.',
        'Tight spaces and low ceilings — watch your mirrors.',
        'Full by 9am on weekdays. Come early or look elsewhere.',
        'A bit tricky to find the entrance from the main road.',
        'Ticket machine was temperamental. Bring the app as backup.'
    ];
    const REPLIES = [
        'Totally agree with this.',
        'Same experience last week!',
        'Thanks for the heads up.',
        'Good to know — appreciate it.',
        'Was it any better on the weekend?',
        'The app has been more reliable for me lately.'
    ];
    const TIMES = ['2 days ago', '1 week ago', '2 weeks ago', 'last month', '3 weeks ago', 'a month ago', '2 months ago'];
    const PAGE = 6;   // reviews rendered per "Load more" page

    function stars(rnd, base) {
        // draw a plausible star rating around the spot's rating
        const r = Math.round(base + (rnd() - 0.45) * 1.6);
        return Math.max(1, Math.min(5, r));
    }
    function person(rnd) {
        const first = pick(rnd, FIRST), last = pick(rnd, LAST);
        const name = `${first} ${last}`;
        return { name, initials: (first[0] + last[0]).toUpperCase() };
    }

    // build the whole review model for a spot (deterministic).
    // Real spots get NO fabricated reviews or hours; demo spots get the full set.
    function build(spot) {
        const isReal = spot.rating == null;
        const rnd = mulberry32(hashStr(spot.id || `${spot.lat},${spot.lng}`));

        if (isReal) {
            return { real: true, sum: 0, count: 0, dist: [0, 0, 0, 0, 0], reviews: [], shown: 0, hours: null, openNow: null };
        }

        const baseRating = spot.rating;
        const N = Math.max(1, spot.ratingCount || (6 + Math.floor(rnd() * 42)));

        // generate ALL N reviews (the data is cheap); the pane renders them a
        // page at a time via "Load more" so long lists never slow the UI down.
        const dist = [0, 0, 0, 0, 0];   // [5★,4★,3★,2★,1★] over the whole set
        const reviews = [];
        for (let i = 0; i < N; i++) {
            const roll = rnd();
            const bias = Math.min(0.95, Math.max(0.15, (baseRating - 2.6) / 2.4));  // higher rating → more positive
            const bucket = roll < bias ? POS : roll < bias + 0.25 ? NEU : CRIT;
            const rating = bucket === POS ? Math.max(4, stars(rnd, baseRating))
                : bucket === CRIT ? Math.min(3, stars(rnd, baseRating - 1))
                    : Math.min(4, Math.max(3, stars(rnd, baseRating)));
            dist[5 - rating]++;
            const p = person(rnd);
            const replies = [];
            if (rnd() > 0.7) {
                const rp = person(rnd);
                replies.push({ id: `rp-${i}-0`, name: rp.name, initials: rp.initials, text: pick(rnd, REPLIES), time: pick(rnd, TIMES), likes: Math.floor(rnd() * 6), liked: false });
            }
            reviews.push({
                id: `rv-${i}`, name: p.name, initials: p.initials, rating,
                text: pick(rnd, bucket), time: pick(rnd, TIMES),
                likes: Math.floor(rnd() * 40), liked: false, replies, replyOpen: false
            });
        }

        // seed the aggregate so the headline average matches the card's rating;
        // it then shifts naturally as people post.
        const sum = baseRating * N;

        // opening hours (demo only). A spot flagged hours24 (e.g. the flagship
        // garage) is genuinely 24/7 — never a coin flip, never "Closed". Every
        // other spot gets honest randomized hours whose Open/Closed state is real.
        const open247 = spot.hours24 === true || (spot.parkingType === 'multi-storey' && rnd() > 0.5);
        let hours, openNow = true;
        if (open247) { hours = 'Open 24 hours'; openNow = true; }
        else {
            const oh = 6 + Math.floor(rnd() * 2), ch = 21 + Math.floor(rnd() * 3);
            hours = `${oh}:00 – ${ch}:00`;
            try { const h = new Date().getHours(); openNow = h >= oh && h < ch; } catch (e) { openNow = true; }
        }

        return { real: false, sum, count: N, dist, reviews, shown: Math.min(PAGE, N), hours, openNow };
    }

    return { build, PAGE };
})();
