package s3

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

// metaPrefix is the S3 header prefix carrying user-defined object metadata.
const metaPrefix = "x-amz-meta-"

// userMetadataJSON collects the request's x-amz-meta-* headers into a JSON
// object ready for storage. Keys are lowercased without the prefix, matching
// how S3 normalizes them. Returns "" when the request carries no metadata, so
// objects written without any stay NULL in the database.
func userMetadataJSON(h http.Header) string {
	meta := map[string]string{}
	for name, values := range h {
		if len(values) == 0 {
			continue
		}
		lower := strings.ToLower(name)
		if suffix, ok := strings.CutPrefix(lower, metaPrefix); ok && suffix != "" {
			meta[suffix] = values[0]
		}
	}
	if len(meta) == 0 {
		return ""
	}
	blob, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return string(blob)
}

// writeUserMetadata replays stored metadata onto a response as x-amz-meta-*
// headers. This is what lets clients recover a file's original modification
// time (rclone stores it as x-amz-meta-mtime) instead of seeing the upload
// time, which would make every object look changed on the next sync.
func writeUserMetadata(w http.ResponseWriter, stored sql.NullString) {
	if !stored.Valid || stored.String == "" {
		return
	}
	var meta map[string]string
	if err := json.Unmarshal([]byte(stored.String), &meta); err != nil {
		return
	}
	for k, v := range meta {
		w.Header().Set(metaPrefix+k, v)
	}
}
