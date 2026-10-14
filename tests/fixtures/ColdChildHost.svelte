<script lang="python">
# A child held by a prop rather than named by its import, handed a value of a
# subclass of float.
Child: object = None


class Price(float):
    pass


price = Price(0.5)
</script>

<Child value={price} />
