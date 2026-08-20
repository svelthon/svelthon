<!-- The side-by-side example from DJANGO.md, verbatim. A documentation page full
     of untested code is a liability; this fixture is what keeps it honest. -->
<script lang="python">
peps: list
status: str
</script>

<h1 data-k="title">{status or "All"} PEPs</h1>

<ul data-k="list">
  {#each peps as pep, i}
    <li>
      {i + 1}.
      <a href="/pep/{pep.number}">PEP {pep.number}</a>
      — {pep.title}
    </li>
  {:else}
    <li>Nothing here.</li>
  {/each}
</ul>

<p data-k="count">{len(peps)} shown</p>
