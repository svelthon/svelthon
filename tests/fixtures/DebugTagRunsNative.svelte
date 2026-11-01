<script>
    // DebugTagRuns in Svelte.
    let count = $state(1);
</script>

<p data-k="2">A {@debug count} {@debug count} B</p>
<p data-k="3">A {@debug count} {@debug count} {@debug count} B</p>
<p data-k="4">A {@debug count} {@debug count} {@debug count} {@debug count} B</p>
<p data-k="lines">A
    {@debug count}
    {@debug count}
    B</p>
<p data-k="glued">A {@debug count}{@debug count} B</p>
<p data-k="tight">A{@debug count} {@debug count}B</p>
<p data-k="before">A{@debug count} {@debug count} B</p>
<p data-k="expression">{count} {@debug count} {@debug count} {count}</p>
<p data-k="beside">{count}{@debug count} {@debug count}{count}</p>
<p data-k="element"><b>x</b>{@debug count} {@debug count} <b>y</b></p>
<p data-k="start">{@debug count} {@debug count} B</p>
<p data-k="spaced start"> {@debug count} {@debug count} B</p>
<p data-k="end">A {@debug count} {@debug count} {@debug count}</p>
<p data-k="void">A<br>{@debug count} {@debug count} B</p>
<pre data-k="pre">A {@debug count} {@debug count} B</pre>
<svg data-k="svg"><text>A {@debug count} {@debug count} B</text></svg>
<select data-k="select">{@debug count} {@debug count}<option>o</option>{@debug count} {@debug count} {@debug count}</select>
{#if count}
    {@debug count} {@debug count} C
{/if}
<div data-k="after block">{#if count}x{/if}{@debug count} {@debug count} {@debug count} D</div>
