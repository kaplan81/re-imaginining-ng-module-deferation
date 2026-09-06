/**
 * Step 1 of the plan: no federation at all, just Angular through Rspack.
 *
 * The split into `main` + `bootstrap` is kept even here, because step 2 turns
 * this file into the federation entry point and Module Federation needs the
 * async boundary for the same reason Native Federation does - the share scope
 * has to be negotiated before any shared module is evaluated.
 */
import('./bootstrap').catch((err) => console.error(err));
