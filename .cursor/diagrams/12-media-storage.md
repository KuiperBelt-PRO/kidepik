# 12 — Media storage

**Specs:** [SPEC_MEDIA_STORAGE.md](../specify/SPEC_MEDIA_STORAGE.md)

```mermaid
flowchart LR
  Client[Cliente autenticado] -->|POST prepare-upload Bearer| API[StorageController]
  API -->|UploadPlan + token| Client
  Client -->|POST /storage/upload| API
  API --> Driver[StorageDriverFactory]
  Driver --> Local[LocalFilesystemDriver]
  Local --> Disk["MEDIA_ROOT = web/media/"]
  Nginx[nginx GET /media/*] --> Disk
```

## Hechos

| Concepto | Valor |
| --- | --- |
| Driver | solo `STORAGE_DRIVER=local` |
| Disco | `web/media/` |
| Lectura | nginx sirve `/media/` |
| DB | solo URLs texto |

## Descartado

R2, S3, MinIO, `S3ObjectStorageDriver`, alias `presign-upload`.

## Anti-errores

- No reintroducir object storage cloud sin decisión explícita.
- No servir uploads sin auth en `prepare-upload`.
