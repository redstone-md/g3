package s3

// UsageByAccount reports how many bytes G3 itself stores on each Drive
// account. An account's Drive quota is not that number: it also counts its
// owner's unrelated files, which is why the panel shows both.
func (s *Server) UsageByAccount() (map[string]int64, error) {
	usage, err := s.store.UsageByAccount()
	if err != nil {
		return nil, err
	}
	// Multipart objects spread their parts across accounts, so their bytes
	// live in the manifest rather than in a column the database can sum.
	refs, err := s.store.AllBackingRefs()
	if err != nil {
		return nil, err
	}
	for _, blob := range refs.Manifests {
		for _, p := range parseManifestJSON(blob) {
			usage[p.AccountID] += p.Size
		}
	}
	return usage, nil
}
