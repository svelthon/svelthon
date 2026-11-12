# Server hooks bound by calls, as `handle = sequence(first, second)` binds one.
def _made(name):
    def hook(*given):
        return name

    return hook


handle = _made("handle")
handleFetch = _made("handleFetch")
handleError = _made("handleError")
init = _made("init")
