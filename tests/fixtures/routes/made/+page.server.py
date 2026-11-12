def _make(phase):
    def load(event):
        return {"phase": phase}
    return load


load = _make("made")
ssr = False
