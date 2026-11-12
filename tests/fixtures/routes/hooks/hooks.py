# Universal hooks bound by a call and by a value.
def _made(name):
    def hook(*given):
        return name

    return hook


reroute = _made("reroute")
transport = {}
