// Exactly what the server renders for `Together.svelte`.
//
// Shared by two files on purpose: `together-ssr.test.js` asserts the server
// produces it, and `together.test.js` hydrates on it. Hydration is the only
// place the two renders have to agree, and a mismatch there is silent in
// production — Svelte keeps the nodes the server sent and the page stops
// following the model. Pinning the string is what makes the agreement checkable
// from a jsdom test, which cannot call the server renderer itself: loading
// `svelte/server` beside the client runtime in one process answers
// `effect_orphan`, which is the harness talking and not the component.
export const SERVER_HTML =
    '<!--[--><h1 data-k="titre" class="svelte-4lu87x">ensemble · 3</h1> ' +
    '<p data-k="apporté">day 3</p> <button data-k="avancer">avancer</button> ' +
    '<button data-k="morse">morse</button> <p data-k="compte">0</p> ' +
    '<input data-k="radio" type="radio" value="item-0"/> ' +
    '<input data-k="nombre" type="radio" value="3"/> <p data-k="choix"></p> ' +
    '<input data-k="case" type="checkbox" value="c-0"/> <p data-k="cochés">[]</p> ' +
    '<!--[--><p data-k="élève-0">Ada</p><p data-k="élève-1">Alan</p><!--]--> ' +
    '<span data-k="résumé">ensemble en hôte</span><!----> <p data-k="marge">6</p> ' +
    '<p data-k="json">{"rôle":"hôte","limite":3}</p> ' +
    '<p data-k="ouvertures">-</p><!--]-->';
