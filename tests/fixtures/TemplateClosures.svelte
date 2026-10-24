<script module>
    import { keep, slot } from './template_closures.js';
</script>

<script lang="python">
# Functions the template makes and hands an action, which keeps them, or a
# binding's target as it is written: each reads its block's name as the block
# holds it when called, as a closure reads its variable, save what Python
# reads as the function is made, a default or a factory's argument.
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
    <input data-k="write-object" bind:value={slot("object", lambda: row["label"]).value} />
    <input data-k="write-mixed" bind:value={slot("mixed", lambda kept=row["label"]: f"{kept} {row['label']}").value} />
    <input data-k="write-cell" bind:value={slot("cell", lambda: label).value} />
{/each}
{#each words as word}
    <i data-k="scalar" use:keep={lambda: word}></i>
{/each}
{#each ordered as row, at (row["id"])}
    <i data-k={f"index-{row['id']}"} use:keep={lambda: at}></i>
    <input data-k={f"write-index-{row['id']}"} bind:value={slot(f"index-{row['id']}", lambda: at).value} />
{/each}
