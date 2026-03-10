import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

// 서버리스 환경(Vercel)에서 Cold Start 시 인스턴스를 재사용하기 위해
// production 포함 항상 global에 캐싱한다.
// (조건부로 개발 환경에서만 캐싱하면 production에서 매 요청마다 new PrismaClient()가 호출됨)
export const prisma = global.__prisma__ ?? new PrismaClient();
global.__prisma__ = prisma;
