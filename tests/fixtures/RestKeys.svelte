<script lang="python">
# A key taken by a computed key and left out of `...rest`: an int, a str and a
# bool, on JavaScript rows, and the int on a dict.
importjs {years, flags} from './rest_keys.js'

year = 2024
numbers = [{2024: "then", 2025: "now", "label": "L"}]
</script>

{#each years as {[year]: value, ...rest}}
    <p data-k="year">{value}|{",".join(sorted(rest))}</p>
{/each}
{#each flags as {[0]: value, ...rest}}
    <p data-k="int">{value}|{",".join(sorted(rest))}</p>
{/each}
{#each flags as {["0"]: value, ...rest}}
    <p data-k="str">{value}|{",".join(sorted(rest))}</p>
{/each}
{#each flags as {[True]: value, ...rest}}
    <p data-k="bool">{value}|{",".join(sorted(rest))}</p>
{/each}
{#each numbers as {[year]: value, ...rest}}
    <p data-k="dict">{value}|{",".join(sorted(map(str, rest)))}</p>
{/each}
