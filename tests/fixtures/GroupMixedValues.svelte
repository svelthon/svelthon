<script lang="python">
# A value written as text around an interpolation, from a counter the parent
# hands over, which answers anew at each call: on a radio, the binding last
# or first, and on a checkbox, with one interpolation or two.
next_value: object
radio = None
first = None
box = []
twice = []
</script>

<input data-k="radio" type="radio" value="v-{next_value()}" bind:group={radio} />
<input data-k="first" type="radio" bind:group={first} value="v-{next_value()}" />
<input data-k="box" type="checkbox" value="v-{next_value()}" bind:group={box} />
<input data-k="twice" type="checkbox" value="v-{next_value()}-{next_value()}" bind:group={twice} />

<p data-k="radio-model">{radio}</p>
<p data-k="first-model">{first}</p>
<p data-k="box-model">{" ".join(box)}</p>
<p data-k="twice-model">{" ".join(twice)}</p>
