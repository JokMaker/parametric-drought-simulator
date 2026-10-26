// Lets Node's test runner load lib/ as written for Next.js: imports without a
// file extension ("./constants") resolve to the .ts file. Node strips the types.
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
