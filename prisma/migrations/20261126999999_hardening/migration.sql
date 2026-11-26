-- Append-only audit trails: block UPDATE/DELETE/TRUNCATE.
CREATE OR REPLACE FUNCTION feed_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER identity_access_logs_append_only BEFORE UPDATE OR DELETE ON identity_access_logs
  FOR EACH ROW EXECUTE FUNCTION feed_forbid_mutation();
CREATE TRIGGER identity_access_logs_no_truncate BEFORE TRUNCATE ON identity_access_logs
  FOR EACH STATEMENT EXECUTE FUNCTION feed_forbid_mutation();
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION feed_forbid_mutation();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION feed_forbid_mutation();

-- Identity mapping can never be edited or removed once written.
CREATE TRIGGER identity_mapping_immutable BEFORE UPDATE OR DELETE ON feedback_identity_mappings
  FOR EACH ROW EXECUTE FUNCTION feed_forbid_mutation();

-- Workflow integrity
ALTER TABLE feedback_identity_mappings ADD CONSTRAINT identity_enc_format CHECK (array_length(string_to_array("userIdEnc", '.'), 1) = 3);
ALTER TABLE identity_access_logs ADD CONSTRAINT identity_outcome CHECK (outcome IN ('GRANTED','DENIED'));
ALTER TABLE feedback_submissions ADD CONSTRAINT reference_format CHECK (reference ~ '^FB-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$');
