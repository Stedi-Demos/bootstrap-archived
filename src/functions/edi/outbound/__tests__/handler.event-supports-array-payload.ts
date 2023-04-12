import test from "ava";
import { OutboundEventSchema } from "../../../../lib/types/OutboundEvent.js";

test("outbound event schema supports array value for payload", (t) => {
  const input = {
    metadata: {
      sendingPartnerId: "this-is-me",
      receivingPartnerId: "anothermerch",
    },
    payload: [
      {
        foo: "bar",
      },
    ],
  };

  const event = OutboundEventSchema.parse(input);
  t.assert(event.payload.length === 1);
});
