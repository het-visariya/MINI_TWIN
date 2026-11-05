/**
 * What the chat endpoint will accept.
 *
 * `consented` is the one worth reading. It is not a UI nicety: the route
 * refuses to send anything to the model without it and records the agreement
 * in `AiConsentLog`, so a POST made straight to the API is stopped by the same
 * rule as the screen. The consent is per session, because "you agreed once in
 * March" is not meaningful consent for what is sent today.
 */

import { z } from "zod";

export const twinChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a question first.")
    /* Long enough for a real question with context pasted in, short enough
       that a runaway client cannot push a book through the model on the
       user's quota. */
    .max(2_000, "That is longer than your twin can take in one message."),

  /**
   * Groups a conversation. Supplied by the client so a reply lands in the
   * thread it was typed into; validated as an id, never trusted as a filter —
   * every read is scoped by userId as well.
   */
  threadId: z.string().trim().min(1).max(64),

  /** The user has seen the data sheet and agreed, in this session. */
  consented: z.literal(true, {
    message: "Your twin needs your approval before it can read your numbers.",
  }),

  /**
   * False when the user has switched health data off. Defaults to off: if the
   * field is missing because a client forgot it, the safer reading is that
   * health data was not permitted.
   */
  healthDataAllowed: z.boolean().default(false),
});

export type TwinChatInput = z.infer<typeof twinChatSchema>;
