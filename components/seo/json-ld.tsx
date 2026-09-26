/**
 * Structured data as a `<script type="application/ld+json">`.
 *
 * The JSON goes in as the script's text child, not through `dangerouslySetInnerHTML`: React writes a
 * script's text content through unescaped, so the JSON arrives intact, and every `<` is written as
 * `\u003c` so nothing in the data can close the tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json">{JSON.stringify(data).replace(/</g, "\\u003c")}</script>;
}
