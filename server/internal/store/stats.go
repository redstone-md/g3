package store

// Stats is an at-a-glance summary of the G3 deployment for the dashboard.
type Stats struct {
	Buckets           int   `json:"buckets"`
	Objects           int   `json:"objects"`
	TotalSize         int64 `json:"totalSize"`
	Accounts          int   `json:"accounts"`
	ConnectedAccounts int   `json:"connectedAccounts"`
	PoolUsage         int64 `json:"poolUsage"`
	PoolLimit         int64 `json:"poolLimit"`
}

// Stats computes the dashboard summary in one pass per table.
func (s *Store) Stats() (*Stats, error) {
	var st Stats
	if err := s.DB.QueryRow(`SELECT COUNT(*) FROM buckets`).Scan(&st.Buckets); err != nil {
		return nil, err
	}
	if err := s.DB.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(size), 0) FROM objects`).
		Scan(&st.Objects, &st.TotalSize); err != nil {
		return nil, err
	}
	if err := s.DB.QueryRow(
		`SELECT COUNT(*),
		        COALESCE(SUM(CASE WHEN status='connected' THEN 1 ELSE 0 END), 0),
		        COALESCE(SUM(storage_usage), 0),
		        COALESCE(SUM(storage_limit), 0)
		 FROM drive_accounts`).
		Scan(&st.Accounts, &st.ConnectedAccounts, &st.PoolUsage, &st.PoolLimit); err != nil {
		return nil, err
	}
	return &st, nil
}
