<script>
    // Svelte's witness for GroupHydrateMoving.svelte.
    import { next_value } from './group_moving.js';

    let picked = $state('');
    let boxes = $state([]);
</script>

<input data-k="radio" type="radio" value="v-{next_value()}" bind:group={picked} />
<input data-k="box" type="checkbox" value={next_value()} bind:group={boxes} />
<p data-k="model">{picked}|{boxes.join(',')}</p>
