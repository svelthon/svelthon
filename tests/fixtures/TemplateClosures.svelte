<script module>
    import { keep } from './template_closures.js';
</script>

<script lang="python">
# Functions the template makes and hands an action, which keeps them: each
# reads its block's name as the block holds it when called, as a closure reads
# its variable, save what Python reads as the function is made, a default or a
# factory's argument.
rows = [{"label": "first"}]
words = ["first"]
ordered = [{"id": 1}, {"id": 2}]


def make(row):
    return lambda: row["label"]


@export
def change():
    rows[0] = {"label": "second"}
    words[0] = "second"
    ordered.reverse()
</script>

{#each rows as row}
    <i data-k="object" use:keep={lambda: row["label"]}></i>
    <i data-k="optional" use:keep={lambda extra=None: row["label"]}></i>
    <i data-k="generator" use:keep={(lambda gen: lambda: next(gen))((row["label"] for _ in range(2)))}></i>
    <i data-k="comprehension" use:keep={[lambda: row["label"] for _ in [0]][0]}></i>
    <i data-k="default" use:keep={lambda label=row["label"]: label}></i>
    <i data-k="factory" use:keep={make(row)}></i>
    {label = "first"}
    <input data-k="field" bind:value={label} />
    <i data-k="cell" use:keep={lambda: label}></i>
{/each}
{#each words as word}
    <i data-k="scalar" use:keep={lambda: word}></i>
{/each}
{#each ordered as row, at (row["id"])}
    <i data-k={f"index-{row['id']}"} use:keep={lambda: at}></i>
{/each}
