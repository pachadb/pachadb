import { SaxesParser } from "saxes";

const fixture = ".fixtures/onepiece/onepiece_pages_current.xml";
const count = Number(Bun.argv[2] ?? "500");
if (!Number.isSafeInteger(count) || count < 1 || count > 50_000) throw new Error("pages must be 1..50000");

interface Page { id: string; title: string; text: string; redirect?: string }
const pages: Page[] = [];
let page: Partial<Page> | undefined;
let ns = "";
let buffer = "";
const stack: string[] = [];
const parser = new SaxesParser({ xmlns: false });
parser.on("opentag", tag => {
  stack.push(tag.name);
  if (stack.length === 2 && tag.name === "page") { page = {}; ns = ""; }
  if (page && stack.length === 3 && tag.name === "redirect") {
    const title = tag.attributes["title"];
    if (typeof title === "string") page.redirect = title;
  }
  if (page && (stack.join("/") === "mediawiki/page/title" || stack.join("/") === "mediawiki/page/ns" || stack.join("/") === "mediawiki/page/id" || stack.join("/") === "mediawiki/page/revision/text")) buffer = "";
});
parser.on("text", text => {
  if (page && (stack.join("/") === "mediawiki/page/title" || stack.join("/") === "mediawiki/page/ns" || stack.join("/") === "mediawiki/page/id" || stack.join("/") === "mediawiki/page/revision/text")) buffer += text;
});
parser.on("cdata", text => {
  if (page && stack.join("/") === "mediawiki/page/revision/text") buffer += text;
});
parser.on("closetag", tag => {
  if (page) {
    const path = stack.join("/");
    if (path === "mediawiki/page/title") page.title = buffer;
    else if (path === "mediawiki/page/ns") ns = buffer;
    else if (path === "mediawiki/page/id") page.id = buffer;
    else if (path === "mediawiki/page/revision/text") page.text = buffer;
    else if (path === "mediawiki/page" && ns === "0" && page.id && page.title) pages.push({ id: page.id, title: page.title, text: page.text ?? "", ...(page.redirect ? { redirect: page.redirect } : {}) });
  }
  const popped = stack.pop();
  if (popped !== tag.name) throw new Error("invalid parser stack");
  if (tag.name === "page") page = undefined;
});
const reader = Bun.file(fixture).stream().getReader();
const decoder = new TextDecoder();
while (pages.length < count) {
  const { value, done } = await reader.read();
  if (done) break;
  parser.write(decoder.decode(value, { stream: true }));
}
await reader.cancel();
if (pages.length > count) pages.length = count;

function canonical(raw: string): string {
  const name = raw.split("#", 1)[0]?.replaceAll("_", " ").replace(/\s+/g, " ").trim() ?? "";
  return name ? name[0]!.toUpperCase() + name.slice(1) : "";
}
const byTitle = new Map(pages.map(p => [canonical(p.title), p]));
const byId = new Map(pages.map(p => [p.id, p]));
const links = new Map<string, Set<string>>();
let unresolved = 0;
let extracted = 0;
for (const p of pages) {
  const edges = new Set<string>();
  if (!p.redirect) {
    for (const match of p.text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
      const target = canonical(match[1]!.split("|", 1)[0]!);
      if (!target || target.includes(":")) continue;
      extracted++;
      let linked = byTitle.get(target);
      if (linked?.redirect) linked = byTitle.get(canonical(linked.redirect));
      if (linked && !linked.redirect) edges.add(linked.id);
      else unresolved++;
    }
  }
  links.set(p.id, new Set([...edges].slice(0, 20)));
}
// An independent reference traversal for validating a future FokosDB path query.
// Bound each intermediate node's degree, so a test also exercises realistic query budgets.
const paths: Array<{ hops: number; ids: string[]; titles: string[] }> = [];
for (const hops of [2, 3, 4]) {
  const walk = (path: string[]): string[] | undefined => {
    if (path.length === hops + 1) return path;
    for (const next of links.get(path.at(-1)!) ?? []) {
      if (path.includes(next)) continue;
      const found = walk([...path, next]);
      if (found) return found;
    }
  };
  let found: string[] | undefined;
  for (const start of pages) {
    found = walk([start.id]);
    if (found) break;
  }
  if (found) paths.push({ hops, ids: found, titles: found.map(id => byId.get(id)?.title ?? "MISSING") });
}
const manifest = {
  source: "https://s3.amazonaws.com/wikia_xml_dumps/o/on/onepiece_pages_current.xml.7z",
  pages: pages.length, redirects: pages.filter(p => p.redirect).length,
  extractedLinks: extracted, unresolvedLinks: unresolved,
  resolvedDistinctLinks: [...links.values()].reduce((n, targets) => n + targets.size, 0), paths,
};
await Bun.write(`.fixtures/onepiece/graph-${count}.json`, JSON.stringify({ manifest, pages: pages.map(p => ({ id: p.id, title: p.title, links: [...(links.get(p.id) ?? [])] })) }));
console.log(JSON.stringify(manifest, null, 2));
if (pages.length < count || paths.length < 3) process.exitCode = 1;
