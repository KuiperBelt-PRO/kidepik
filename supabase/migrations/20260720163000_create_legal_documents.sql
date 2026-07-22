-- Documentos legales versionados (Términos / Privacidad).
create table if not exists public.legal_documents (
    id uuid primary key default gen_random_uuid(),
    slug text not null check (slug in ('terms', 'privacy')),
    version integer not null check (version > 0),
    title text not null,
    body_markdown text not null,
    published_at timestamptz not null default now(),
    unique (slug, version)
);

create index if not exists legal_documents_slug_published_idx
    on public.legal_documents (slug, published_at desc);

alter table public.legal_documents enable row level security;

grant select on public.legal_documents to anon, authenticated;

drop policy if exists "Allow public read legal_documents" on public.legal_documents;
create policy "Allow public read legal_documents"
    on public.legal_documents
    for select
    to anon, authenticated
    using (true);

insert into public.legal_documents (slug, version, title, body_markdown)
values
(
    'terms',
    1,
    'Términos de uso',
    $md$
# Términos de uso

**Borrador de producto (no constituye asesoría legal).** Versión 1 — KidepiK.

## 1. Quién usa la cuenta

KidepiK está pensado para niños de aproximadamente 7 a 9 años. La cuenta la crea y gestiona un **padre, madre o tutor legal**. Al continuar con el registro, declaras que eres esa persona responsable.

## 2. Uso del servicio

Te comprometes a usar la aplicación de forma adecuada, respetuosa y conforme a la ley. No está permitido:

- Usar la cuenta de forma fraudulenta o suplantar a otra persona.
- Intentar vulnerar la seguridad del servicio o de otros usuarios.
- Subir contenido ilegal, ofensivo o que vulnere derechos de terceros.

## 3. Contenido y mundos

Las historias, mundos y materiales generados o mostrados en KidepiK son para uso personal y educativo dentro de la aplicación. No concedemos licencias comerciales sobre la marca KidepiK ni sobre los activos de terceros.

## 4. Disponibilidad

El servicio se ofrece «tal cual». Podemos modificar, suspender o discontinuar funciones con aviso razonable cuando sea posible.

## 5. Limitación

En la medida permitida por la ley aplicable, KidepiK y Kuiper Belt no responden de daños indirectos derivados del uso del servicio.

## 6. Contacto

Para dudas sobre estos términos, contacta con el equipo de soporte de KidepiK a través de los canales indicados en la aplicación o en el sitio web del producto.

## 7. Cambios

Podemos publicar versiones nuevas de estos términos. La aplicación mostrará siempre la **última versión** publicada.
$md$
),
(
    'privacy',
    1,
    'Política de privacidad',
    $md$
# Política de privacidad

**Borrador de producto (no constituye asesoría legal).** Versión 1 — KidepiK.

## 1. Responsable

El tratamiento de datos asociado a la cuenta de padre/tutor de KidepiK lo gestiona el equipo del producto (Kuiper Belt / KidepiK). Esta política describe, a alto nivel, qué datos se usan y con qué fin.

## 2. Datos que tratamos

Según el uso de la app, podemos tratar:

- Datos de la cuenta del adulto (p. ej. correo asociado al proveedor OAuth, como Google).
- Identificadores técnicos de sesión y preferencias básicas de la aplicación.
- Contenido que subas o generes en el contexto del producto (p. ej. media asociada a mundos), cuando esa función esté activa.

No pedimos al niño una cuenta propia en el MVP: la cuenta es del tutor.

## 3. Finalidades

- Autenticar y mantener la sesión del tutor.
- Prestar el servicio educativo / de juego (mundos, progreso, media).
- Mejorar la estabilidad y seguridad del producto.
- Cumplir obligaciones legales aplicables.

## 4. Base y conservación

Tratamos los datos porque son necesarios para prestar el servicio que solicitas y, en su caso, por interés legítimo en la seguridad del sistema. Conservamos la información mientras la cuenta esté activa y los plazos adicionales que exija la ley.

## 5. Encargados y proveedores

Usamos proveedores de infraestructura (por ejemplo autenticación y base de datos) bajo contratos y medidas de seguridad adecuadas. Los datos pueden tratarse en regiones donde operen esos proveedores.

## 6. Derechos

Según la normativa aplicable (p. ej. RGPD), puedes solicitar acceso, rectificación, supresión, limitación u oposición, y presentar una reclamación ante la autoridad de control. Para ejercer derechos, contacta con soporte KidepiK.

## 7. Menores

Diseñamos el producto para que la cuenta la gestione un adulto responsable. Si detectas una cuenta creada por un menor sin consentimiento parental, contacta con nosotros para proceder a su revisión o baja.

## 8. Cambios

Podemos actualizar esta política. La aplicación mostrará siempre la **última versión** publicada.
$md$
)
on conflict (slug, version) do update set
    title = excluded.title,
    body_markdown = excluded.body_markdown,
    published_at = now();
