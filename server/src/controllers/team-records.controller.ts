import { position_title_enum } from "@prisma/client";
import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * 직책에 따라 관할 직원의 조건을 결정합니다.
 * - 팀장: 동일 팀 & 동일 부서
 * - 실장: 동일 부서
 * - 부문장: 동일 부서
 * - 본부장: 모든 직원
 */
function buildSubordinateWhere(user: { department: string; team: string; position_title: position_title_enum | null }) {
  const { position_title, department, team } = user;

  switch (position_title) {
    case position_title_enum.팀장:
      return { department, team };
    case position_title_enum.실장:
    case position_title_enum.부문장:
      return { department };
    case position_title_enum.본부장:
      return {};
    default:
      return null;
  }
}

export async function listTeamMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const me = await prisma.users.findUnique({ where: { id: userId } });
    if (!me) return res.status(404).json({ message: "User not found" });

    const subordinateWhere = buildSubordinateWhere(me);
    if (!subordinateWhere) {
      return res.status(403).json({ message: "직책이 없어 소속 직원 조회 권한이 없습니다." });
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const search = String(req.query.search || "").trim();

    const where = {
      ...subordinateWhere,
      is_active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { employee_id: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [total, members] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          employee_id: true,
          department: true,
          team: true,
          position_title: true
        }
      })
    ]);

    return res.status(200).json({
      items: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      },
      scope: {
        position_title: me.position_title,
        department: me.department,
        team: me.team
      }
    });
  } catch (error) {
    console.error("listTeamMembers error:", error);
    return res.status(500).json({ message: "Failed to list team members" });
  }
}

export async function getTeamMemberRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    const { memberId } = req.params;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

    const me = await prisma.users.findUnique({ where: { id: actorId } });
    if (!me) return res.status(404).json({ message: "User not found" });

    const subordinateWhere = buildSubordinateWhere(me);
    if (!subordinateWhere) {
      return res.status(403).json({ message: "직책이 없어 소속 직원 조회 권한이 없습니다." });
    }

    // 대상 직원이 관할 범위에 속하는지 확인
    const targetMember = await prisma.users.findFirst({
      where: { id: memberId, ...subordinateWhere, is_active: true }
    });
    if (!targetMember) {
      return res.status(403).json({ message: "해당 직원을 조회할 권한이 없습니다." });
    }

    const dateFilter = (field: string) =>
      startDate || endDate
        ? {
            ...(startDate ? { [field]: { gte: startDate } } : {}),
            ...(endDate ? { [field]: { lte: endDate } } : {})
          }
        : {};

    const [externalTrainings, internalTrainings, internalLectures, certifications] = await Promise.all([
      prisma.external_trainings.findMany({
        where: { user_id: memberId, ...dateFilter("start_date") },
        orderBy: { start_date: "desc" }
      }),
      prisma.internal_trainings.findMany({
        where: { user_id: memberId, ...dateFilter("start_date") },
        orderBy: { start_date: "desc" }
      }),
      prisma.internal_lectures.findMany({
        where: { user_id: memberId, ...dateFilter("start_date") },
        orderBy: { start_date: "desc" }
      }),
      prisma.certifications.findMany({
        where: { user_id: memberId, ...dateFilter("acquired_date") },
        orderBy: { acquired_date: "desc" }
      })
    ]);

    return res.status(200).json({
      member: {
        id: targetMember.id,
        name: targetMember.name,
        employee_id: targetMember.employee_id,
        department: targetMember.department,
        team: targetMember.team
      },
      records: {
        externalTrainings,
        internalTrainings,
        internalLectures,
        certifications
      }
    });
  } catch (error) {
    console.error("getTeamMemberRecords error:", error);
    return res.status(500).json({ message: "Failed to get team member records" });
  }
}

export async function getTeamSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const me = await prisma.users.findUnique({ where: { id: userId } });
    if (!me) return res.status(404).json({ message: "User not found" });

    const subordinateWhere = buildSubordinateWhere(me);
    if (!subordinateWhere) {
      return res.status(403).json({ message: "직책이 없어 소속 직원 조회 권한이 없습니다." });
    }

    const year = Number(req.query.year || new Date().getFullYear());
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);

    const members = await prisma.users.findMany({
      where: { ...subordinateWhere, is_active: true },
      select: { id: true, name: true, employee_id: true, department: true, team: true }
    });

    const memberIds = members.map((m) => m.id);

    const [extCount, intTrainCount, intLecCount, certCount] = await Promise.all([
      prisma.external_trainings.groupBy({
        by: ["user_id"],
        where: { user_id: { in: memberIds }, start_date: { gte: startOfYear, lte: endOfYear } },
        _count: { id: true }
      }),
      prisma.internal_trainings.groupBy({
        by: ["user_id"],
        where: { user_id: { in: memberIds }, start_date: { gte: startOfYear, lte: endOfYear } },
        _count: { id: true }
      }),
      prisma.internal_lectures.groupBy({
        by: ["user_id"],
        where: { user_id: { in: memberIds }, start_date: { gte: startOfYear, lte: endOfYear } },
        _count: { id: true }
      }),
      prisma.certifications.groupBy({
        by: ["user_id"],
        where: { user_id: { in: memberIds }, acquired_date: { gte: startOfYear, lte: endOfYear } },
        _count: { id: true }
      })
    ]);

    const countByUser = new Map<string, number>();
    for (const row of [...extCount, ...intTrainCount, ...intLecCount, ...certCount]) {
      const current = countByUser.get(row.user_id) ?? 0;
      countByUser.set(row.user_id, current + row._count.id);
    }

    const totalMembers = members.length;
    const membersWithTraining = memberIds.filter((id) => (countByUser.get(id) ?? 0) > 0).length;
    const completionRate = totalMembers > 0 ? Math.round((membersWithTraining / totalMembers) * 100) : 0;

    const memberStats = members.map((m) => ({
      ...m,
      training_count: countByUser.get(m.id) ?? 0,
      has_training: (countByUser.get(m.id) ?? 0) > 0
    }));

    return res.status(200).json({
      year,
      scope: { position_title: me.position_title, department: me.department, team: me.team },
      summary: { totalMembers, membersWithTraining, completionRate },
      members: memberStats
    });
  } catch (error) {
    console.error("getTeamSummary error:", error);
    return res.status(500).json({ message: "Failed to get team summary" });
  }
}
