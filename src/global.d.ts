/**
 * The template's `constants/theme.ts` imports `global.css` for its side effects,
 * which Metro understands but `tsc` does not without this declaration.
 */
declare module '*.css';
