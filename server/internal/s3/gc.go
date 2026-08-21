package s3

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"g3/internal/drive"
	"g3/internal/store"
)

const (
	// uploadTTL is how long a multipart upload may sit untouched before the
	// collector aborts it: clients that die mid-upload never send an abort,
	// leaving their staged parts on Drive forever.
	uploadTTL = 24 * time.Hour
	// graceAge protects work in flight. A part's Drive file exists before the
	// database row that references it, so a file younger than this is never
	// treated as garbage no matter what the metadata says.
	graceAge = 2 * time.Hour
	// sampleLimit caps how many orphan names a report carries back, enough to
	// eyeball a dry run without shipping a 100k-line list to the panel.
	sampleLimit = 20
)

// GCReport summarises one pass of the collector.
type GCReport struct {
	Applied      bool     `json:"applied"`
	StaleUploads int      `json:"staleUploads"`
	OrphanFiles  int      `json:"orphanFiles"`
	OrphanBytes  int64    `json:"orphanBytes"`
	Deleted      int      `json:"deleted"`
	Samples      []string `json:"samples"`
	Errors       []string `json:"errors,omitempty"`
}

// SweepStaleUploads aborts multipart uploads older than ttl, deleting their
// staged Drive parts. Safe to run unattended: it only ever touches parts of
// uploads that were never completed.
func (s *Server) SweepStaleUploads(ctx context.Context, ttl time.Duration) (int, error) {
	cutoff := time.Now().UTC().Add(-ttl).Format(time.RFC3339)
	ids, err := s.store.StaleMultipartIDs(cutoff)
	if err != nil {
		return 0, err
	}
	swept := 0
	for _, id := range ids {
		mu, err := s.store.MultipartByID(id)
		if err != nil {
			continue
		}
		if err := s.AbortMultipart(ctx, mu); err != nil {
			log.Printf("[gc] abort %s: %v", id, err)
			continue
		}
		swept++
	}
	return swept, nil
}

// CollectGarbage finds every file in the pool's G3 folders that no database
// row references any more and — only when apply is true — deletes it.
//
// Three guards stand between this and real data: a file is spared unless it
// lives in G3's own folder, is absent from every metadata reference, and is
// older than graceAge. A fourth aborts the whole pass if the reference set
// comes back implausibly empty, so a broken query can never wipe the pool.
func (s *Server) CollectGarbage(ctx context.Context, apply bool) (GCReport, error) {
	report := GCReport{Applied: apply, Samples: []string{}}

	if apply {
		swept, err := s.SweepStaleUploads(ctx, uploadTTL)
		if err != nil {
			return report, err
		}
		report.StaleUploads = swept
	} else {
		cutoff := time.Now().UTC().Add(-uploadTTL).Format(time.RFC3339)
		stale, err := s.store.StaleMultipartIDs(cutoff)
		if err != nil {
			return report, err
		}
		report.StaleUploads = len(stale)
	}

	keep, err := s.referenced()
	if err != nil {
		return report, err
	}

	accounts, err := s.store.ListDriveAccounts()
	if err != nil {
		return report, err
	}
	for _, acc := range accounts {
		if acc.Status != "connected" || !acc.FolderID.Valid {
			continue
		}
		if err := s.sweepAccount(ctx, acc, keep, apply, &report); err != nil {
			report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", acc.Email, err))
		}
	}
	return report, nil
}

// referenced builds the set of Drive file ids the metadata still points at.
func (s *Server) referenced() (map[string]struct{}, error) {
	refs, err := s.store.AllBackingRefs()
	if err != nil {
		return nil, err
	}
	keep := referencedIDs(refs)
	count, err := s.store.ObjectCount()
	if err != nil {
		return nil, err
	}
	if count > 0 && len(keep) == 0 {
		return nil, errors.New("refusing to collect: metadata lists objects but no backing files")
	}
	return keep, nil
}

// referencedIDs flattens single-file ids and parts manifests into one set.
func referencedIDs(refs store.BackingRefs) map[string]struct{} {
	keep := make(map[string]struct{}, len(refs.FileIDs))
	for _, id := range refs.FileIDs {
		if id != "" {
			keep[id] = struct{}{}
		}
	}
	for _, blob := range refs.Manifests {
		for _, p := range parseManifestJSON(blob) {
			if p.DriveFileID != "" {
				keep[p.DriveFileID] = struct{}{}
			}
		}
	}
	return keep
}

// sweepAccount walks one account's G3 folder and collects what is unreachable.
func (s *Server) sweepAccount(ctx context.Context, acc store.DriveAccount, keep map[string]struct{}, apply bool, report *GCReport) error {
	// The listing omits refresh tokens; re-read the account to get one.
	full, err := s.store.DriveAccountByID(acc.ID)
	if err != nil {
		return err
	}
	refresh, err := s.refreshFor(full)
	if err != nil {
		return err
	}
	err = s.drive.ListFolder(ctx, refresh, acc.FolderID.String, func(page []drive.FileInfo) error {
		for _, f := range page {
			if _, ok := keep[f.ID]; ok {
				continue
			}
			// An unparsed or very recent timestamp means "possibly in flight".
			if f.CreatedAt.IsZero() || time.Since(f.CreatedAt) < graceAge {
				continue
			}
			report.OrphanFiles++
			report.OrphanBytes += f.Size
			if len(report.Samples) < sampleLimit {
				report.Samples = append(report.Samples, f.Name)
			}
			if !apply {
				continue
			}
			if err := s.drive.Delete(ctx, refresh, f.ID); err != nil {
				report.Errors = append(report.Errors, fmt.Sprintf("%s: %v", f.Name, err))
				continue
			}
			report.Deleted++
		}
		return nil
	})
	if err != nil || !apply || report.Deleted == 0 {
		return err
	}
	// Re-read the quota so the panel reflects the space just reclaimed.
	if info, ierr := s.drive.RefreshInfo(ctx, refresh); ierr == nil {
		_ = s.store.UpdateDriveQuota(acc.ID, info.Limit, info.Usage, acc.Status)
	}
	return nil
}
