package store

// BackingRefs is every Drive file reference the database still holds. The
// garbage collector deletes only files absent from this set, so anything the
// metadata still points at — live objects included — is untouchable.
type BackingRefs struct {
	FileIDs   []string // single-file objects and staged multipart parts
	Manifests []string // parts manifests (raw JSON) of multipart objects
}

// AllBackingRefs collects those references across objects and staged uploads.
func (s *Store) AllBackingRefs() (BackingRefs, error) {
	var refs BackingRefs
	ids, err := s.scanStrings(`SELECT drive_file_id FROM objects WHERE drive_file_id IS NOT NULL`)
	if err != nil {
		return refs, err
	}
	refs.FileIDs = ids
	staged, err := s.scanStrings(`SELECT drive_file_id FROM multipart_parts`)
	if err != nil {
		return refs, err
	}
	refs.FileIDs = append(refs.FileIDs, staged...)
	refs.Manifests, err = s.scanStrings(`SELECT parts FROM objects WHERE parts IS NOT NULL`)
	return refs, err
}

// StaleMultipartIDs lists uploads initiated before `before` (RFC3339) — the
// ones a client started and never completed or aborted.
func (s *Store) StaleMultipartIDs(before string) ([]string, error) {
	return s.scanStrings(`SELECT upload_id FROM multipart_uploads WHERE created_at < ?`, before)
}

// ObjectCount is the total number of stored objects, used as a sanity check
// before the collector is allowed to delete anything.
func (s *Store) ObjectCount() (int, error) {
	var n int
	err := s.DB.QueryRow(`SELECT COUNT(*) FROM objects`).Scan(&n)
	return n, err
}

func (s *Store) scanStrings(query string, args ...any) ([]string, error) {
	rows, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// UsageByAccount sums the bytes each account holds for objects backed by a
// single Drive file, plus any parts staged by an upload in progress. Bytes of
// multipart objects sit in their manifests and are added by the caller.
func (s *Store) UsageByAccount() (map[string]int64, error) {
	usage := map[string]int64{}
	queries := []string{
		`SELECT account_id, SUM(size) FROM objects
		 WHERE account_id IS NOT NULL GROUP BY account_id`,
		`SELECT account_id, SUM(size) FROM multipart_parts GROUP BY account_id`,
	}
	for _, q := range queries {
		rows, err := s.DB.Query(q)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id string
			var sum int64
			if err := rows.Scan(&id, &sum); err != nil {
				rows.Close()
				return nil, err
			}
			usage[id] += sum
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
	}
	return usage, nil
}
