// What the server renders for these Python components. `python-ssr.test.js`
// asserts it and `python-hydration.test.js` hydrates on it, so the two cannot
// drift apart in silence. A `<svelte:element>` whose name is read as it
// renders and that holds an attribute of the boolean table stands in a
// `<svelte:boundary>` (`<!--[-->`), whose `{@const}` reads the name once.
export const PythonTruthAttributes =
    "<!--[--><div data-k=\"hidden\">x</div> <button data-k=\"disabled\">x</button> <input data-k=\"checked\" type=\"checkbox\"/> <input data-k=\"required\"/> <details data-k=\"open\"><summary>x</summary></details> <input data-k=\"indeterminate\" type=\"checkbox\"/> <input data-k=\"indeterminate-spread\" type=\"checkbox\"/> <input data-k=\"indeterminate-cleared\" type=\"checkbox\" indeterminate=\"\"/> <button data-k=\"witness\" disabled=\"\">x</button> <div data-k=\"dict\" class=\"shown\"></div> <div data-k=\"list\" class=\"base\"></div> <div data-k=\"text\" class=\"plain words\"></div> <div data-k=\"shorthand\">x</div> <div data-k=\"quoted\">x</div> <div data-k=\"quoted-class\" class=\"a\"></div> <!--[--><!----><div data-k=\"element\" class=\"a\">x<!----></div><!----><!--]--> <div data-k=\"spread\" class=\"a\">x</div> <div data-k=\"until-found\" hidden=\"until-found\">x</div> <div data-k=\"until-found-spread\" hidden=\"until-found\">x</div> <div data-k=\"until-found-subclass\" hidden=\"until-found\">x</div> <!--[--><!----><div data-k=\"until-found-element\" hidden=\"until-found\">x<!----></div><!----><!--]--> <div data-k=\"hidden-true\" hidden=\"\">x</div> <div data-k=\"hidden-other-text\" hidden=\"\">x</div><!--]-->";

export const KeyIdentity =
    "<!--[--><ul data-k=\"todos\"><!--[--><li>todo</li><li>todo</li><!--]--></ul> <!----><i data-k=\"block\">1</i><!----> <!--[--><input data-k=\"field\" value=\"Ada\"/><!--]--> <ul data-k=\"nans\"><!--[--><li>nan</li><li>nan</li><!--]--></ul> <ul data-k=\"boxes\"><!--[--><li>1</li><li>2</li><!--]--></ul> <ul data-k=\"masked\"><!--[--><li>1</li><li>2</li><!--]--></ul> <ul data-k=\"scores\"><!--[--><li>1.5</li><li>2.5</li><!--]--></ul> <ul data-k=\"spelled\"><!--[--><li>a</li><li>b</li><!--]--></ul> <ul data-k=\"mixed\"><!--[--><li>float</li><li>str</li><li>tuple</li><li>str</li><li>bytes</li><li>str</li><!--]--></ul> <button data-k=\"grow\">grow</button> <button data-k=\"replace\">replace</button><!--]-->";

// `bind:this` has no node on the server, so `el` is None there and a DIV once
// hydrated: the one text the client changes.
export const SvelteConstructs =
    "<!--[--><!----><article class=\"dyn\">hello<!----></article><!----> <!--[--><p class=\"inside\">inside</p><!--]--> <!--[--><span class=\"row\">0:a</span><span class=\"row\">1:b</span><!--]--> <section><h2>card</h2> <!--[0--><em class=\"child\">child</em><!----><!--]--> <!--[0--><small class=\"foot\">end</small><!----><!--]--></section><!----> <!--[0--><b class=\"faded\">faded</b><!--]--> <textarea class=\"ta\">hello</textarea> <div class=\"ref\"></div> <pre class=\"pre\">{braces}</pre> <output class=\"keys\">0</output> <output class=\"el\">NoneType</output><!--]-->";

// Rendered with `amount` and `two_way` set to the JavaScript number 0.42.
export const ScalarProps =
    "<!--[--><p data-k=\"amount\">0.4</p> <p data-k=\"two-way\">0.4</p> <p data-k=\"absent\">False</p><!--]-->";

// Two groups, both empty: what the reader picks before hydrating is theirs.
export const GroupHydrate =
    "<!--[--><input data-k=\"box\" type=\"checkbox\" value=\"yes\"/> <input data-k=\"radio\" type=\"radio\" value=\"yes\"/> <p data-k=\"model\">|</p><!--]-->";

// Two groups whose values the markup evaluates, `a` picked in each; Svelte's
// witness renders the same page.
export const GroupHydrateValues =
    "<!--[--><input data-k=\"box-a\" type=\"checkbox\" value=\"a\" checked=\"\"/> <input data-k=\"box-b\" type=\"checkbox\" value=\"b\"/> <!--[--><input data-k=\"radio-a\" type=\"radio\" name=\"choice\" value=\"a\" checked=\"\"/><input data-k=\"radio-b\" type=\"radio\" name=\"choice\" value=\"b\"/><!--]--> <p data-k=\"model\">a|a</p><!--]-->";

// A radio and a checkbox whose values answer anew at each call: the numbers
// are the server's, which the client's need not repeat.
export const GroupHydrateMoving =
    "<!--[--><input data-k=\"radio\" type=\"radio\" value=\"v-1\"/> <input data-k=\"box\" type=\"checkbox\" value=\"3\"/> <p data-k=\"model\">|</p><!--]-->";
