<script lang="python">
__js__ = {"./group_tickets.js": ["tickets"]}

picked = []
</script>

<input type="checkbox" data-k="box" value={tickets.next()} bind:group={picked} />
<p data-k="picked">{len(picked)}</p>
