package store

// GetSetting returns a setting value or the default if unset.
func (s *Store) GetSetting(key, def string) string {
	var v string
	if err := s.DB.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v); err != nil {
		return def
	}
	return v
}

// SetSetting upserts a setting value.
func (s *Store) SetSetting(key, value string) error {
	_, err := s.DB.Exec(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

// DeleteSetting removes a setting.
func (s *Store) DeleteSetting(key string) error {
	_, err := s.DB.Exec(`DELETE FROM settings WHERE key = ?`, key)
	return err
}

// BucketPolicy returns a bucket's stored JSON policy, if any.
func (s *Store) BucketPolicy(bucketID string) (string, bool) {
	v := s.GetSetting("policy:"+bucketID, "")
	return v, v != ""
}

// SetBucketPolicy stores a bucket's JSON policy.
func (s *Store) SetBucketPolicy(bucketID, policy string) error {
	return s.SetSetting("policy:"+bucketID, policy)
}

// DeleteBucketPolicy removes a bucket's policy.
func (s *Store) DeleteBucketPolicy(bucketID string) error {
	return s.DeleteSetting("policy:" + bucketID)
}
