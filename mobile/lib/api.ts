import { config } from "./config";

export type CheckResult = {
  ok: boolean;
  detail: string;
};

const FETCH_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkFastApiHealth(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(`${config.apiUrl}/health`);
    const body = await response.json();
    return {
      ok: response.ok && body.status === "ok",
      detail: JSON.stringify(body),
    };
  } catch (error) {
    return { ok: false, detail: String(error) };
  }
}

export async function checkArchitectureStatus(): Promise<CheckResult> {
  try {
    const response = await fetchWithTimeout(
      `${config.apiUrl}/api/v1/architecture/status`,
    );
    const body = await response.json();
    const ok =
      body?.api?.ok === true &&
      body?.supabase?.ok === true &&
      body?.storage?.ok === true;
    return { ok, detail: JSON.stringify(body, null, 2) };
  } catch (error) {
    return { ok: false, detail: String(error) };
  }
}

export async function presignAndUpload(
  accessToken: string,
  filename: string,
  content: string,
): Promise<CheckResult> {
  try {
    const presignResponse = await fetchWithTimeout(
      `${config.apiUrl}/api/v1/storage/presign-upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename }),
      },
    );

    if (!presignResponse.ok) {
      return {
        ok: false,
        detail: `presign failed: ${await presignResponse.text()}`,
      };
    }

    const { upload_url: uploadUrl, public_url: publicUrl } =
      await presignResponse.json();

    if (uploadUrl.includes("10.0.2.2")) {
      return {
        ok: false,
        detail:
          "upload_url apunta a 10.0.2.2 (solo emulador). Reinicia API con ./scripts/poc-expo-go.ps1",
      };
    }

    const uploadResponse = await fetchWithTimeout(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: content,
    });

    if (!uploadResponse.ok) {
      return {
        ok: false,
        detail: `upload failed: HTTP ${uploadResponse.status} → ${uploadUrl}`,
      };
    }

    const verifyResponse = await fetchWithTimeout(publicUrl);
    const text = await verifyResponse.text();

    return {
      ok: verifyResponse.ok && text === content,
      detail: `upload_url host OK\npublic_url=${publicUrl}\nbody=${text}`,
    };
  } catch (error) {
    const message = String(error);
    if (message.includes("AbortError") || message.includes("aborted")) {
      return {
        ok: false,
        detail:
          "Timeout subiendo a MinIO (puerto 9000). Abre el firewall Windows para red privada o ejecuta ./scripts/poc-expo-go.ps1",
      };
    }
    return { ok: false, detail: message };
  }
}
