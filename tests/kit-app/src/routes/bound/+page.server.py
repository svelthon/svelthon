# A load() bound by a call rather than by a def, which SvelteKit reads all the
# same.
def _loader(word):
    def load(event):
        return {"word": word}
    return load


load = _loader("bound by a call")
