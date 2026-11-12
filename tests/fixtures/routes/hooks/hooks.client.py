# Client hooks bound by calls.
def _made(name):
    def hook(*given):
        return name

    return hook


handleError = _made("handleError")
init = _made("init")
