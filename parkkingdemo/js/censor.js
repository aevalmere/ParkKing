/* ============================================================
   ParkKing — Censor (SHOW ONLY)
   ParkSmart.Censor.clean(text) masks common English profanity /
   slurs before a review or reply is stored + shown. Pure function:
     • case-insensitive, WHOLE-WORD matching (no Scunthorpe problem —
       "class" is never flagged for containing a smaller word)
     • light leetspeak normalization so "$h1t" / "a$$" are caught
     • every letter of a matched word becomes '#' (length preserved),
       clean words are returned untouched.
   Nothing here is stored or sent anywhere; it only cleans page text.
   ============================================================ */

window.ParkSmart = window.ParkSmart || {};

ParkSmart.Censor = (() => {
    // Canonical block list + the common inflections we want caught. Matching is
    // whole-token, so inflected forms are listed explicitly rather than stemmed.
    const WORDS = [
        'ass', 'asses', 'asshole', 'assholes', 'arse', 'arsehole',
        'bastard', 'bastards', 'bitch', 'bitches', 'bitching', 'bollocks',
        'bullshit', 'bugger', 'cock', 'cocks', 'cocksucker', 'crap', 'cunt', 'cunts',
        'damn', 'dick', 'dicks', 'dickhead', 'dildo', 'douche', 'douchebag',
        'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fucked', 'fuckin',
        'motherfucker', 'motherfuckers', 'goddamn', 'jackass',
        'piss', 'pissed', 'prick', 'pricks', 'pussy', 'pussies',
        'shit', 'shits', 'shitty', 'shithead', 'shithole', 'slut', 'sluts',
        'twat', 'wank', 'wanker', 'whore', 'whores', 'retard', 'retarded',
        // slurs — masked the same way
        'fag', 'fags', 'faggot', 'faggots', 'dyke', 'nigger', 'niggers', 'nigga',
        'niggas', 'spic', 'spics', 'chink', 'chinks', 'kike', 'kikes', 'coon',
        'coons', 'tranny', 'trannies', 'wetback', 'gook', 'paki', 'raghead'
    ];
    const BAD = new Set(WORDS);

    // Leet → letters. Length-preserving substitutions; collapse handled separately.
    function subLeet(s) {
        return String(s).toLowerCase()
            .replace(/[@4]/g, 'a')
            .replace(/3/g, 'e')
            .replace(/[1!|]/g, 'i')
            .replace(/0/g, 'o')
            .replace(/[$5]/g, 's')
            .replace(/7/g, 't')
            .replace(/\*/g, '')
            .replace(/[^a-z]/g, '');   // drop any leftover non-letters
    }
    function isProfane(word) {
        const n0 = subLeet(word);
        if (!n0) return false;
        if (BAD.has(n0)) return true;                    // direct / leet-substituted match
        const n1 = n0.replace(/(.)\1+/g, '$1');          // collapse elongation ("shiiit" → "shit")
        return n1 !== n0 && BAD.has(n1);
    }

    // Clean a string: a "word chunk" is a run of letters/digits/leet symbols. We
    // peel any leading/trailing !|* (ambiguous punctuation, e.g. the "!" in
    // "shit!") off the maskable core so it is preserved, while an internal "!"
    // ("sh!t") is still normalized to "i". A matched core becomes '#' of its own
    // length; everything else is returned untouched.
    function clean(text) {
        if (text == null) return text;
        return String(text).replace(/[A-Za-z0-9@$!|*]+/g, (chunk) => {
            const lead = (chunk.match(/^[!|*]+/) || [''])[0];
            const trail = (chunk.match(/[!|*]+$/) || [''])[0];
            const core = chunk.slice(lead.length, chunk.length - trail.length);
            return isProfane(core) ? lead + '#'.repeat(core.length) + trail : chunk;
        });
    }

    return { clean };
})();
