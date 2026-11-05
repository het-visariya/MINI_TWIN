/**
 * The class-name merger, re-exported from one place.
 *
 * The implementation is shadcn's `cn` package — a compiled drop-in for
 * clsx + tailwind-merge, which is why neither of those is a dependency any
 * more. Everything imports it from here rather than from "cn" directly,
 * because that is the alias `components.json` declares (`utils: @/lib/utils`)
 * and because it leaves exactly one line to change if the implementation ever
 * moves again.
 */

export { cn } from "cn";
