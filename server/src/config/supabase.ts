import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** 수료증 파일이 저장되는 Supabase Storage 버킷 이름 */
export const CERTIFICATES_BUCKET = "certificates";

let _client: SupabaseClient | null = null;

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

    _client = createClient(supabaseUrl, supabaseServiceKey);
  }

  return _client;
}
