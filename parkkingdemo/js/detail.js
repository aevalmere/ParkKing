/* ============================================================
   PARK KING — Detail pane (SHOW ONLY)
   Slides out from the panel. The parking info stays pinned; only
   the reviews scroll. Reviews are collapsible (average always on
   the bar), paginated with "Load more", and the rating breakdown
   reflects the true ratio of all review objects — updating live
   when you post. Real spots carry no fake reviews or hours, but
   you can still post. Nothing is stored or sent anywhere.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Detail = (() => {
    const el = id => document.getElementById(id);
    const cache = new Map();                 // spotId -> review model (keeps session edits)
    const state = { spot: null, model: null, composerRating: 0 };
    let bound = false;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
    function hashHue(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
    // shared metric-icon set (same stroke weight/size as the result cards)
    const icon = (name, size, opts) => (ParkSmart.icon ? ParkSmart.icon(name, size, opts) : '');

    function getModel(spot) {
        if (!cache.has(spot.id)) cache.set(spot.id, ParkSmart.Reviews.build(spot));
        return cache.get(spot.id);
    }
    const avg = m => m.count ? m.sum / m.count : null;
    const avgFmt = m => m.count ? (m.sum / m.count).toFixed(1) : 'New';
    const distPct = m => { const t = m.count || 1; return m.dist.map(d => Math.round((d / t) * 100)); };

    /* ---------- small renderers ---------- */
    function starRow(n, size) {
        let s = '';
        for (let i = 1; i <= 5; i++) s += `<span class="dp-star ${i <= n ? 'f' : ''}">★</span>`;
        return `<span class="dp-stars ${size || ''}">${s}</span>`;
    }
    function avatar(initials, name, size) {
        return `<span class="dp-avatar ${size || ''}" style="--h:${hashHue(name)}" aria-hidden="true">${esc(initials)}</span>`;
    }
    function kindLabel(spot) { return spot.kind === 'street' ? 'On-street parking' : (spot.typeLabel || 'Parking'); }

    function quickStat(val, label, cls, ico) {
        return `<div class="dp-stat ${cls || ''}">${ico ? `<span class="dp-stat-ic">${ico}</span>` : ''}<div class="dp-stat-val">${val}</div><div class="dp-stat-label">${esc(label)}</div></div>`;
    }
    function availabilityStat(spot) {
        if (spot.spacesFree != null && spot.spacesTotal != null)
            return quickStat(`${spot.spacesFree}<small>/${spot.spacesTotal}</small>`, 'spaces free', 'ck-' + spot.colorKey, icon('car', 15));
        if (spot.spacesTotal != null)
            return quickStat(`${spot.spacesTotal}`, 'capacity', 'ck-' + spot.colorKey, icon('car', 15));
        return quickStat('—', 'no live data', 'ck-none', icon('car', 15));
    }
    function priceStat(spot) {
        if (spot.feeStatus === 'free') return quickStat('Free', 'to park', 'ck-free', icon('tag', 15));
        if (spot.rate) return quickStat(esc(spot.charge || ('$' + spot.rate + '/hr')), 'hourly', 'ck-paid', icon('tag', 15));
        return quickStat('—', 'fee unknown', 'ck-none', icon('tag', 15));
    }
    // safety is honest: real OSM spots have no safety score, so we show "no data"
    // rather than inventing a number
    function safetyStat(spot) {
        if (spot.safety == null) return quickStat('—', 'no safety data', 'ck-none', icon('shield', 15));
        return quickStat(`${spot.safety.toFixed(1)}`, esc(spot.safetyLabel || 'safety'), 'ck-safety', icon('shield', 15));
    }

    /* ---------- reviews ---------- */
    function reviewHtml(r) {
        return `<article class="dp-review${r.mine ? ' mine' : ''}" data-rid="${r.id}">
            <div class="dp-review-head">
                ${avatar(r.initials, r.name)}
                <div class="dp-review-meta">
                    <span class="dp-review-name">${esc(r.name)}${r.mine ? ' <span class="dp-badge-you">You</span>' : ''}</span>
                    <span class="dp-review-sub">${starRow(r.rating, 'xs')}<span class="dp-dot">·</span>${esc(r.time)}</span>
                </div>
            </div>
            <p class="dp-review-text">${esc(r.text)}</p>
            <div class="dp-review-actions">
                <button class="dp-linkbtn ${r.liked ? 'liked' : ''}" data-act="like" data-rid="${r.id}" aria-pressed="${r.liked}">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    Helpful<span class="dp-count">${r.likes}</span>
                </button>
                <button class="dp-linkbtn" data-act="reply-open" data-rid="${r.id}">Reply</button>
            </div>
            ${r.replies.map(rp => replyHtml(r.id, rp)).join('')}
            ${r.replyOpen ? replyComposer(r.id) : ''}
        </article>`;
    }
    function replyHtml(parentId, rp) {
        return `<div class="dp-reply" data-rid="${rp.id}">
            ${avatar(rp.initials, rp.name, 'xs')}
            <div class="dp-reply-body">
                <span class="dp-review-name">${esc(rp.name)}${rp.mine ? ' <span class="dp-badge-you">You</span>' : ''}<span class="dp-reply-time">${esc(rp.time)}</span></span>
                <p class="dp-reply-text">${esc(rp.text)}</p>
                <button class="dp-linkbtn sm ${rp.liked ? 'liked' : ''}" data-act="like-reply" data-parent="${parentId}" data-rid="${rp.id}" aria-pressed="${rp.liked}">Helpful<span class="dp-count">${rp.likes}</span></button>
            </div>
        </div>`;
    }
    function replyComposer(parentId) {
        return `<div class="dp-replybox">
            <input type="text" class="dp-replyinput" data-parent="${parentId}" placeholder="Write a reply…" aria-label="Write a reply">
            <button class="btn btn-primary sm" data-act="reply-post" data-parent="${parentId}">Reply</button>
        </div>`;
    }
    function renderList(m) {
        if (!m.reviews.length) return '';
        const items = m.reviews.slice(0, m.shown).map(reviewHtml).join('');
        const left = m.reviews.length - m.shown;
        const more = left > 0
            ? `<button class="dp-loadmore" data-act="more">Load ${Math.min(ParkSmart.Reviews.PAGE, left)} more<span class="dp-count">${left} left</span></button>`
            : '';
        return items + more;
    }
    function renderBreakdown(m) {
        if (!m.count) return `<div class="dp-empty">No reviews yet — be the first to leave one.</div>`;
        const pct = distPct(m);
        const bars = [5, 4, 3, 2, 1].map((s, i) =>
            `<div class="dp-barrow"><span class="dp-barlabel">${s}</span><span class="dp-bartrack"><span class="dp-barfill" style="width:${pct[i]}%"></span></span></div>`).join('');
        return `<div class="dp-ratingbreak">
            <div class="dp-bigrating">
                <div class="dp-bignum">${avgFmt(m)}</div>
                ${starRow(Math.round(avg(m)), 'md')}
                <div class="dp-bigcount" id="dp-bigcount">${m.count} review${m.count !== 1 ? 's' : ''}</div>
            </div>
            <div class="dp-bars">${bars}</div>
        </div>`;
    }

    /* ---------- main render ---------- */
    function render(spot, m) {
        const cstars = [1, 2, 3, 4, 5].map(s => `<button class="dp-cstar" data-act="cstar" data-star="${s}" aria-label="${s} star${s > 1 ? 's' : ''}">★</button>`).join('');
        // status sits next to the name; the rating/reviews live only in the Reviews dropdown
        const statusPill = m.hours ? `<span class="dp-status ${m.openNow ? 'open' : 'closed'}">${m.openNow ? 'Open now' : 'Closed'}</span>` : '';
        const hoursRow = m.hours
            ? `<div class="dp-hours-row"><span class="dp-hours-label">${icon('clock', 14)}Hours</span><span class="dp-hours"><span class="dp-hdot ${m.openNow ? 'open' : 'closed'}"></span>${esc(m.hours)}</span></div>`
            : '';
        const chips = (ParkSmart.recChips ? ParkSmart.recChips(spot) : '');   // Best match / Closest / Cheapest
        return `<div class="dp-inner">
            <button class="dp-close" data-act="close" aria-label="Close details">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div class="dp-pinned">
                <div class="dp-kicker">${esc(kindLabel(spot))}</div>
                <h2 class="dp-title"><span class="dp-title-text">${esc(spot.name)}</span>${statusPill}</h2>
                ${chips}
                <div class="dp-quickstats">
                    ${availabilityStat(spot)}
                    ${priceStat(spot)}
                    ${quickStat(`${esc(spot.distanceFormatted)}`, `${esc(spot.walkTime)} walk`, '', icon('walk', 15))}
                    ${safetyStat(spot)}
                </div>
                ${hoursRow}
                <div class="dp-actions">
                    <button class="btn btn-primary" data-act="nav">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Navigate here
                    </button>
                </div>
            </div>

            <div class="dp-reviews-region" id="dp-region">
                <button class="dp-reviews-bar" data-act="toggle-reviews" aria-expanded="true">
                    <span class="dp-rb-title">Reviews</span>
                    <span class="dp-rb-avg"><span class="dp-star f">★</span><span id="dp-bar-avg">${avgFmt(m)}</span></span>
                    <span class="dp-rb-count">(<span id="dp-bar-count">${m.count}</span>)</span>
                    <svg class="dp-rb-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="dp-reviews-scroll" id="dp-scroll">
                    <div id="dp-breakdown">${renderBreakdown(m)}</div>
                    <div class="dp-reviews" id="dp-reviews">${renderList(m)}</div>
                    <!-- floating "Rate it" bar — sticks to the bottom of the reviews
                         scroll area while the list scrolls behind it -->
                    <div class="dp-composer">
                        <div class="dp-composer-row">
                            <span class="dp-composer-label">Rate it</span>
                            <div class="dp-composer-stars" id="dp-cstars" role="radiogroup" aria-label="Your rating">${cstars}</div>
                        </div>
                        <textarea id="dp-comment" class="dp-textarea" rows="2" placeholder="Share your experience with this parking…"></textarea>
                        <div class="dp-composer-actions">
                            <button class="btn btn-primary" data-act="post">Post review</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /* ---------- interactions ---------- */
    function find(m, id) { return m.reviews.find(r => r.id === id); }
    function paintComposerStars() {
        document.querySelectorAll('.dp-cstar').forEach(b => { const s = parseInt(b.dataset.star) || 0; b.classList.toggle('on', s <= state.composerRating); });
    }
    // re-render the list; when aggregate=true also refresh breakdown/bar/headline
    function refresh(aggregate) {
        const m = state.model;
        const list = el('dp-reviews'); if (list) list.innerHTML = renderList(m);
        if (aggregate) {
            const bd = el('dp-breakdown'); if (bd) bd.innerHTML = renderBreakdown(m);
            const ba = el('dp-bar-avg'); if (ba) ba.textContent = avgFmt(m);
            const bc = el('dp-bar-count'); if (bc) bc.textContent = m.count;
        }
    }
    function postReview() {
        const m = state.model;
        const ta = el('dp-comment');
        const raw = (ta && ta.value || '').trim();
        if (!state.composerRating || !raw) { ParkSmart.UI && ParkSmart.UI.showToast('Add a star rating and a comment first', 'error'); return; }
        const rating = state.composerRating;
        const text = ParkSmart.Censor ? ParkSmart.Censor.clean(raw) : raw;   // mask profanity before it is stored/shown
        m.reviews.unshift({ id: 'you-' + Date.now(), name: 'You', initials: 'Y', rating, text, time: 'just now', likes: 0, liked: false, replies: [], replyOpen: false, mine: true });
        m.dist[5 - rating]++; m.sum += rating; m.count++; m.shown++;   // distribution reflects the new review
        state.composerRating = 0; if (ta) ta.value = '';
        paintComposerStars();
        refresh(true);
        ParkSmart.UI && ParkSmart.UI.showToast('Thanks! Your review was posted (demo only)', 'success');
    }
    function postReply(parentId) {
        const input = document.querySelector(`.dp-replyinput[data-parent="${parentId}"]`);
        const raw = (input && input.value || '').trim();
        if (!raw) { if (input) input.focus(); return; }
        const r = find(state.model, parentId); if (!r) return;
        const text = ParkSmart.Censor ? ParkSmart.Censor.clean(raw) : raw;   // mask profanity in replies too
        r.replies.push({ id: 'you-rp-' + Date.now(), name: 'You', initials: 'Y', text, time: 'just now', likes: 0, liked: false, mine: true });
        r.replyOpen = false;
        refresh(false);
    }
    function onClick(e) {
        const btn = e.target.closest('[data-act]'); if (!btn) return;
        const act = btn.dataset.act, m = state.model;
        if (act === 'close') return close();
        if (act === 'nav') { if (ParkSmart.startNavigation && state.spot) ParkSmart.startNavigation(state.spot.id); return; }
        if (!m) return;
        if (act === 'toggle-reviews') { const r = el('dp-region'); if (r) { const c = r.classList.toggle('collapsed'); btn.setAttribute('aria-expanded', String(!c)); } return; }
        if (act === 'more') { m.shown = Math.min(m.reviews.length, m.shown + ParkSmart.Reviews.PAGE); return refresh(false); }
        if (act === 'cstar') { state.composerRating = parseInt(btn.dataset.star) || 0; paintComposerStars(); return; }
        if (act === 'post') return postReview();
        if (act === 'like') { const r = find(m, btn.dataset.rid); if (r) { r.liked = !r.liked; r.likes += r.liked ? 1 : -1; } return refresh(false); }
        if (act === 'like-reply') { const r = find(m, btn.dataset.parent); if (r) { const rp = (r.replies || []).find(x => x.id === btn.dataset.rid); if (rp) { rp.liked = !rp.liked; rp.likes += rp.liked ? 1 : -1; } } return refresh(false); }
        if (act === 'reply-open') {
            const r = find(m, btn.dataset.rid); if (r) r.replyOpen = !r.replyOpen; refresh(false);
            const input = document.querySelector(`.dp-replyinput[data-parent="${btn.dataset.rid}"]`); if (input) input.focus();
            return;
        }
        if (act === 'reply-post') return postReply(btn.dataset.parent);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    /* ---------- open / close ---------- */
    let closeTimer = 0;
    function open(spot) {
        const pane = el('detail-panel'); if (!pane || !spot) return;
        clearTimeout(closeTimer);
        state.spot = spot; state.model = getModel(spot); state.composerRating = 0;
        pane.innerHTML = render(spot, state.model);
        pane.hidden = false;
        if (!bound) { pane.addEventListener('click', onClick); bound = true; }
        requestAnimationFrame(() => requestAnimationFrame(() => pane.classList.add('open')));
        document.body.classList.add('detail-open');
        document.addEventListener('keydown', onKey);
    }
    function close() {
        const pane = el('detail-panel'); if (!pane || pane.hidden) return;
        pane.classList.remove('open');
        document.body.classList.remove('detail-open');
        document.removeEventListener('keydown', onKey);
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => { pane.hidden = true; pane.innerHTML = ''; state.spot = null; state.model = null; }, 360);
    }
    function isOpen() { const pane = el('detail-panel'); return !!(pane && !pane.hidden); }

    return { open, close, isOpen };
})();
