import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  checkArchitectureStatus,
  checkFastApiHealth,
  presignAndUpload,
  type CheckResult,
} from "../lib/api";
import { config } from "../lib/config";
import { supabase } from "../lib/supabase";
import { GameButton } from "../components/GameButton";
import { ThemeBackground } from "../components/ThemeBackground";
import { tokens } from "../theme/tokens";

type LayerStatus = {
  label: string;
  ok: boolean | null;
  detail: string;
};

const TEST_EMAIL = "poc@test.kidepik.local";
const TEST_PASSWORD = "poc-test-123456";

function StatusCard({ label, ok, detail }: LayerStatus) {
  const color =
    ok === null ? "#888" : ok ? "#1b7f3a" : "#b00020";

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={[styles.badge, { color }]}>
        {ok === null ? "pendiente" : ok ? "OK" : "ERROR"}
      </Text>
      {detail ? (
        <Text style={styles.detail} selectable>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

type Props = {
  onBack: () => void;
};

/** Pantalla POC de arquitectura (FastAPI + Supabase + MinIO). */
export function PocArchitectureScreen({ onBack }: Props) {
  const [busy, setBusy] = useState(false);
  const [fastApi, setFastApi] = useState<LayerStatus>({
    label: "FastAPI (Cloud Run sim)",
    ok: null,
    detail: "",
  });
  const [supabaseStatus, setSupabaseStatus] = useState<LayerStatus>({
    label: "Supabase (Auth + DB)",
    ok: null,
    detail: "",
  });
  const [storage, setStorage] = useState<LayerStatus>({
    label: "R2 sim (MinIO)",
    ok: null,
    detail: "",
  });

  const apply = (
    setter: (value: LayerStatus) => void,
    label: string,
    result: CheckResult,
  ) => {
    setter({ label, ok: result.ok, detail: result.detail });
  };

  const runAllChecks = async () => {
    if (!config.supabaseAnonKey) {
      setSupabaseStatus({
        label: "Supabase (Auth + DB)",
        ok: false,
        detail:
          "Falta EXPO_PUBLIC_SUPABASE_ANON_KEY en mobile/.env — ejecuta supabase status",
      });
      return;
    }

    setBusy(true);
    try {
      const health = await checkFastApiHealth();
      apply(setFastApi, "FastAPI (Cloud Run sim)", health);

      const arch = await checkArchitectureStatus();
      apply(setFastApi, "FastAPI (Cloud Run sim)", {
        ok: health.ok && arch.ok,
        detail: `${health.detail}\n\n${arch.detail}`,
      });

      const signUp = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      let session = signUp.data.session;
      if (!session) {
        const signIn = await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });
        session = signIn.data.session;
        if (signIn.error) {
          apply(setSupabaseStatus, "Supabase (Auth + DB)", {
            ok: false,
            detail: signIn.error.message,
          });
          return;
        }
      }

      const { data: healthRow, error: dbError } = await supabase
        .from("poc_health")
        .select("message")
        .eq("id", 1)
        .single();

      if (dbError) {
        apply(setSupabaseStatus, "Supabase (Auth + DB)", {
          ok: false,
          detail: dbError.message,
        });
        return;
      }

      apply(setSupabaseStatus, "Supabase (Auth + DB)", {
        ok: true,
        detail: `Auth OK · poc_health.message=${healthRow?.message ?? "?"}`,
      });

      setStorage({
        label: "R2 sim (MinIO)",
        ok: null,
        detail: "Subiendo vía presigned URL…",
      });

      const token = session?.access_token;
      if (!token) {
        apply(setStorage, "R2 sim (MinIO)", {
          ok: false,
          detail: "Sin access_token de Supabase",
        });
        return;
      }

      const upload = await presignAndUpload(
        token,
        "poc-architecture.txt",
        "kidepik-poc-ok",
      );
      apply(setStorage, "R2 sim (MinIO)", upload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemeBackground>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.title}>KidepiK — POC arquitectura</Text>
        <Text style={styles.subtitle}>
          Valida FastAPI + Supabase + R2 (MinIO)
        </Text>
        <Text style={styles.config} selectable>
          API: {config.apiUrl}
          {"\n"}
          Supabase: {config.supabaseUrl}
        </Text>

        <Button
          title={busy ? "Probando…" : "Ejecutar pruebas de arquitectura"}
          onPress={runAllChecks}
          disabled={busy}
        />

        {busy ? <ActivityIndicator style={styles.spinner} /> : null}

        <ScrollView style={styles.results}>
          <StatusCard {...fastApi} />
          <StatusCard {...supabaseStatus} />
          <StatusCard {...storage} />
        </ScrollView>

        <GameButton label="Volver a galería" variant="ghost" onPress={onBack} />
      </View>
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 12,
  },
  config: {
    fontSize: 12,
    color: "#aaa",
    marginBottom: 16,
    fontFamily: "monospace",
  },
  spinner: {
    marginVertical: 12,
  },
  results: {
    marginTop: 16,
    flex: 1,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  badge: {
    marginTop: 6,
    fontWeight: "700",
  },
  detail: {
    marginTop: 8,
    fontSize: 12,
    color: "#333",
    fontFamily: "monospace",
  },
});
