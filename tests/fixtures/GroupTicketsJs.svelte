<script>
    import { tickets } from './group_tickets.js';

    let picked = $state([]);
</script>

<input type="checkbox" data-k="box" value={tickets.next()} bind:group={picked} />
<p data-k="picked">{picked.length}</p>
