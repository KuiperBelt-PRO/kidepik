/** Emulator-friendly defaults — override via mobile/.env */

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8080",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://10.0.2.2:54321",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
