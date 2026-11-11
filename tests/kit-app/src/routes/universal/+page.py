# A universal route module, which SvelteKit runs on the server and again in the
# browser: what it returns is a plain object to SvelteKit on both.
def load(event):
    return {"answer": 7 * 6, "path": event["url"]}
