import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** 수료증 파일이 저장되는 Supabase Storage 버킷 이름 */
export const CERTIFICATES_BUCKET = "certificates";

let _client: SupabaseClient | null = null;

/**
 * JWT payload의 role 클레임을 파싱하여 service_role 키인지 확인한다.
 * anon 키가 잘못 설정된 경우 명확한 에러를 발생시키기 위해 사용한다.
 */
function assertServiceRoleKey(key: string): void {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString("utf8")) as { role?: string };
    if (payload.role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY has role="${payload.role ?? "unknown"}" — service_role 키가 아닙니다. ` +
          "Supabase 대시보드 → Settings → API → service_role 키를 사용하세요."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("service_role")) throw e;
    // JWT 파싱 실패는 무시하고 진행 (비표준 키 형식 허용)
  }
}

/**
 * Supabase 클라이언트를 요청 시점에 초기화한다.
 * dotenv.config() 이전에 모듈이 로드되어도 env 변수를 올바르게 읽을 수 있도록
 * 모듈 로드 시점이 아닌 최초 호출 시점에 createClient를 실행한다.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
    }

    assertServiceRoleKey(supabaseServiceKey);

    _client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  }

  return _client;
}
