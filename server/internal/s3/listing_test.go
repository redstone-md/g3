package s3

import (
	"net/url"
	"sort"
	"strings"
	"testing"

	"g3/internal/store"
)

// fakeLister mimics store.ListObjects: keys under prefix, strictly after
// `after`, in key order, capped at limit. The ordering matters — the walk
// relies on it to know a group is behind it.
func fakeLister(keys []string) (objectLister, *int) {
	calls := 0
	sorted := append([]string{}, keys...)
	sort.Strings(sorted)
	return func(_, prefix, after string, limit int) ([]store.ObjectRow, error) {
		calls++
		keys := sorted
		out := []store.ObjectRow{}
		for _, k := range keys {
			if !strings.HasPrefix(k, prefix) || k <= after {
				continue
			}
			out = append(out, store.ObjectRow{Key: k})
			if len(out) == limit {
				break
			}
		}
		return out, nil
	}, &calls
}

// A v1 client resumes with "marker". Reading it from the wrong query field
// returns page one forever — the loop that pinned the server at 11 req/s.
func TestParseListRequestVersions(t *testing.T) {
	v1 := parseListRequest(url.Values{"marker": {"a/b.png"}, "continuation-token": {"ignored"}})
	if v1.V2 || v1.After != "a/b.png" {
		t.Errorf("v1: got V2=%v after=%q, want false, %q", v1.V2, v1.After, "a/b.png")
	}

	v2 := parseListRequest(url.Values{"list-type": {"2"}, "continuation-token": {"tok"}, "marker": {"ignored"}})
	if !v2.V2 || v2.After != "tok" {
		t.Errorf("v2: got V2=%v after=%q, want true, %q", v2.V2, v2.After, "tok")
	}
}

// Walking a full bucket must terminate and must visit every key exactly once.
func TestBuildListingPaginates(t *testing.T) {
	keys := []string{}
	for _, c := range "abcdefghij" {
		keys = append(keys, "file"+string(c))
	}
	lister, _ := fakeLister(keys)

	seen := []string{}
	after := ""
	for pages := 0; ; pages++ {
		if pages > 20 {
			t.Fatal("pagination did not terminate")
		}
		page, err := buildListing(lister, "b", listRequest{MaxKeys: 3, After: after})
		if err != nil {
			t.Fatal(err)
		}
		for _, o := range page.Objects {
			seen = append(seen, o.Key)
		}
		if !page.Truncated {
			break
		}
		after = page.NextMarker
	}
	if strings.Join(seen, ",") != strings.Join(keys, ",") {
		t.Errorf("walked %v, want %v", seen, keys)
	}
}

// With a delimiter the listing must roll directories up instead of returning
// their contents, and must not read through every key inside them.
func TestBuildListingRollsUpDirectories(t *testing.T) {
	keys := []string{"top.txt"}
	for _, d := range []string{"docs", "img"} {
		for _, n := range []string{"1", "2", "3", "4", "5"} {
			keys = append(keys, d+"/"+n+".bin")
		}
	}
	lister, calls := fakeLister(keys)

	page, err := buildListing(lister, "b", listRequest{Delimiter: "/", MaxKeys: 1000})
	if err != nil {
		t.Fatal(err)
	}
	if got := len(page.Objects); got != 1 || page.Objects[0].Key != "top.txt" {
		t.Errorf("objects = %v, want just top.txt", page.Objects)
	}
	if strings.Join(page.CommonPrefixes, ",") != "docs/,img/" {
		t.Errorf("common prefixes = %v, want [docs/ img/]", page.CommonPrefixes)
	}
	if page.Truncated {
		t.Error("should not be truncated")
	}
	if *calls > 4 {
		t.Errorf("took %d queries; directories should be skipped, not walked", *calls)
	}
}

func TestKeyAfterPrefixSkipsGroup(t *testing.T) {
	got := keyAfterPrefix("docs/")
	if got <= "docs/" || got > "docs0" {
		t.Errorf("keyAfterPrefix(docs/) = %q, want just past every docs/ key", got)
	}
	if "docs/zzz.bin" >= got {
		t.Errorf("%q does not sort past docs/zzz.bin", got)
	}
}

// Resuming a truncated delimiter listing must not hand the same directory back
// twice: the panel keys its rows by folder name, and a repeat is a lost page.
func TestBuildListingResumesPastDirectories(t *testing.T) {
	lister, _ := fakeLister([]string{
		"docs/a.txt", "docs/b.txt", "docs/c.txt",
		"img/1.png", "img/2.png",
		"notes/x.md",
		"root.txt",
	})

	seen := []string{}
	after := ""
	for page := 0; page < 10; page++ {
		p, err := buildListing(lister, "b", listRequest{Delimiter: "/", After: after, MaxKeys: 2})
		if err != nil {
			t.Fatal(err)
		}
		seen = append(seen, p.CommonPrefixes...)
		for _, o := range p.Objects {
			seen = append(seen, o.Key)
		}
		if !p.Truncated {
			break
		}
		after = p.NextMarker
	}

	counts := map[string]int{}
	for _, s := range seen {
		counts[s]++
	}
	for entry, n := range counts {
		if n > 1 {
			t.Errorf("%q returned %d times across pages: %v", entry, n, seen)
		}
	}
	if len(counts) != 4 { // docs/, img/, notes/, root.txt
		t.Errorf("saw %d distinct entries (%v), want 4", len(counts), seen)
	}
}
