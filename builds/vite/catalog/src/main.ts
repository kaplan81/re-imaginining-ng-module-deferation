/**
 * A remote initialises nothing: with classic Module Federation the container
 * runtime is installed by the plugin's own generated entry, so unlike build 1
 * there is no `initFederation({})` call to make here.
 *
 * The `main` -> `bootstrap` split still matters. Module Federation needs the
 * async boundary for the same reason Native Federation does: the share scope
 * has to exist before any shared module is evaluated, and a static import in
 * this file would evaluate `@angular/core` too early.
 */
import('./bootstrap').catch((err) => console.error(err));
