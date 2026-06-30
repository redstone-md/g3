package s3

import (
	"io"
	"net/http"
	"net/url"

	"g3/internal/store"
)

const s3ns = "http://s3.amazonaws.com/doc/2006-03-01/"

// aclXML is a single-owner FULL_CONTROL ACL (G3 is single-tenant; ACLs are
// reported so clients' Permissions tabs work, but access is key-scoped).
const aclXML = `<AccessControlPolicy xmlns="` + s3ns + `">` +
	`<Owner><ID>g3</ID><DisplayName>g3</DisplayName></Owner>` +
	`<AccessControlList><Grant>` +
	`<Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser">` +
	`<ID>g3</ID><DisplayName>g3</DisplayName></Grantee>` +
	`<Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>`

func writeRawXML(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/xml")
	w.WriteHeader(status)
	_, _ = io.WriteString(w, `<?xml version="1.0" encoding="UTF-8"?>`)
	_, _ = io.WriteString(w, body)
}

// bucketSubKeys are the query flags S3 treats as bucket sub-resources. Listing
// flags (list-type, prefix, …), uploads and delete are intentionally excluded.
var bucketSubKeys = []string{
	"acl", "policy", "policyStatus", "location", "versioning", "cors",
	"lifecycle", "tagging", "encryption", "website", "logging", "notification",
	"requestPayment", "publicAccessBlock", "object-lock", "replication",
	"accelerate", "ownershipControls", "analytics", "inventory", "metrics",
}

func detectBucketSub(q url.Values) (string, bool) {
	for _, k := range bucketSubKeys {
		if _, ok := q[k]; ok {
			return k, true
		}
	}
	return "", false
}

// handleBucketSub serves bucket sub-resource requests so S3 clients' Properties
// and Permissions tabs resolve instead of receiving an object listing.
func (s *Server) handleBucketSub(w http.ResponseWriter, r *http.Request, name, sub string) {
	b, err := s.store.BucketByName(name)
	if err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchBucket", "", name)
		return
	}

	switch sub {
	case "acl":
		if r.Method == http.MethodPut {
			w.WriteHeader(http.StatusOK)
			return
		}
		writeRawXML(w, http.StatusOK, aclXML)
	case "policy":
		switch r.Method {
		case http.MethodGet:
			if p, ok := s.store.BucketPolicy(b.ID); ok {
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, p)
				return
			}
			writeS3Error(w, http.StatusNotFound, "NoSuchBucketPolicy", "The bucket policy does not exist", name)
		case http.MethodPut:
			body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
			_ = s.store.SetBucketPolicy(b.ID, string(body))
			w.WriteHeader(http.StatusNoContent)
		case http.MethodDelete:
			_ = s.store.DeleteBucketPolicy(b.ID)
			w.WriteHeader(http.StatusNoContent)
		}
	case "policyStatus":
		writeRawXML(w, http.StatusOK, `<PolicyStatus xmlns="`+s3ns+`"><IsPublic>false</IsPublic></PolicyStatus>`)
	case "location":
		writeRawXML(w, http.StatusOK, `<LocationConstraint xmlns="`+s3ns+`"></LocationConstraint>`)
	case "versioning":
		if r.Method == http.MethodPut {
			w.WriteHeader(http.StatusOK)
			return
		}
		writeRawXML(w, http.StatusOK, `<VersioningConfiguration xmlns="`+s3ns+`"></VersioningConfiguration>`)
	case "tagging":
		switch r.Method {
		case http.MethodPut:
			w.WriteHeader(http.StatusNoContent)
		case http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)
		default:
			writeRawXML(w, http.StatusOK, `<Tagging xmlns="`+s3ns+`"><TagSet></TagSet></Tagging>`)
		}
	case "logging":
		writeRawXML(w, http.StatusOK, `<BucketLoggingStatus xmlns="`+s3ns+`"></BucketLoggingStatus>`)
	case "notification":
		writeRawXML(w, http.StatusOK, `<NotificationConfiguration xmlns="`+s3ns+`"></NotificationConfiguration>`)
	case "requestPayment":
		writeRawXML(w, http.StatusOK, `<RequestPaymentConfiguration xmlns="`+s3ns+`"><Payer>BucketOwner</Payer></RequestPaymentConfiguration>`)
	case "accelerate":
		writeRawXML(w, http.StatusOK, `<AccelerateConfiguration xmlns="`+s3ns+`"></AccelerateConfiguration>`)
	case "cors":
		s.notConfigured(w, r, "NoSuchCORSConfiguration", "The CORS configuration does not exist", name)
	case "lifecycle":
		s.notConfigured(w, r, "NoSuchLifecycleConfiguration", "The lifecycle configuration does not exist", name)
	case "encryption":
		s.notConfigured(w, r, "ServerSideEncryptionConfigurationNotFoundError", "The server side encryption configuration was not found", name)
	case "website":
		s.notConfigured(w, r, "NoSuchWebsiteConfiguration", "The website configuration does not exist", name)
	case "publicAccessBlock":
		s.notConfigured(w, r, "NoSuchPublicAccessBlockConfiguration", "The public access block configuration was not found", name)
	case "object-lock":
		s.notConfigured(w, r, "ObjectLockConfigurationNotFoundError", "Object Lock configuration does not exist for this bucket", name)
	case "replication":
		s.notConfigured(w, r, "ReplicationConfigurationNotFoundError", "The replication configuration was not found", name)
	case "ownershipControls":
		s.notConfigured(w, r, "OwnershipControlsNotFoundError", "The bucket ownership controls were not found", name)
	default:
		// analytics/inventory/metrics and the like: nothing configured.
		writeS3Error(w, http.StatusNotFound, "NoSuchConfiguration", "Not configured", name)
	}
}

// notConfigured answers a GET with a "not found" error but lets PUT/DELETE
// succeed quietly (clients sometimes probe then set).
func (s *Server) notConfigured(w http.ResponseWriter, r *http.Request, code, msg, resource string) {
	if r.Method == http.MethodPut || r.Method == http.MethodDelete {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeS3Error(w, http.StatusNotFound, code, msg, resource)
}

// --- object sub-resources ---

var objectSubKeys = []string{"acl", "tagging", "retention", "legal-hold", "attributes"}

func detectObjectSub(q url.Values) (string, bool) {
	for _, k := range objectSubKeys {
		if _, ok := q[k]; ok {
			return k, true
		}
	}
	return "", false
}

func (s *Server) handleObjectSub(w http.ResponseWriter, r *http.Request, b *store.Bucket, key, sub string) {
	if _, err := s.store.ObjectByKey(b.ID, key); err != nil {
		writeS3Error(w, http.StatusNotFound, "NoSuchKey", "", key)
		return
	}
	switch sub {
	case "acl":
		if r.Method == http.MethodPut {
			w.WriteHeader(http.StatusOK)
			return
		}
		writeRawXML(w, http.StatusOK, aclXML)
	case "tagging":
		switch r.Method {
		case http.MethodPut, http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)
		default:
			writeRawXML(w, http.StatusOK, `<Tagging xmlns="`+s3ns+`"><TagSet></TagSet></Tagging>`)
		}
	case "retention":
		s.notConfigured(w, r, "NoSuchObjectLockConfiguration", "Object retention not set", key)
	case "legal-hold":
		writeRawXML(w, http.StatusOK, `<LegalHold xmlns="`+s3ns+`"><Status>OFF</Status></LegalHold>`)
	default:
		writeS3Error(w, http.StatusNotImplemented, "NotImplemented", "Unsupported object sub-resource", key)
	}
}
