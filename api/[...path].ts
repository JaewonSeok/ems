import app from "../server/src/app";

// Vercel의 내장 body parser를 비활성화하여 multipart/form-data 파일 업로드 시
// 4.5MB 사전 파싱 제한을 우회한다. 실제 파싱은 Express의 multer가 담당한다.
export const config = {
  api: {
    bodyParser: false
  }
};

export default app;
