-- Concepts a candidate must know to answer each practice question well.
ALTER TABLE "practice_questions" ADD COLUMN "key_points" TEXT[] DEFAULT ARRAY[]::TEXT[];
