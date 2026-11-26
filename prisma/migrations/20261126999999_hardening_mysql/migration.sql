-- Protection rules (MySQL 8.0.16+ / MariaDB 10.4+).
-- Append-only audit trails: UPDATE and DELETE are refused by the database itself.
CREATE TRIGGER identity_access_logs_no_update BEFORE UPDATE ON identity_access_logs FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only table: identity_access_logs';
CREATE TRIGGER identity_access_logs_no_delete BEFORE DELETE ON identity_access_logs FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only table: identity_access_logs';
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only table: audit_logs';
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only table: audit_logs';

-- Legacy identity mappings can never be edited or removed.
CREATE TRIGGER identity_mapping_no_update BEFORE UPDATE ON feedback_identity_mappings FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only table: feedback_identity_mappings';
CREATE TRIGGER identity_mapping_no_delete BEFORE DELETE ON feedback_identity_mappings FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'append-only table: feedback_identity_mappings';

-- An anonymous case can never get an identity mapping.
CREATE TRIGGER identity_mapping_not_anonymous BEFORE INSERT ON feedback_identity_mappings FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM feedback_submissions WHERE id = NEW.feedbackId AND anonymous = 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'anonymous feedback cannot have an identity mapping';
  END IF;
END;

-- Integrity checks
ALTER TABLE feedback_identity_mappings ADD CONSTRAINT identity_enc_format CHECK (userIdEnc REGEXP '^[^.]+[.][^.]+[.][^.]+$');
ALTER TABLE identity_access_logs ADD CONSTRAINT identity_outcome CHECK (outcome IN ('GRANTED', 'DENIED'));
ALTER TABLE feedback_submissions ADD CONSTRAINT reference_format CHECK (reference REGEXP '^FB-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$');
ALTER TABLE feedback_submissions ADD CONSTRAINT feedback_owner_shape CHECK (
  (anonymous = 1 AND ownerHmac IS NULL AND trackingKeyHash IS NOT NULL)
  OR (anonymous = 0 AND ownerHmac IS NOT NULL AND trackingKeyHash IS NULL)
);