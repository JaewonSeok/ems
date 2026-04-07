/**
 * fix-hours.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * hours = 0 인 레코드를 찾아 (end_date - start_date + 1일) 값으로 일괄 수정.
 *
 * 실행:
 *   npx tsx prisma/scripts/fix-hours.ts          # dry-run (기본)
 *   npx tsx prisma/scripts/fix-hours.ts --apply  # 실제 반영
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// ── 날짜 유틸 ────────────────────────────────────────────────────────────────

function calcDays(start: Date, end: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── 행 타입 ──────────────────────────────────────────────────────────────────

type FixRow = {
  table: "external_trainings" | "internal_trainings" | "internal_lectures";
  id: string;
  recordName: string;
  userName: string;
  startDate: Date;
  endDate: Date;
  currentHours: number;
  calcHours: number;
};

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  const rows: FixRow[] = [];

  // 1. external_trainings
  const extRows = await prisma.external_trainings.findMany({
    where: { hours: new Prisma.Decimal(0) },
    include: { user: { select: { name: true } } },
    orderBy: { start_date: "asc" },
  });
  for (const r of extRows) {
    rows.push({
      table: "external_trainings",
      id: r.id,
      recordName: r.training_name,
      userName: r.user.name,
      startDate: r.start_date,
      endDate: r.end_date,
      currentHours: Number(r.hours),
      calcHours: calcDays(r.start_date, r.end_date),
    });
  }

  // 2. internal_trainings
  const intTrainRows = await prisma.internal_trainings.findMany({
    where: { hours: new Prisma.Decimal(0) },
    include: { user: { select: { name: true } } },
    orderBy: { start_date: "asc" },
  });
  for (const r of intTrainRows) {
    rows.push({
      table: "internal_trainings",
      id: r.id,
      recordName: r.training_name,
      userName: r.user.name,
      startDate: r.start_date,
      endDate: r.end_date,
      currentHours: Number(r.hours),
      calcHours: calcDays(r.start_date, r.end_date),
    });
  }

  // 3. internal_lectures
  const intLectRows = await prisma.internal_lectures.findMany({
    where: { hours: new Prisma.Decimal(0) },
    include: { user: { select: { name: true } } },
    orderBy: { start_date: "asc" },
  });
  for (const r of intLectRows) {
    rows.push({
      table: "internal_lectures",
      id: r.id,
      recordName: r.lecture_name,
      userName: r.user.name,
      startDate: r.start_date,
      endDate: r.end_date,
      currentHours: Number(r.hours),
      calcHours: calcDays(r.start_date, r.end_date),
    });
  }

  // ── 결과 없음 ──────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    console.log("hours = 0 인 레코드가 없습니다. 종료합니다.");
    return;
  }

  // ── 미리보기 테이블 출력 ────────────────────────────────────────────────────
  const COL = {
    table:   18,
    id:      36,
    record:  30,
    user:    10,
    start:   10,
    end:     10,
    cur:      7,
    calc:     7,
  };

  function pad(s: string, n: number) {
    return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
  }

  const header = [
    pad("테이블",        COL.table),
    pad("ID",            COL.id),
    pad("교육명",        COL.record),
    pad("직원명",        COL.user),
    pad("시작일",        COL.start),
    pad("종료일",        COL.end),
    pad("현재hours",     COL.cur),
    pad("계산hours",     COL.calc),
  ].join(" | ");

  console.log("\n" + (APPLY ? "[apply 모드]" : "[dry-run 모드]"));
  console.log(header);
  console.log("─".repeat(header.length));

  for (const r of rows) {
    console.log([
      pad(r.table,              COL.table),
      pad(r.id,                 COL.id),
      pad(r.recordName,         COL.record),
      pad(r.userName,           COL.user),
      pad(fmtDate(r.startDate), COL.start),
      pad(fmtDate(r.endDate),   COL.end),
      pad(String(r.currentHours), COL.cur),
      pad(String(r.calcHours),    COL.calc),
    ].join(" | "));
  }

  console.log(`\n총 업데이트 대상: ${rows.length}건`);

  // ── dry-run 종료 ────────────────────────────────────────────────────────────
  if (!APPLY) {
    console.log("\n실제 반영하려면 --apply 를 붙여 실행하세요.");
    console.log("  npx tsx prisma/scripts/fix-hours.ts --apply");
    return;
  }

  // ── 실제 업데이트 ──────────────────────────────────────────────────────────
  console.log("\n업데이트를 시작합니다...");
  let updated = 0;

  for (const r of rows) {
    const newHours = new Prisma.Decimal(r.calcHours);

    if (r.table === "external_trainings") {
      await prisma.external_trainings.update({
        where: { id: r.id },
        data: { hours: newHours },
      });
    } else if (r.table === "internal_trainings") {
      await prisma.internal_trainings.update({
        where: { id: r.id },
        data: { hours: newHours },
      });
    } else {
      await prisma.internal_lectures.update({
        where: { id: r.id },
        data: { hours: newHours },
      });
    }

    updated++;
    console.log(`  ✓ [${r.table}] ${r.userName} / "${r.recordName}" → ${r.calcHours}일`);
  }

  console.log(`\n완료: ${updated}건 업데이트됨`);
}

main()
  .catch((e: unknown) => {
    console.error("스크립트 실행 오류:", e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
