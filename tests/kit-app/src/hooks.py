"""The universal hooks, run on the server and in the browser, the application's
own transport among them."""

__js__ = {"#lib/ledger.js": ["transport"]}


def reroute(given):
    if given.url.pathname == "/rerouted":
        return "/load"
