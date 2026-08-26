<script lang="python">
class Pep:
    def __init__(self, number, title, year):
        self.number = number
        self.title = title
        self.year = year

    @property
    def url(self):
        return "https://peps.python.org/pep-{:04d}/".format(self.number)


peps = [
    Pep(8, "Style Guide for Python Code", 2001),
    Pep(703, "Making the GIL Optional", 2023),
]
</script>

<ul>
    {#each peps as pep}
        <li><a href={pep.url}>PEP {pep.number}</a> — {pep.title} ({pep.year})</li>
    {/each}
</ul>
