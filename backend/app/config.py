"""Application settings loaded from environment."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for API and object storage."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "kidepik-api"
    host: str = "0.0.0.0"
    port: int = 8080

    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters-long"
    supabase_jwt_audience: str = "authenticated"

    # Public URLs exposed to mobile clients (emulator-friendly defaults).
    public_api_url: str = "http://10.0.2.2:8080"
    public_supabase_url: str = "http://10.0.2.2:54321"
    public_storage_url: str = "http://10.0.2.2:9000"

    # S3-compatible storage (MinIO local / Cloudflare R2 production).
    s3_endpoint_url: str = "http://minio:9000"
    # Host reachable from the phone (emulator 10.0.2.2 or LAN IP); used in presigned URLs.
    s3_external_endpoint_url: str = "http://10.0.2.2:9000"
    s3_access_key_id: str = "kidepik"
    s3_secret_access_key: str = "kidepik-local-secret"
    s3_bucket: str = "kidepik-media"
    s3_region: str = "auto"
    s3_public_base_url: str = "http://10.0.2.2:9000/kidepik-media"


settings = Settings()
