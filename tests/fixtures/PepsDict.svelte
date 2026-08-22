<script lang="python">
peps = [
    {"number": 8, "title": "Style Guide for Python Code", "year": 2001},
    {"number": 703, "title": "Making the GIL Optional", "year": 2023},
]


def url(pep):
    return "https://peps.python.org/pep-{:04d}/".format(pep["number"])
</script>

<ul>
    {#each peps as pep}
        <li><a href={url(pep)}>PEP {pep.number}</a> — {pep.title} ({pep.year})</li>
    {/each}
</ul>
