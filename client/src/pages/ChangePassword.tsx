import { Navigate } from "react-router-dom";

// 비밀번호 변경 기능은 Google Workspace SSO 전환으로 제거되었습니다.
export default function ChangePassword() {
  return <Navigate to="/" replace />;
}
