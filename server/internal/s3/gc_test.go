package s3

import (
	"testing"

	"g3/internal/store"
)

// The collector deletes whatever is missing from this set, so a manifest it
// fails to read would look like a licence to delete live parts.
func TestReferencedIDs(t *testing.T) {
	keep := referencedIDs(store.BackingRefs{
		FileIDs:   []string{"single-1", "staged-1", ""},
		Manifests: []string{`[{"a":"acc","f":"part-1","s":5,"e":"x"},{"a":"acc","f":"part-2","s":5,"e":"y"}]`},
	})
	for _, id := range []string{"single-1", "staged-1", "part-1", "part-2"} {
		if _, ok := keep[id]; !ok {
			t.Errorf("%q missing from the referenced set", id)
		}
	}
	if len(keep) != 4 {
		t.Errorf("referenced set has %d ids, want 4 (empty ids must be dropped)", len(keep))
	}
}
