/* ============================================================
   ParkKing — Voice search
   A mic button INSIDE the destination field. Uses the Web Speech
   API when available; if the browser has no SpeechRecognition the
   button never renders. Interim words fill the input live; the
   final phrase triggers the existing destination search. Auto-stops
   on silence or after 8s. A blocked mic reverts cleanly with a toast.
   One recognition instance at a time — no dangling sessions.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Voice = (() => {
    const el = id => document.getElementById(id);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    let rec = null;          // the live recognition instance, or null when idle
    let listening = false;
    let hardTimer = null;    // 8s hard cap
    let btn = null;

    function setListening(on) {
        listening = on;
        if (btn) {
            btn.classList.toggle('listening', on);
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', on ? 'Stop voice search' : 'Search by voice');
        }
    }
    // tear the session down completely so nothing dangles between uses
    function teardown() {
        clearTimeout(hardTimer); hardTimer = null;
        if (rec) { rec.onresult = rec.onerror = rec.onend = rec.onstart = null; rec = null; }
        setListening(false);
    }
    function stop() { try { if (rec) rec.stop(); } catch (e) { teardown(); } }

    function start() {
        if (listening) { stop(); return; }          // tap again to cancel
        const input = el('search-input');
        if (!input) return;
        try { rec = new SR(); } catch (e) { rec = null; }
        if (!rec) return;
        rec.lang = 'en-US';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;

        rec.onstart = () => setListening(true);
        rec.onresult = (e) => {
            let interim = '', final = '';
            const results = e.results || [];
            for (let i = e.resultIndex || 0; i < results.length; i++) {
                const res = results[i];
                const txt = (res && res[0] && res[0].transcript) || '';
                if (res && res.isFinal) final += txt; else interim += txt;
            }
            const box = el('search-input');
            if (!box) return;
            if (final) {
                box.value = final.trim();
                // hand off to the existing destination search (debounced geocode)
                box.dispatchEvent(new Event('input', { bubbles: true }));
                stop();
            } else if (interim) {
                box.value = interim;   // live preview only — no search yet
            }
        };
        rec.onerror = (e) => {
            const err = e && e.error;
            if (err === 'not-allowed' || err === 'service-not-allowed') {
                if (ParkSmart.UI && ParkSmart.UI.showToast) ParkSmart.UI.showToast('Microphone is blocked', 'error');
            }
            teardown();
        };
        rec.onend = () => teardown();

        try { rec.start(); setListening(true); }
        catch (e) { teardown(); return; }
        clearTimeout(hardTimer);
        hardTimer = setTimeout(() => stop(), 8000);   // hard cap in case silence never fires onend
    }

    function mount() {
        if (!SR) return;                 // no speech support → never render the button
        const field = el('dest-field'), input = el('search-input');
        if (!field || !input || el('voice-btn')) return;
        btn = document.createElement('button');
        btn.id = 'voice-btn';
        btn.type = 'button';
        btn.className = 'field-btn voice-btn';
        btn.title = 'Search by voice';
        btn.setAttribute('aria-label', 'Search by voice');
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); start(); });
        // sit at the right edge of the field, just before the map-pick button
        const pick = el('dest-pick');
        if (pick) field.insertBefore(btn, pick); else field.appendChild(btn);
    }

    function init() {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
        else mount();
    }
    init();

    return { supported: !!SR, start, stop };
})();
