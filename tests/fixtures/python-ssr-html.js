// What the server renders for these Python components. `python-ssr.test.js`
// asserts it and `python-hydration.test.js` hydrates on it, so the two cannot
// drift apart in silence.
export const PythonTruthAttributes =
    "<!--[--><div data-k=\"hidden\">x</div> <button data-k=\"disabled\">x</button> <input data-k=\"checked\" type=\"checkbox\"/> <input data-k=\"required\"/> <details data-k=\"open\"><summary>x</summary></details> <button data-k=\"witness\" disabled=\"\">x</button> <div data-k=\"dict\" class=\"shown\"></div> <div data-k=\"list\" class=\"base\"></div> <div data-k=\"text\" class=\"plain words\"></div><!--]-->";

export const KeyIdentity =
    "<!--[--><ul data-k=\"todos\"><!--[--><li>todo</li><li>todo</li><!--]--></ul> <!----><i data-k=\"block\">1</i><!----> <!--[--><input data-k=\"field\" value=\"Ada\"/><!--]--> <ul data-k=\"nans\"><!--[--><li>nan</li><li>nan</li><!--]--></ul> <ul data-k=\"mixed\"><!--[--><li>float</li><li>str</li><li>tuple</li><li>str</li><li>bytes</li><li>str</li><!--]--></ul> <button data-k=\"grow\">grow</button> <button data-k=\"replace\">replace</button><!--]-->";

// `bind:this` has no node on the server, so `el` is None there and a DIV once
// hydrated: the one text the client changes.
export const SvelteConstructs =
    "<!--[--><!----><article class=\"dyn\">hello<!----></article><!----> <!--[--><p class=\"inside\">inside</p><!--]--> <!--[--><span class=\"row\">0:a</span><span class=\"row\">1:b</span><!--]--> <section><h2>card</h2> <!--[0--><em class=\"child\">child</em><!----><!--]--> <!--[0--><small class=\"foot\">end</small><!----><!--]--></section><!----> <!--[0--><b class=\"faded\">faded</b><!--]--> <textarea class=\"ta\">hello</textarea> <div class=\"ref\"></div> <pre class=\"pre\">{braces}</pre> <output class=\"keys\">0</output> <output class=\"el\">NoneType</output><!--]-->";

// Rendered with `amount` and `two_way` set to the JavaScript number 0.42.
export const ScalarProps =
    "<!--[--><p data-k=\"amount\">0.4</p> <p data-k=\"two-way\">0.4</p> <p data-k=\"absent\">False</p><!--]-->";
