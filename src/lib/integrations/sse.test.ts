/**
 * The SSE frame parser.
 *
 * Guards a bug that failed in the worst possible way: Google's endpoint
 * separates frames with CRLF, the parser split on "\n\n" alone, and so it
 * never found a single frame boundary. The HTTP call succeeded, the model
 * replied, and the answer came back empty with no error anywhere — the
 * tokens were silently dropped on the floor.
 *
 * Hence the first two tests. The rest cover the properties that make a
 * streaming parser correct rather than merely working on a good day: a chunk
 * boundary may fall anywhere, including inside a JSON object.
 */

import { describe, expect, it } from "vitest";

import { sseEvents } from "@/lib/integrations/twin-llm";

/** A body that delivers exactly the chunks given, as the network would. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const event of sseEvents(bodyOf(chunks))) out.push(event);
  return out;
}

describe("sseEvents", () => {
  it("parses CRLF-delimited frames — the form Google actually sends", async () => {
    const events = await collect([
      'data: {"n":1}\r\n\r\ndata: {"n":2}\r\n\r\n',
    ]);

    expect(events).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("parses bare-LF frames too, so neither form can regress quietly", async () => {
    expect(await collect(['data: {"n":1}\n\ndata: {"n":2}\n\n'])).toEqual([
      { n: 1 },
      { n: 2 },
    ]);
  });

  it("waits for a whole frame when a chunk splits one mid-JSON", async () => {
    /* The case that makes buffering necessary: neither half is valid JSON. */
    const events = await collect(['data: {"text":"hel', 'lo"}\r\n\r\n']);

    expect(events).toEqual([{ text: "hello" }]);
  });

  it("handles a frame boundary split across two chunks", async () => {
    expect(await collect(['data: {"n":1}\r', '\n\r\ndata: {"n":2}\r\n\r\n'])).toEqual([
      { n: 1 },
      { n: 2 },
    ]);
  });

  it("skips a malformed frame rather than ending the answer", async () => {
    /* One bad frame must not cost the rest of the sentence. */
    const events = await collect([
      'data: {"n":1}\r\n\r\ndata: {not json\r\n\r\ndata: {"n":3}\r\n\r\n',
    ]);

    expect(events).toEqual([{ n: 1 }, { n: 3 }]);
  });

  it("ignores [DONE] and empty payloads", async () => {
    expect(
      await collect(['data: {"n":1}\r\n\r\ndata: [DONE]\r\n\r\ndata: \r\n\r\n']),
    ).toEqual([{ n: 1 }]);
  });

  it("ignores non-data lines such as comments and event names", async () => {
    expect(
      await collect([': keep-alive\r\n\r\nevent: ping\r\n\r\ndata: {"n":1}\r\n\r\n']),
    ).toEqual([{ n: 1 }]);
  });

  it("drops a trailing frame that never got its blank line", async () => {
    /* Incomplete at end-of-stream: parsing it would mean guessing. */
    expect(await collect(['data: {"n":1}\r\n\r\ndata: {"n":2}'])).toEqual([{ n: 1 }]);
  });
});
