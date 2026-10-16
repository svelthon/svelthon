<script>
    // DebugTags in Svelte.
    let rows = $state([]);
    let record = $state({ n: 0 });
    let count = $state(0);
    let ﬁeld = $state(1);
    let total = $derived(rows.length);

    export function change() {
        rows.push(1);
        record.n = 1;
        count = 1;
        ﬁeld = 2;
    }
</script>

{@debug rows}
{@debug record}
{@debug count, total}
<output>{rows.length}|{record.n}|{count}|{total}|{ﬁeld}</output>
<p>a {@debug ﬁeld} b</p>
<p>c {@debug count}</p>
<p>d {@debug (rows)} {@debug (ﬁeld)} {@debug count, count} {@debug ((record), (total))}</p>
