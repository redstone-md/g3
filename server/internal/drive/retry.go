package drive

import (
	"context"
	"errors"
	"time"

	"google.golang.org/api/googleapi"
)

const maxAttempts = 4

// retryable reports whether a Drive error is worth retrying (rate limit / 5xx).
func retryable(err error) bool {
	var gerr *googleapi.Error
	if errors.As(err, &gerr) {
		return gerr.Code == 429 || gerr.Code >= 500
	}
	return false
}

// retry runs fn with exponential backoff on transient Drive errors.
func retry(ctx context.Context, fn func() error) error {
	delay := 250 * time.Millisecond
	var err error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		if err = fn(); err == nil || !retryable(err) {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		delay *= 2
	}
	return err
}
