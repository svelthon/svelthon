# An instance of a class of `src/lib/server/`, which the transport refuses on
# the server, with a message, rather than hand the browser a name it cannot
# import.
__js__ = {"#lib/server/vault.py": ["Vault"]}
__all__ = ["load"]


def load(event):
    return {"value": Vault()}
