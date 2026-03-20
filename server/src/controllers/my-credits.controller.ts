import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

export async function getMyCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? Number(yearParam) : undefined;

    const buildDateRange = (startField: string) => {
      if (!year) return {};
      return {
        [startField]: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      };
    };

    const [externalTrainings, internalTrainings, internalLectures, certifications, user] = await Promise.all([
      prisma.external_trainings.findMany({
        where: { user_id: userId, ...buildDateRange("start_date") },
        select: { id: true, training_name: true, start_date: true, end_date: true, credits: true, type: true },
        orderBy: { start_date: "desc" }
      }),
      prisma.internal_trainings.findMany({
        where: { user_id: userId, ...buildDateRange("start_date") },
        select: { id: true, training_name: true, start_date: true, end_date: true, credits: true, type: true },
        orderBy: { start_date: "desc" }
      }),
      prisma.internal_lectures.findMany({
        where: { user_id: userId, ...buildDateRange("start_date") },
        select: { id: true, lecture_name: true, start_date: true, end_date: true, credits: true, type: true },
        orderBy: { start_date: "desc" }
      }),
      prisma.certifications.findMany({
        where: { user_id: userId, ...(year ? { acquired_date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}) },
        select: { id: true, cert_name: true, acquired_date: true, credits: true, grade: true },
        orderBy: { acquired_date: "desc" }
      }),
      prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, name: true, employee_id: true, department: true, team: true }
      })
    ]);

    const sum = (arr: { credits: unknown }[]) =>
      arr.reduce((acc, r) => acc + Number(r.credits ?? 0), 0);

    const externalTotal = sum(externalTrainings);
    const internalTotal = sum(internalTrainings);
    const lectureTotal = sum(internalLectures);
    const certTotal = sum(certifications);
    const grandTotal = externalTotal + internalTotal + lectureTotal + certTotal;

    return res.status(200).json({
      user,
      year: year ?? null,
      summary: {
        externalTrainings: externalTotal,
        internalTrainings: internalTotal,
        internalLectures: lectureTotal,
        certifications: certTotal,
        total: grandTotal
      },
      items: {
        externalTrainings,
        internalTrainings,
        internalLectures,
        certifications
      }
    });
  } catch (error) {
    console.error("getMyCredits error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
