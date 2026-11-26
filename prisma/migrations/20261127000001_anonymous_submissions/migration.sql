-- AlterTable
ALTER TABLE "feedback_submissions" ADD COLUMN     "anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackingKeyHash" TEXT,
ALTER COLUMN "ownerHmac" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "feedback_submissions_anonymous_idx" ON "feedback_submissions"("anonymous");

-- Anonymous and confidential cases are mutually exclusive shapes.
ALTER TABLE "feedback_submissions" ADD CONSTRAINT feedback_owner_shape CHECK (
  ("anonymous" AND "ownerHmac" IS NULL AND "trackingKeyHash" IS NOT NULL)
  OR (NOT "anonymous" AND "ownerHmac" IS NOT NULL AND "trackingKeyHash" IS NULL)
);

-- An anonymous case can never get an identity mapping.
CREATE OR REPLACE FUNCTION feed_forbid_anonymous_identity() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM feedback_submissions WHERE id = NEW."feedbackId" AND anonymous) THEN
    RAISE EXCEPTION 'anonymous feedback cannot have an identity mapping';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER identity_mapping_not_anonymous BEFORE INSERT ON feedback_identity_mappings
  FOR EACH ROW EXECUTE FUNCTION feed_forbid_anonymous_identity();