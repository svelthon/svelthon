<script lang="python">
# A radio and a checkbox whose values answer anew at each call. The witness is
# `GroupHydrateMovingNative.svelte`.
importjs { next_value } from "./group_moving.js"

picked = ""
boxes = []
</script>

<input data-k="radio" type="radio" value="v-{next_value()}" bind:group={picked} />
<input data-k="box" type="checkbox" value={next_value()} bind:group={boxes} />
<p data-k="model">{picked}|{",".join(boxes)}</p>
