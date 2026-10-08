<script lang="python">
# One value, written four ways on a checkbox of a group: longhand, shorthand,
# spread, and a longhand a spread overrides. And a value an expression gives
# anew at each call, from a counter the parent hands over.
next_value: object
value = 1
attrs = {"value": value}
long = [value]
short = [value]
spread = [value]
ordered = [value]
counted = []
quoted = []
</script>

<input data-k="long" type="checkbox" value={value} bind:group={long} />
<input data-k="short" type="checkbox" {value} bind:group={short} />
<input data-k="spread" type="checkbox" {**attrs} bind:group={spread} />
<input data-k="ordered" type="checkbox" value={0} {**attrs} bind:group={ordered} />
<input data-k="counted" type="checkbox" value={next_value()} bind:group={counted} />
<input data-k="quoted" type="checkbox" value="{next_value()}" bind:group={quoted} />

<p data-k="long-model">{long}</p>
<p data-k="short-model">{short}</p>
<p data-k="spread-model">{spread}</p>
<p data-k="ordered-model">{ordered}</p>
<p data-k="counted-model">{counted}</p>
<p data-k="quoted-model">{quoted}</p>
