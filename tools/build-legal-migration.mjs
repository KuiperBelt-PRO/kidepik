import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const terms = fs.readFileSync(path.join(root, "supabase/legal/terms_v2.md"), "utf8");
const privacy = fs.readFileSync(path.join(root, "supabase/legal/privacy_v2.md"), "utf8");

function dollarTag(text, base) {
  let tag = base;
  let i = 0;
  while (text.includes(`$${tag}$`)) {
    i += 1;
    tag = `${base}_${i}`;
  }
  return tag;
}

const termsTag = dollarTag(terms, "md_terms_v2");
const privTag = dollarTag(privacy, "md_priv_v2");

const sql = `-- Documentos legales version 2 (textos ampliados para app educativa infantil).
insert into public.legal_documents (slug, version, title, body_markdown)
values
(
    'terms',
    2,
    'Términos de uso',
    $${termsTag}$${terms}$${termsTag}$
),
(
    'privacy',
    2,
    'Política de privacidad',
    $${privTag}$${privacy}$${privTag}$
)
on conflict (slug, version) do update set
    title = excluded.title,
    body_markdown = excluded.body_markdown,
    published_at = now();
`;

const out = path.join(root, "supabase/migrations/20260725140000_seed_legal_documents_v2.sql");
fs.writeFileSync(out, sql, "utf8");
console.log(`Wrote ${out} (${Buffer.byteLength(sql)} bytes)`);
