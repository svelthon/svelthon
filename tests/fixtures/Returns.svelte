<script lang="python">
# What a JavaScript function hands back to Python. The outbound half of the
# boundary — Python values going out — was always converted; the inbound half
# was not, so a number came back as a raw JSObject that could not even be
# multiplied.
importjs {aFloat, anInt, aString, anObject, anArray, aFunction, aPromise} from "./returns.js"


def attempt(fn):
    try:
        return str(fn())
    except Exception as e:
        return "raised " + type(e).__name__


kind = type(aFloat()).__name__
rounded = attempt(lambda: round(aFloat(), 3))
arithmetic = attempt(lambda: aFloat() * 2 > 2.8)
formatted = attempt(lambda: "{:.3f}".format(aFloat()))
integer = attempt(lambda: type(anInt()).__name__)
text = attempt(lambda: aString().upper())
field = attempt(lambda: anObject().name)
listed = attempt(lambda: len(anArray()) + sum(anArray()))
called = attempt(lambda: aFunction()(5))


async def awaited():
    return await aPromise()
</script>

<p data-k="kind">{kind}</p>
<p data-k="rounded">{rounded}</p>
<p data-k="arithmetic">{arithmetic}</p>
<p data-k="formatted">{formatted}</p>
<p data-k="integer">{integer}</p>
<p data-k="text">{text}</p>
<p data-k="field">{field}</p>
<p data-k="listed">{listed}</p>
<p data-k="called">{called}</p>

{#await awaited()}<p data-k="promise">waiting</p>{:then got}<p data-k="promise">{got}</p>{/await}
