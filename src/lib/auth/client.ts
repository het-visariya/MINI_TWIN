"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth. Only the pieces the forms need: everything else happens
 * through server actions so validation and rate limits cannot be skipped by
 * calling the API directly.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
