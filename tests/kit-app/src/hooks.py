"""The universal hooks, run on the server and in the browser."""


def reroute(given):
    if given.url.pathname == "/rerouted":
        return "/load"
