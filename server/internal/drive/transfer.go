package drive

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
)

// Upload streams a reader into the account's G3 folder and returns the new
// Drive file id. The API client uses a resumable upload for large media.
func (m *Manager) Upload(ctx context.Context, refreshToken, folderID, name, contentType string, body io.Reader) (string, error) {
	svc, err := m.Service(ctx, refreshToken)
	if err != nil {
		return "", err
	}
	meta := &drive.File{Name: name}
	if folderID != "" {
		meta.Parents = []string{folderID}
	}
	created, err := svc.Files.Create(meta).
		Media(body, googleapi.ContentType(contentType)).
		Fields("id").
		Context(ctx).
		Do()
	if err != nil {
		return "", fmt.Errorf("drive upload: %w", err)
	}
	return created.Id, nil
}

// Download opens a Drive file for reading. If rangeHeader is non-empty it is
// passed through (Drive returns 206 + the requested byte range).
func (m *Manager) Download(ctx context.Context, refreshToken, fileID, rangeHeader string) (*http.Response, error) {
	svc, err := m.Service(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	var resp *http.Response
	err = retry(ctx, func() error {
		call := svc.Files.Get(fileID).Context(ctx)
		if rangeHeader != "" {
			call.Header().Set("Range", rangeHeader)
		}
		r, e := call.Download()
		if e != nil {
			return e
		}
		resp = r
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("drive download: %w", err)
	}
	return resp, nil
}

// Delete removes a Drive file (best-effort; missing files are ignored).
func (m *Manager) Delete(ctx context.Context, refreshToken, fileID string) error {
	svc, err := m.Service(ctx, refreshToken)
	if err != nil {
		return err
	}
	err = retry(ctx, func() error {
		derr := svc.Files.Delete(fileID).Context(ctx).Do()
		if gerr, ok := derr.(*googleapi.Error); ok && gerr.Code == http.StatusNotFound {
			return nil
		}
		return derr
	})
	if err != nil {
		return fmt.Errorf("drive delete: %w", err)
	}
	return nil
}
