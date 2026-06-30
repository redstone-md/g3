// Package drive wraps Google Drive OAuth and the Drive v3 client used as G3's
// storage backend. Each linked Google account contributes its Drive quota to a
// pool; G3 stores object bytes there and nothing on the local filesystem.
package drive

import (
	"context"
	"fmt"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// folderName is the dedicated folder G3 creates in each account's Drive.
const folderName = "G3 Storage"

// Manager holds the shared OAuth config for linking and using Drive accounts.
type Manager struct {
	oauth *oauth2.Config
}

// New builds a Manager. Drive linking is disabled until credentials are set.
func New(clientID, clientSecret, redirectURI string) *Manager {
	return &Manager{
		oauth: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURI,
			Scopes:       []string{drive.DriveFileScope},
			Endpoint:     google.Endpoint,
		},
	}
}

// Configured reports whether Google OAuth credentials are present.
func (m *Manager) Configured() bool {
	return m.oauth.ClientID != "" && m.oauth.ClientSecret != ""
}

// AuthURL builds the consent URL. Offline + forced consent guarantees a refresh
// token even on re-link.
func (m *Manager) AuthURL(state string) string {
	return m.oauth.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

// Exchange swaps an authorization code for a token (incl. refresh token).
func (m *Manager) Exchange(ctx context.Context, code string) (*oauth2.Token, error) {
	return m.oauth.Exchange(ctx, code)
}

// AccountInfo is the linked account's identity, quota, and G3 folder.
type AccountInfo struct {
	Email    string
	Limit    int64
	Usage    int64
	FolderID string
}

func (m *Manager) service(ctx context.Context, tok *oauth2.Token) (*drive.Service, error) {
	return drive.NewService(ctx, option.WithTokenSource(m.oauth.TokenSource(ctx, tok)))
}

// Probe reads identity + quota for a freshly-exchanged token and ensures the
// G3 folder exists, returning everything needed to persist the account.
func (m *Manager) Probe(ctx context.Context, tok *oauth2.Token) (*AccountInfo, error) {
	svc, err := m.service(ctx, tok)
	if err != nil {
		return nil, err
	}
	return aboutAndFolder(ctx, svc)
}

// RefreshInfo re-reads quota for an already-linked account using its stored
// refresh token (the token source mints a fresh access token automatically).
func (m *Manager) RefreshInfo(ctx context.Context, refreshToken string) (*AccountInfo, error) {
	svc, err := m.Service(ctx, refreshToken)
	if err != nil {
		return nil, err
	}
	return aboutAndFolder(ctx, svc)
}

// Service builds a Drive client for a linked account from its refresh token.
func (m *Manager) Service(ctx context.Context, refreshToken string) (*drive.Service, error) {
	tok := &oauth2.Token{RefreshToken: refreshToken}
	return drive.NewService(ctx, option.WithTokenSource(m.oauth.TokenSource(ctx, tok)))
}

func aboutAndFolder(ctx context.Context, svc *drive.Service) (*AccountInfo, error) {
	var about *drive.About
	err := retry(ctx, func() error {
		a, e := svc.About.Get().Fields("user,storageQuota").Context(ctx).Do()
		if e != nil {
			return e
		}
		about = a
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("about.get: %w", err)
	}
	folderID, err := ensureFolder(ctx, svc)
	if err != nil {
		return nil, fmt.Errorf("ensure folder: %w", err)
	}
	info := &AccountInfo{FolderID: folderID}
	if about.User != nil {
		info.Email = about.User.EmailAddress
	}
	if about.StorageQuota != nil {
		info.Limit = about.StorageQuota.Limit
		info.Usage = about.StorageQuota.Usage
	}
	return info, nil
}

// ensureFolder finds or creates the dedicated G3 folder (app-scoped via
// drive.file, so List only sees files this app created).
func ensureFolder(ctx context.Context, svc *drive.Service) (string, error) {
	q := fmt.Sprintf(
		"name = '%s' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
		folderName)
	var list *drive.FileList
	if err := retry(ctx, func() error {
		l, e := svc.Files.List().Q(q).Fields("files(id,name)").Context(ctx).Do()
		if e != nil {
			return e
		}
		list = l
		return nil
	}); err != nil {
		return "", err
	}
	if len(list.Files) > 0 {
		return list.Files[0].Id, nil
	}
	var created *drive.File
	if err := retry(ctx, func() error {
		f, e := svc.Files.Create(&drive.File{
			Name:     folderName,
			MimeType: "application/vnd.google-apps.folder",
		}).Fields("id").Context(ctx).Do()
		if e != nil {
			return e
		}
		created = f
		return nil
	}); err != nil {
		return "", err
	}
	return created.Id, nil
}
