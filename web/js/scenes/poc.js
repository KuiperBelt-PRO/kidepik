import { config } from "../config.js";
import { navigate } from "../lib/router.js";
import { mountSceneBackground } from "../components/ui.js";

const TEST_EMAIL = "poc@test.kidepik.local";
const TEST_PASSWORD = "poc-test-123456";

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function statusClass(ok) {
  if (ok === null) return "";
  return ok ? "poc-card__status--ok" : "poc-card__status--err";
}

function statusText(ok) {
  if (ok === null) return "pendiente";
  return ok ? "OK" : "ERROR";
}

export function renderPoc() {
  const app = document.getElementById("app");
  if (!app) return;

  const scene = document.createElement("div");
  scene.className = "scene";
  mountSceneBackground(scene);

  const scroll = document.createElement("div");
  scroll.className = "scene-scroll scene-content";

  scroll.innerHTML = `
    <h1 style="font-family:var(--font-display);text-align:center">POC arquitectura</h1>
    <p style="text-align:center;opacity:0.85">FastAPI + Supabase + MinIO</p>
    <div id="poc-fastapi" class="poc-card"><strong>FastAPI</strong><div class="poc-card__status">pendiente</div><pre class="poc-detail"></pre></div>
    <div id="poc-supabase" class="poc-card"><strong>Supabase</strong><div class="poc-card__status">pendiente</div><pre class="poc-detail"></pre></div>
    <div id="poc-storage" class="poc-card"><strong>MinIO / R2</strong><div class="poc-card__status">pendiente</div><pre class="poc-detail"></pre></div>
    <button type="button" class="btn btn--primary" id="poc-run">Ejecutar pruebas</button>
    <button type="button" class="btn btn--ghost" id="poc-back" style="margin-top:12px">← Galería</button>
  `;

  scene.appendChild(scroll);
  app.appendChild(scene);

  const setCard = (id, ok, detail) => {
    const card = scroll.querySelector(`#${id}`);
    if (!card) return;
    const st = card.querySelector(".poc-card__status");
    const pre = card.querySelector(".poc-detail");
    if (st) {
      st.textContent = statusText(ok);
      st.className = `poc-card__status ${statusClass(ok)}`;
    }
    if (pre) pre.textContent = detail;
  };

  scroll.querySelector("#poc-back")?.addEventListener("click", () => navigate("/gallery"));

  scroll.querySelector("#poc-run")?.addEventListener("click", async () => {
    const btn = scroll.querySelector("#poc-run");
    if (btn) btn.disabled = true;

    try {
      const healthRes = await fetchWithTimeout(`${config.apiUrl}/health`);
      const healthBody = await healthRes.json();
      setCard(
        "poc-fastapi",
        healthRes.ok && healthBody.status === "ok",
        JSON.stringify(healthBody),
      );

      const { createClient } = await import(
        "https://esm.sh/@supabase/supabase-js@2.49.1"
      );
      const sb = createClient(config.supabaseUrl, config.supabaseAnonKey);
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      if (authErr) {
        setCard("poc-supabase", false, authErr.message);
        setCard("poc-storage", false, "omitido (sin auth)");
        return;
      }

      const { data: row, error: dbErr } = await sb
        .from("poc_health")
        .select("message")
        .limit(1)
        .single();
      setCard(
        "poc-supabase",
        !dbErr && row?.message === "poc ready",
        dbErr ? dbErr.message : JSON.stringify(row),
      );

      const token = authData.session?.access_token;
      if (!token) {
        setCard("poc-storage", false, "sin access_token");
        return;
      }

      const presignRes = await fetchWithTimeout(
        `${config.apiUrl}/api/v1/storage/presign-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filename: `poc-${Date.now()}.txt` }),
        },
      );
      if (!presignRes.ok) {
        setCard("poc-storage", false, await presignRes.text());
        return;
      }
      const { upload_url: uploadUrl, public_url: publicUrl } =
        await presignRes.json();
      const body = `poc-web-${Date.now()}`;
      const up = await fetchWithTimeout(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body,
      });
      const verify = await fetchWithTimeout(publicUrl);
      const text = await verify.text();
      setCard(
        "poc-storage",
        up.ok && verify.ok && text === body,
        `public_url=${publicUrl}\nbody=${text}`,
      );
    } catch (e) {
      setCard("poc-fastapi", false, String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
