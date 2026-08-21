package drive

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

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

// FileInfo is one file in an account's G3 folder, as the collector sees it.
type FileInfo struct {
	ID        string
	Name      string
	Size      int64
	CreatedAt time.Time
}

// ListFolder walks every file in the account's G3 folder, handing each page to
// fn. Drive caps a page at 1000 files, so a large account costs several round
// trips; returning an error from fn stops the walk. Only the G3 folder is
// listed, so nothing else in the user's Drive is ever visited.
func (m *Manager) ListFolder(ctx context.Context, refreshToken, folderID string, fn func([]FileInfo) error) error {
	if folderID == "" {
		return fmt.Errorf("drive list: no G3 folder for this account")
	}
	svc, err := m.Service(ctx, refreshToken)
	if err != nil {
		return err
	}
	q := fmt.Sprintf("'%s' in parents and trashed = false", folderID)
	pageToken := ""
	for {
		var list *drive.FileList
		if err := retry(ctx, func() error {
			call := svc.Files.List().Q(q).PageSize(1000).
				Fields("nextPageToken, files(id,name,size,createdTime)").Context(ctx)
			if pageToken != "" {
				call = call.PageToken(pageToken)
			}
			l, e := call.Do()
			if e != nil {
				return e
			}
			list = l
			return nil
		}); err != nil {
			return fmt.Errorf("drive list: %w", err)
		}
		page := make([]FileInfo, 0, len(list.Files))
		for _, f := range list.Files {
			created, _ := time.Parse(time.RFC3339, f.CreatedTime)
			page = append(page, FileInfo{ID: f.Id, Name: f.Name, Size: f.Size, CreatedAt: created})
		}
		if err := fn(page); err != nil {
			return err
		}
		if list.NextPageToken == "" {
			return nil
		}
		pageToken = list.NextPageToken
	}
}

// Copy duplicates a file inside the same account. Drive copies server-side, so
// no bytes travel through G3 — this is what makes S3 CopyObject cheap.
func (m *Manager) Copy(ctx context.Context, refreshToken, fileID, name, folderID string) (string, error) {
	svc, err := m.Service(ctx, refreshToken)
	if err != nil {
		return "", err
	}
	meta := &drive.File{Name: name}
	if folderID != "" {
		meta.Parents = []string{folderID}
	}
	var created *drive.File
	if err := retry(ctx, func() error {
		f, e := svc.Files.Copy(fileID, meta).Fields("id").Context(ctx).Do()
		if e != nil {
			return e
		}
		created = f
		return nil
	}); err != nil {
		return "", fmt.Errorf("drive copy: %w", err)
	}
	return created.Id, nil
}
