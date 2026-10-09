import { createHandler, readConfiguration } from "./handler.mjs";

// Public requests are authorized by server-side Turnstile and the database gate.
// No frontend field can select an origin, backend URL, secret or privileged role.
const configuration = readConfiguration((name: string) => Deno.env.get(name));
Deno.serve(createHandler({ configuration }));
