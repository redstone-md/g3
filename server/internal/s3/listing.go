package s3

import (
	"net/url"
	"strconv"
	"strings"

	"g3/internal/store"
)

// parseListRequest reads the query of either ListObjects (v1, resumed with
// "marker") or ListObjectsV2 (list-type=2, resumed with "continuation-token").
// rclone and restic default to v1, so ignoring "marker" makes them re-request
// the first page endlessly.
func parseListRequest(q url.Values) listRequest {
	req := listRequest{
		Prefix:    q.Get("prefix"),
		Delimiter: q.Get("delimiter"),
		MaxKeys:   1000,
		V2:        q.Get("list-type") == "2",
	}
	if v, err := strconv.Atoi(q.Get("max-keys")); err == nil && v > 0 && v < req.MaxKeys {
		req.MaxKeys = v
	}
	if req.V2 {
		req.After = q.Get("start-after")
		if tok := q.Get("continuation-token"); tok != "" {
			req.After = tok
		}
		return req
	}
	req.After = q.Get("marker")
	return req
}

// listRequest is one parsed ListObjects request, in either protocol version.
type listRequest struct {
	Prefix    string
	Delimiter string
	After     string // key to resume after (v1 marker or v2 token/start-after)
	MaxKeys   int
	V2        bool
}

// listPage is the assembled answer: the keys and the rolled-up "directories".
type listPage struct {
	Objects        []store.ObjectRow
	CommonPrefixes []string
	Truncated      bool
	NextMarker     string
}

// dbPageSize is how many rows we pull per database round trip while walking a
// listing. Keys collapsed into a common prefix are skipped without being
// returned, so a page of results can span many more rows than it contains.
const dbPageSize = 1000

// buildListing walks keys under Prefix in order, rolling every key that has
// Delimiter after the prefix into a common prefix (S3's directory illusion)
// and returning at most MaxKeys entries.
//
// Skipping matters as much as collecting: once a directory is rolled up, the
// walk resumes past every key inside it instead of reading them one by one,
// so listing the top of a bucket with 13k objects costs a couple of queries
// rather than 13k.
func buildListing(list objectLister, bucketID string, req listRequest) (listPage, error) {
	page := listPage{}
	seenPrefix := map[string]bool{}
	after := req.After

	for {
		rows, err := list(bucketID, req.Prefix, after, dbPageSize)
		if err != nil {
			return listPage{}, err
		}
		if len(rows) == 0 {
			return page, nil
		}

		for _, row := range rows {
			if len(page.Objects)+len(page.CommonPrefixes) >= req.MaxKeys {
				page.Truncated = true
				return page, nil
			}
			after = row.Key

			group, isGroup := commonPrefix(row.Key, req.Prefix, req.Delimiter)
			if !isGroup {
				page.Objects = append(page.Objects, row)
				page.NextMarker = row.Key
				continue
			}
			if !seenPrefix[group] {
				seenPrefix[group] = true
				page.CommonPrefixes = append(page.CommonPrefixes, group)
				page.NextMarker = group
			}
			// Resume past the whole directory rather than walking into it.
			after = keyAfterPrefix(group)
			break
		}

		// A short page means the table is exhausted.
		if len(rows) < dbPageSize && after >= rows[len(rows)-1].Key {
			return page, nil
		}
	}
}

// objectLister matches store.ListObjects, letting the walk be tested without
// a database.
type objectLister func(bucketID, prefix, after string, limit int) ([]store.ObjectRow, error)

// commonPrefix reports the directory a key rolls into, if the delimiter
// appears in the part of the key after the prefix.
func commonPrefix(key, prefix, delimiter string) (string, bool) {
	if delimiter == "" {
		return "", false
	}
	rest := strings.TrimPrefix(key, prefix)
	idx := strings.Index(rest, delimiter)
	if idx < 0 {
		return "", false
	}
	return prefix + rest[:idx+len(delimiter)], true
}

// keyAfterPrefix returns the smallest string greater than every key starting
// with p, so a resumed walk lands beyond the whole group.
func keyAfterPrefix(p string) string {
	b := []byte(p)
	for i := len(b) - 1; i >= 0; i-- {
		if b[i] < 0xFF {
			b[i]++
			return string(b[:i+1])
		}
	}
	return p + "\xff"
}
