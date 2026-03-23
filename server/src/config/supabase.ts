import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/** 수료증 파일이 저장되는 Supabase Storage 버킷 이름 */
export const CERTIFICATES_BUCKET = "certificates";
