package s3

import "testing"

// Clients send the copy source in several shapes; all of them must resolve to
// the same bucket and key, since a misparse would copy the wrong object.
func TestParseCopySource(t *testing.T) {
	cases := []struct {
		in, bucket, key string
	}{
		{"/my-bucket/dir/file.txt", "my-bucket", "dir/file.txt"},
		{"my-bucket/dir/file.txt", "my-bucket", "dir/file.txt"},
		{"/my-bucket/dir%2Ffile%20name.txt", "my-bucket", "dir/file name.txt"},
		{"/my-bucket/file.txt?versionId=null", "my-bucket", "file.txt"},
	}
	for _, c := range cases {
		bucket, key, err := parseCopySource(c.in)
		if err != nil {
			t.Fatalf("parseCopySource(%q): %v", c.in, err)
		}
		if bucket != c.bucket || key != c.key {
			t.Errorf("parseCopySource(%q) = %q/%q, want %q/%q", c.in, bucket, key, c.bucket, c.key)
		}
	}
	for _, bad := range []string{"", "/", "/bucket-only"} {
		if _, _, err := parseCopySource(bad); err == nil {
			t.Errorf("parseCopySource(%q) accepted a malformed source", bad)
		}
	}
}
