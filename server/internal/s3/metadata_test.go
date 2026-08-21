package s3

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
)

// A file's modification time must survive the round trip unchanged: rclone
// stores it as x-amz-meta-mtime and re-reads it to decide whether an object
// still matches the local file. Losing it makes every object look changed.
func TestUserMetadataRoundTrip(t *testing.T) {
	req := http.Header{}
	req.Set("X-Amz-Meta-Mtime", "1755738000.123456789")
	req.Set("x-amz-meta-Custom-Key", "value")
	req.Set("Content-Type", "image/png") // not metadata, must not leak in

	stored := userMetadataJSON(req)

	rec := httptest.NewRecorder()
	writeUserMetadata(rec, sql.NullString{String: stored, Valid: true})

	if got := rec.Header().Get("x-amz-meta-mtime"); got != "1755738000.123456789" {
		t.Errorf("mtime = %q, want %q", got, "1755738000.123456789")
	}
	if got := rec.Header().Get("x-amz-meta-custom-key"); got != "value" {
		t.Errorf("custom-key = %q, want %q", got, "value")
	}
	if got := rec.Header().Get("x-amz-meta-content-type"); got != "" {
		t.Errorf("non-metadata header leaked: %q", got)
	}
}

func TestUserMetadataJSONEmptyWithoutHeaders(t *testing.T) {
	h := http.Header{}
	h.Set("Content-Type", "text/plain")
	if got := userMetadataJSON(h); got != "" {
		t.Errorf("got %q, want empty so the column stays NULL", got)
	}
}

// Stored metadata is attacker-influenced input; malformed JSON must not panic
// or abort the response, it just yields no headers.
func TestWriteUserMetadataIgnoresJunk(t *testing.T) {
	for _, stored := range []sql.NullString{
		{Valid: false},
		{String: "", Valid: true},
		{String: "not json", Valid: true},
	} {
		rec := httptest.NewRecorder()
		writeUserMetadata(rec, stored)
		if len(rec.Header()) != 0 {
			t.Errorf("stored %+v produced headers %v", stored, rec.Header())
		}
	}
}
