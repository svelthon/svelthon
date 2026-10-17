<script lang="python">
# A Brython `int` is a JavaScript number, a `float` is an object. Only a binding
# hands a value straight to the DOM, so it is the one place where the difference
# shows — as `08-motion/01-spring` did, two sliders at 0.5 under labels reading
# 0.1 and 0.25.
# A plain JavaScript object stands for the `Spring` instance the example binds
# to: what matters is that the target is a member expression, not the class.
import javascript

ratio = 0.1
count = 1
held = js.Object.new()
held.stiffness = 0.25
row = {"n": 1}
</script>

<input data-k="range" type="range" min="0" max="1" step="0.01" bind:value={ratio} />
<input data-k="number" type="number" step="0.01" bind:value={ratio} />
<input data-k="text" type="text" bind:value={ratio} />
<input data-k="int" type="number" bind:value={count} />
<input data-k="item" type="number" bind:value={row["n"]} />
<input data-k="member"type="range" min="0" max="1" step="0.01" bind:value={held.stiffness} />

<p data-k="back">{ratio}</p>
<p data-k="back-type">{type(ratio).__name__}</p>
<p data-k="absent">{count is javascript.NULL} {row["n"] is javascript.NULL}</p>
